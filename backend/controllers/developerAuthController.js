import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Developer from '../models/Developer.js';
import { sendOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import generateToken from '../utils/generateToken.js';
import { assertOtpNotLocked, recordFailedOtpAttempt, resetOtpAttempts, OtpLockedError } from '../utils/otpLockout.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const OTP_TTL_MS = 10 * 60 * 1000;

const issueOtp = async (developer) => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);
  await Developer.updateOne({ _id: developer._id }, { $set: { otp, otpExpires, otpChannel: 'email' } });
  await sendOTP(developer.email, otp).catch((err) => {
    console.error(`Developer OTP: failed to send to ${developer.email}:`, err);
  });
};

const publicDeveloper = (developer) => ({
  _id: developer._id,
  name: developer.name,
  companyName: developer.companyName,
  email: developer.email,
  phone: developer.phone,
  status: developer.status,
  isVerified: developer.isVerified,
  liveAccess: {
    approved: developer.liveAccess?.approved || false,
    requestedAt: developer.liveAccess?.requestedAt || null,
  },
  createdAt: developer.createdAt,
  lastLogin: developer.lastLogin,
});

// @desc    Register a new developer account
// @route   POST /api/auth/developer/register
// @access  Public
export const registerDeveloper = async (req, res) => {
  try {
    let { name, companyName, email, phone, password } = req.body || {};

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ error: 'name, companyName, email, and password are required.' });
    }
    email = String(email).trim().toLowerCase();
    if (phone) phone = String(phone).trim();

    const existing = await Developer.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const developer = await Developer.create({ name, companyName, email, phone: phone || null, password });
    await issueOtp(developer);

    logAudit({
      action: 'developer.registered', category: 'auth', severity: 'info',
      message: `Developer account created for ${companyName}`,
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      metadata: { companyName },
    });

    res.status(201).json({
      success: true,
      message: 'Account created. Check your email for a verification code.',
      email: developer.email,
    });
  } catch (error) {
    console.error('Register Developer Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Verify a developer's registration OTP — activates the account and issues a session
// @route   POST /api/auth/developer/verify-otp
// @access  Public
export const verifyDeveloperOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const developer = await Developer.findOne({ email: String(email || '').trim().toLowerCase() }).select('+otp +otpExpires');

    if (!developer) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    try {
      await assertOtpNotLocked(Developer, developer._id);
    } catch (e) {
      if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    if (!developer.otp || !timingSafeStringEqual(developer.otp, String(otp || ''))) {
      await recordFailedOtpAttempt(Developer, developer._id);
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (new Date() > developer.otpExpires) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    developer.otp = null;
    developer.otpExpires = null;
    developer.isVerified = true;
    developer.status = 'active';
    developer.lastLogin = new Date();
    await developer.save();
    await resetOtpAttempts(Developer, developer._id);

    logAudit({
      action: 'developer.verified', category: 'auth', severity: 'success',
      message: 'Developer account verified',
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
    });

    res.json({
      success: true,
      developer: publicDeveloper(developer),
      token: generateToken(developer._id, '30d', { tokenVersion: developer.tokenVersion || 0 }),
    });
  } catch (error) {
    console.error('Verify Developer OTP Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Resend the registration/verification OTP
// @route   POST /api/auth/developer/resend-otp
// @access  Public
export const resendDeveloperOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    const developer = await Developer.findOne({ email: String(email || '').trim().toLowerCase() });

    if (!developer) {
      return res.status(401).json({ error: 'Invalid request' });
    }
    if (developer.status !== 'pending_verification') {
      return res.status(400).json({ error: 'This account is already verified.' });
    }

    await issueOtp(developer);
    res.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (error) {
    console.error('Resend Developer OTP Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Log in an existing, verified developer
// @route   POST /api/auth/developer/login
// @access  Public
export const loginDeveloper = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const identifier = String(email || '').trim().toLowerCase();

    const developer = await Developer.findOne({ email: identifier }).select('+password');

    if (!developer) {
      // Dummy bcrypt compare on a miss so a nonexistent account doesn't
      // resolve faster than a real wrong-password rejection below — same
      // timing-oracle defence used in loginMerchant.
      await bcrypt.compare(String(password || ''), '$2a$12$CwTycUXWue0Thq9StjUM0uJ8i.dTQwsxOnJz3XkKvKl.mDcMxLj8O');
      logAudit({
        action: 'developer.login.failed', category: 'auth', severity: 'warning',
        message: `Failed sign-in — no account for "${identifier}"`,
        req, metadata: { identifier, reason: 'no_account' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await developer.matchPassword(password);
    if (!isMatch) {
      logAudit({
        action: 'developer.login.failed', category: 'auth', severity: 'warning',
        message: 'Failed sign-in — incorrect password',
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
        metadata: { reason: 'bad_password' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (developer.status === 'suspended') {
      logAudit({
        action: 'developer.login.blocked', category: 'security', severity: 'critical',
        message: 'Sign-in blocked — account is suspended',
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      });
      return res.status(403).json({ error: 'This account has been suspended. Contact PayChain support.' });
    }

    if (developer.status === 'pending_verification') {
      await issueOtp(developer);
      return res.status(403).json({
        error: 'Please verify your email before signing in. A new verification code has been sent.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    developer.lastLogin = new Date();
    await developer.save();

    logAudit({
      action: 'developer.login.success', category: 'auth', severity: 'success',
      message: 'Signed in successfully',
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
    });

    res.json({
      success: true,
      developer: publicDeveloper(developer),
      token: generateToken(developer._id, '30d', { tokenVersion: developer.tokenVersion || 0 }),
    });
  } catch (error) {
    console.error('Login Developer Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Sign out — bumps tokenVersion, revoking every previously issued JWT
// @route   POST /api/auth/developer/logout
// @access  Private (Developer)
export const logoutDeveloper = async (req, res) => {
  try {
    await Developer.updateOne({ _id: req.developer._id }, { $inc: { tokenVersion: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Logout Developer Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};
