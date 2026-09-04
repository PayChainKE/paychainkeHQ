import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Developer from '../models/Developer.js';
import { serverError } from '../utils/serverError.js';
import { sendOTP, sendPasswordResetConfirmation } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import generateToken from '../utils/generateToken.js';
import { assertOtpNotLocked, recordFailedOtpAttempt, resetOtpAttempts, OtpLockedError } from '../utils/otpLockout.js';
import { assertLoginNotLocked, recordFailedLoginAttempt, resetLoginAttempts, LoginLockedError } from '../utils/loginLockout.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const OTP_TTL_MS = 10 * 60 * 1000;

// Mask an email for safe display in the UI: jane@example.com → j••e@e••••e.com
// Same helper as controllers/merchantAuthController.js's identical one.
const maskEmail = (raw) => {
  if (!raw || typeof raw !== 'string' || !raw.includes('@')) return null;
  const [local, domain] = raw.split('@');
  const m = (s) => s.length <= 2
    ? s[0] + '•'
    : s[0] + '•'.repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
  const dot = domain.lastIndexOf('.');
  const base = dot === -1 ? domain : domain.slice(0, dot);
  const tld  = dot === -1 ? '' : domain.slice(dot);
  return `${m(local)}@${m(base)}${tld}`;
};

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
    serverError(res, 500, 'Server Error', error, 'Register Developer Error:');
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
    serverError(res, 500, 'Server Error', error, 'Verify Developer OTP Error:');
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
    serverError(res, 500, 'Server Error', error, 'Resend Developer OTP Error:');
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

    try {
      await assertLoginNotLocked(Developer, developer._id);
    } catch (e) {
      if (e instanceof LoginLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const isMatch = await developer.matchPassword(password);
    if (!isMatch) {
      await recordFailedLoginAttempt(Developer, developer._id);
      logAudit({
        action: 'developer.login.failed', category: 'auth', severity: 'warning',
        message: 'Failed sign-in — incorrect password',
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
        metadata: { reason: 'bad_password' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await resetLoginAttempts(Developer, developer._id);

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
    serverError(res, 500, 'Server Error', error, 'Login Developer Error:');
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
    serverError(res, 500, 'Server Error', error, 'Logout Developer Error:');
  }
};

// @desc    Forgot Password — step 1 of 3. Same shape as
//          merchantAuthController.js#forgotPassword: mints a 6-digit OTP
//          (10 min TTL) and emails it, always responding 200 to prevent
//          account enumeration.
// @route   POST /api/auth/developer/forgot-password
// @access  Public (rate-limited at the route layer)
export const forgotDeveloperPassword = async (req, res) => {
  const { email } = req.body || {};
  try {
    const lookup = String(email || '').trim().toLowerCase();
    if (!lookup) {
      return res.status(400).json({ error: 'Enter your email.' });
    }

    const developer = await Developer.findOne({ email: lookup });

    if (developer) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpires = new Date(Date.now() + OTP_TTL_MS);

      await Promise.all([
        Developer.updateOne({ _id: developer._id }, {
          $set: { otp, otpExpires, otpChannel: 'email', passwordResetToken: null, passwordResetExpires: null },
        }),
        sendOTP(developer.email, otp).catch((err) => {
          console.error(`Developer Reset OTP: failed to send to ${developer.email}:`, err);
        }),
      ]);

      logAudit({
        action: 'developer.password.reset_requested', category: 'security', severity: 'warning',
        message: 'Password reset requested — OTP dispatched',
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      });
    } else {
      logAudit({
        action: 'developer.password.reset_attempt_unknown', category: 'security', severity: 'warning',
        message: `Reset requested for unknown developer email "${lookup}"`,
        req, metadata: { identifier: lookup },
      });
    }

    res.json({
      success: true,
      message: 'If an account exists, a 6-digit verification code has been sent.',
      maskedEmail: developer ? maskEmail(developer.email) : null,
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Forgot Developer Password Error:');
  }
};

// @desc    Verify Reset OTP — step 2 of 3. Same shape as
//          merchantAuthController.js#verifyResetOTP: validates the 6-digit
//          code (timing-safe, account-lockout-guarded) and mints a
//          single-use sha256-hashed reset token (15 min TTL).
// @route   POST /api/auth/developer/verify-reset-otp
// @access  Public (rate-limited at the route layer)
export const verifyDeveloperResetOtp = async (req, res) => {
  const { email, otp } = req.body || {};
  try {
    const lookup = String(email || '').trim().toLowerCase();
    if (!lookup || !/^\d{6}$/.test(String(otp || ''))) {
      return res.status(400).json({ error: 'Email and 6-digit code are required.' });
    }

    const developer = await Developer.findOne({ email: lookup }).select('+otp +otpExpires');
    if (!developer || !developer.otp || !developer.otpExpires) {
      return res.status(400).json({ error: 'Invalid code. Request a new one and try again.' });
    }

    try {
      await assertOtpNotLocked(Developer, developer._id);
    } catch (e) {
      if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    if (!timingSafeStringEqual(developer.otp, String(otp))) {
      await recordFailedOtpAttempt(Developer, developer._id);
      return res.status(400).json({ error: 'Invalid code. Check your inbox and try again.' });
    }

    if (new Date() > developer.otpExpires) {
      return res.status(400).json({ error: 'Code has expired. Request a new one.' });
    }

    await resetOtpAttempts(Developer, developer._id);

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    developer.passwordResetToken   = hashedToken;
    developer.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    developer.otp = null;
    developer.otpExpires = null;
    await developer.save();

    logAudit({
      action: 'developer.password.reset_verified', category: 'security', severity: 'info',
      message: 'Reset OTP verified — reset token minted',
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
    });

    res.json({
      success: true,
      message: 'Code verified. Set your new password to continue.',
      resetToken: rawToken,
      expiresInSeconds: 15 * 60,
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Verify Developer Reset OTP Error:');
  }
};

// @desc    Reset Password — step 3 of 3. Validates the reset token, sets
//          the new password (Developer pre-save hook bcrypt-hashes at 12
//          rounds), bumps tokenVersion (revokes every previously issued
//          JWT — same rationale as merchantAuthController.js#resetPassword),
//          and fires a confirmation email.
// @route   POST /api/auth/developer/reset-password
// @access  Public (rate-limited at the route layer)
export const resetDeveloperPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  try {
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (!resetToken) {
      return res.status(400).json({ error: 'Reset token is required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(String(resetToken)).digest('hex');
    const developer = await Developer.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!developer) {
      return res.status(401).json({
        error: 'This reset link has expired. Start the password reset flow again.',
      });
    }

    developer.password = String(newPassword);
    developer.otp = null;
    developer.otpExpires = null;
    developer.passwordResetToken = null;
    developer.passwordResetExpires = null;
    developer.tokenVersion = (developer.tokenVersion || 0) + 1;
    await developer.save();

    const when = new Date().toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short',
    });
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
    const ua = String(req.headers['user-agent'] || 'unknown device').slice(0, 200);

    sendPasswordResetConfirmation(developer.email, developer.name, when, ip, ua)
      .catch((err) => console.error('Developer reset confirmation email failed:', err));

    logAudit({
      action: 'developer.password.reset_completed', category: 'security', severity: 'critical',
      message: 'Password reset completed — receipt email dispatched',
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
    });

    res.json({
      success: true,
      message: 'Password has been reset. Sign in with your new password.',
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Reset Developer Password Error:');
  }
};
