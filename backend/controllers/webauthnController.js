import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import Merchant from '../models/Merchant.js';
import generateToken from '../utils/generateToken.js';
import { logAudit, clipUa, detectPlatform } from '../utils/auditLog.js';

// ── Relying Party (RP) Configuration ────────────────────────────────────────
// RP_ID must be exactly equal to, or a registrable domain suffix of, the
// origin the merchant dashboard is actually served from — the browser
// enforces this and silently fails authentication otherwise. Using the
// specific subdomain (not the bare apex "paychain.co.ke") scopes passkeys
// tightly to the merchant dashboard only, since admin/officer/demo don't
// implement WebAuthn — "app.paychain.co.ke" is also a valid RP ID for the
// "www.app.paychain.co.ke" origin (a suffix match after dropping "www."),
// so one RP_ID default covers both real entry points in server.js's CORS
// allowlist.
//
// RP_ORIGIN accepts a comma-separated list (verified against whichever
// origin the actual request came from) so both the www and non-www
// variants validate without needing two separate deployments configured.
//
// Override via env vars on Render if these domains ever change:
//   WEBAUTHN_RP_NAME   = "PayChain"
//   WEBAUTHN_RP_ID     = "app.paychain.co.ke"
//   WEBAUTHN_RP_ORIGIN = "https://app.paychain.co.ke,https://www.app.paychain.co.ke"
//
// Defaults below auto-switch to localhost:5173 (the merchant-dashboard
// Vite dev server) outside production so local dev keeps working with no
// env vars set at all.
const isProdEnv = process.env.NODE_ENV === 'production';
const RP_NAME   = process.env.WEBAUTHN_RP_NAME || 'PayChain';
const RP_ID     = process.env.WEBAUTHN_RP_ID || (isProdEnv ? 'app.paychain.co.ke' : 'localhost');
const RP_ORIGIN = process.env.WEBAUTHN_RP_ORIGIN
  ? process.env.WEBAUTHN_RP_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : (isProdEnv ? ['https://app.paychain.co.ke', 'https://www.app.paychain.co.ke'] : ['http://localhost:5173']);

// A stored challenge is single-use (cleared right after a successful
// verify) regardless of this — this is defense-in-depth against a
// challenge sitting around unused for a long time (e.g. a browser tab
// left open mid-flow, or a stale request replayed later).
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
function isChallengeExpired(challengeAt) {
  return !challengeAt || (Date.now() - new Date(challengeAt).getTime()) > CHALLENGE_TTL_MS;
}

// @desc  Begin passkey registration (merchant must already hold a valid JWT).
// @route GET /api/auth/merchant/webauthn/register-options
// @access Private
export const getRegistrationOptions = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+passkeys');

    const excludeCredentials = (merchant.passkeys || []).map(p => ({
      id: p.credentialID,
      transports: p.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      // userID must be a stable, unique byte sequence — use the Mongo ObjectId
      userID: new TextEncoder().encode(merchant._id.toString()),
      userName: merchant.email,
      userDisplayName: merchant.name,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        // 'platform' restricts to built-in authenticators:
        // Touch ID, Face ID, Windows Hello, Android fingerprint.
        authenticatorAttachment: 'platform',
      },
      timeout: 60_000,
    });

    await Merchant.findByIdAndUpdate(merchant._id, {
      currentChallenge: options.challenge,
      currentChallengeAt: new Date(),
    });

    res.json({ success: true, options });
  } catch (err) {
    console.error('WebAuthn register-options error:', err);
    res.status(500).json({ error: 'Failed to generate registration options.' });
  }
};

// @desc  Complete passkey registration.
// @route POST /api/auth/merchant/webauthn/verify-registration
// @access Private
export const verifyRegistration = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+currentChallenge +currentChallengeAt +passkeys');

    if (!merchant.currentChallenge || isChallengeExpired(merchant.currentChallengeAt)) {
      return res.status(400).json({ error: 'This registration attempt has expired. Please try again.' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: merchant.currentChallenge,
        expectedOrigin: RP_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
    } catch (inner) {
      // Full detail (often a raw library/DOM message, not meant for end
      // users — e.g. exact challenge/origin mismatch internals) stays
      // server-side only; the client gets a clean, actionable message.
      console.error('WebAuthn registration rejected:', inner.message);
      return res.status(400).json({ error: 'Passkey registration could not be completed. Please try again.' });
    }

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      return res.status(400).json({ error: 'Passkey could not be verified.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    const newPasskey = {
      credentialID: credential.id,
      publicKey:    Buffer.from(credential.publicKey).toString('base64'),
      counter:      credential.counter,
      deviceType:   credentialDeviceType,
      backedUp:     credentialBackedUp,
      transports:   req.body.response?.transports ?? [],
      userAgent:    clipUa(req),
      platform:     detectPlatform(req),
      createdAt:    new Date(),
      lastUsed:     null,
    };

    await Merchant.findByIdAndUpdate(merchant._id, {
      $set: { currentChallenge: null, currentChallengeAt: null, biometricsEnabled: true },
      $push: { passkeys: newPasskey },
    });

    logAudit({
      action: 'merchant.passkey.registered',
      category: 'security',
      severity: 'info',
      message: 'New passkey registered on merchant account',
      merchant,
      req,
      metadata: { deviceType: credentialDeviceType, backedUp: credentialBackedUp },
    });

    res.json({ success: true, message: 'Passkey registered. You can now sign in with biometrics.' });
  } catch (err) {
    console.error('WebAuthn verify-registration error:', err);
    res.status(500).json({ error: 'Server error during passkey registration.' });
  }
};

// @desc  Issue authentication options (public — email identifies the account).
// @route POST /api/auth/merchant/webauthn/login-options
// @access Public
export const getLoginOptions = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email or phone required.' });

    const identifier = String(email).trim();
    const merchant = await Merchant.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    }).select('+passkeys +currentChallenge +currentChallengeAt');

    // Return empty options when no passkeys — never reveal whether the account exists.
    if (!merchant || !merchant.passkeys?.length) {
      const empty = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: [],
        userVerification: 'required',
        timeout: 60_000,
      });
      return res.json({ success: true, options: empty });
    }

    if (merchant.status === 'locked') {
      return res.status(403).json({ error: 'Account locked. Contact PayChain support.' });
    }

    const allowCredentials = merchant.passkeys.map(p => ({
      id: p.credentialID,
      transports: p.transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'required',
      timeout: 60_000,
    });

    await Merchant.findByIdAndUpdate(merchant._id, {
      currentChallenge: options.challenge,
      currentChallengeAt: new Date(),
    });

    res.json({ success: true, options });
  } catch (err) {
    console.error('WebAuthn login-options error:', err);
    res.status(500).json({ error: 'Failed to generate login options.' });
  }
};

// @desc  Verify biometric response and issue JWT on success.
// @route POST /api/auth/merchant/webauthn/verify-login
// @access Public
export const verifyLogin = async (req, res) => {
  try {
    const { email, response: authResponse } = req.body || {};
    if (!email || !authResponse) {
      return res.status(400).json({ error: 'Email and authentication response required.' });
    }

    const identifier = String(email).trim();
    const merchant = await Merchant.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    }).select('+currentChallenge +currentChallengeAt +passkeys +appPin');

    if (!merchant || !merchant.currentChallenge || !merchant.passkeys?.length) {
      return res.status(401).json({ error: 'No passkey found for this account.' });
    }
    if (isChallengeExpired(merchant.currentChallengeAt)) {
      return res.status(401).json({ error: 'This sign-in attempt has expired. Please try again.' });
    }

    const passkey = merchant.passkeys.find(p => p.credentialID === authResponse.id);
    if (!passkey) {
      return res.status(401).json({
        error: 'Passkey not recognised. Sign in with your password and re-register the passkey.',
      });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge: merchant.currentChallenge,
        expectedOrigin: RP_ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id:         passkey.credentialID,
          publicKey:  new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
          counter:    passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: true,
      });
    } catch (inner) {
      console.error('WebAuthn login verification rejected:', inner.message);
      return res.status(401).json({ error: 'Biometric sign-in could not be verified. Please try again or sign in with your password.' });
    }

    const { verified, authenticationInfo } = verification;
    if (!verified) {
      return res.status(401).json({ error: 'Biometric authentication did not succeed.' });
    }

    // Update counter (prevents replay attacks) and last-used timestamp.
    passkey.counter = authenticationInfo.newCounter;
    passkey.lastUsed = new Date();
    merchant.currentChallenge = null;
    merchant.currentChallengeAt = null;
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.lastLogin = new Date();
    await merchant.save();

    const token = generateToken(merchant._id, '30d', { tokenVersion: merchant.tokenVersion || 0 });

    logAudit({
      action: 'merchant.login.passkey',
      category: 'auth',
      severity: 'success',
      message: 'Signed in via passkey / biometrics',
      merchant,
      req,
      metadata: { credentialID: passkey.credentialID, loginCount: merchant.loginCount },
    });

    res.json({
      success: true,
      token,
      merchant: {
        _id:              merchant._id,
        name:             merchant.name,
        email:            merchant.email,
        phone:            merchant.phone,
        businessName:     merchant.businessName,
        kesBalance:       merchant.kesBalance,
        usdcBalance:      merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status:           merchant.status,
        isVerified:       merchant.isVerified,
        biometricsEnabled: merchant.biometricsEnabled,
        mobileBiometricUnlockEnabled: merchant.mobileBiometricUnlockEnabled,
        hasAppPin:        !!merchant.appPin,
      },
    });
  } catch (err) {
    console.error('WebAuthn verify-login error:', err);
    res.status(500).json({ error: 'Server error during passkey login.' });
  }
};

// @desc  List registered passkeys for the authenticated merchant.
// @route GET /api/auth/merchant/webauthn/passkeys
// @access Private
export const getPasskeys = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+passkeys');
    const passkeys = (merchant.passkeys || []).map(p => ({
      credentialID: p.credentialID,
      label:        p.label || null,
      deviceType:   p.deviceType,
      backedUp:     p.backedUp,
      transports:   p.transports,
      userAgent:    p.userAgent,
      platform:     p.platform,
      createdAt:    p.createdAt,
      lastUsed:     p.lastUsed,
    }));
    res.json({ success: true, passkeys });
  } catch (err) {
    console.error('Get passkeys error:', err);
    res.status(500).json({ error: 'Failed to fetch passkeys.' });
  }
};

// @desc  Rename a passkey (merchant-assigned label, e.g. "My iPhone").
// @route PATCH /api/auth/merchant/webauthn/passkeys/:credentialID
// @access Private
export const renamePasskey = async (req, res) => {
  try {
    const { credentialID } = req.params;
    const label = String(req.body?.label ?? '').trim().slice(0, 60);
    if (!label) return res.status(400).json({ error: 'Label cannot be empty.' });

    const merchant = await Merchant.findOneAndUpdate(
      { _id: req.merchant._id, 'passkeys.credentialID': credentialID },
      { $set: { 'passkeys.$.label': label } },
      { new: true },
    ).select('+passkeys');

    if (!merchant) return res.status(404).json({ error: 'Passkey not found.' });

    res.json({ success: true, label });
  } catch (err) {
    console.error('Rename passkey error:', err);
    res.status(500).json({ error: 'Failed to rename passkey.' });
  }
};

// @desc  Remove a specific passkey.
// @route DELETE /api/auth/merchant/webauthn/passkeys/:credentialID
// @access Private
export const deletePasskey = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+passkeys');
    const { credentialID } = req.params;

    const exists = (merchant.passkeys || []).some(p => p.credentialID === credentialID);
    if (!exists) return res.status(404).json({ error: 'Passkey not found.' });

    await Merchant.findByIdAndUpdate(merchant._id, {
      $pull: { passkeys: { credentialID } },
    });

    const remaining = (merchant.passkeys?.length || 0) - 1;
    if (remaining === 0) {
      await Merchant.findByIdAndUpdate(merchant._id, { biometricsEnabled: false });
    }

    logAudit({
      action: 'merchant.passkey.deleted',
      category: 'security',
      severity: 'warning',
      message: 'Passkey removed from merchant account',
      merchant,
      req,
      metadata: { credentialID },
    });

    res.json({ success: true, message: 'Passkey removed.' });
  } catch (err) {
    console.error('Delete passkey error:', err);
    res.status(500).json({ error: 'Failed to remove passkey.' });
  }
};
