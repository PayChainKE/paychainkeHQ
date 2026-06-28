import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import Merchant from '../models/Merchant.js';
import generateToken from '../utils/generateToken.js';
import { logAudit } from '../utils/auditLog.js';

// ── Relying Party (RP) Configuration ────────────────────────────────────────
// To go live, set these env vars on Render/Vercel:
//   WEBAUTHN_RP_NAME   = "PayChain"
//   WEBAUTHN_RP_ID     = "paychain.co.ke"        ← bare domain, no https://
//   WEBAUTHN_RP_ORIGIN = "https://app.paychain.co.ke"  ← full web-app origin
//
// For local dev the defaults below work with http://localhost:5173.
// ─────────────────────────────────────────────────────────────────────────────
const RP_NAME   = process.env.WEBAUTHN_RP_NAME   || 'PayChain';
const RP_ID     = process.env.WEBAUTHN_RP_ID     || 'localhost';
const RP_ORIGIN = process.env.WEBAUTHN_RP_ORIGIN || 'http://localhost:5173';

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

    // Store challenge; it expires when overwritten or session ends.
    await Merchant.findByIdAndUpdate(merchant._id, { currentChallenge: options.challenge });

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
    const merchant = await Merchant.findById(req.merchant._id).select('+currentChallenge +passkeys');

    if (!merchant.currentChallenge) {
      return res.status(400).json({ error: 'No pending registration challenge. Restart the flow.' });
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
      console.error('WebAuthn registration rejected:', inner.message);
      return res.status(400).json({ error: inner.message || 'Passkey registration failed.' });
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
      createdAt:    new Date(),
      lastUsed:     null,
    };

    await Merchant.findByIdAndUpdate(merchant._id, {
      $set: { currentChallenge: null, biometricsEnabled: true },
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
    }).select('+passkeys +currentChallenge');

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

    await Merchant.findByIdAndUpdate(merchant._id, { currentChallenge: options.challenge });

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
    }).select('+currentChallenge +passkeys +bulkPayPin +appPin');

    if (!merchant || !merchant.currentChallenge || !merchant.passkeys?.length) {
      return res.status(401).json({ error: 'No passkey found for this account.' });
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
      return res.status(401).json({ error: inner.message || 'Biometric verification failed.' });
    }

    const { verified, authenticationInfo } = verification;
    if (!verified) {
      return res.status(401).json({ error: 'Biometric authentication did not succeed.' });
    }

    // Update counter (prevents replay attacks) and last-used timestamp.
    passkey.counter = authenticationInfo.newCounter;
    passkey.lastUsed = new Date();
    merchant.currentChallenge = null;
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.lastLogin = new Date();
    await merchant.save();

    const token = generateToken(merchant._id);

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
        paybillAccount:   merchant.paybillAccount,
        kesBalance:       merchant.kesBalance,
        usdcBalance:      merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status:           merchant.status,
        isVerified:       merchant.isVerified,
        biometricsEnabled: merchant.biometricsEnabled,
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
      deviceType:   p.deviceType,
      backedUp:     p.backedUp,
      transports:   p.transports,
      createdAt:    p.createdAt,
      lastUsed:     p.lastUsed,
    }));
    res.json({ success: true, passkeys });
  } catch (err) {
    console.error('Get passkeys error:', err);
    res.status(500).json({ error: 'Failed to fetch passkeys.' });
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
