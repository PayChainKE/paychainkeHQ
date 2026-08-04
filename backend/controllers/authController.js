import crypto from 'crypto';
import Admin from '../models/Admin.js';
import { sendOTP } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';
import { logAudit } from '../utils/auditLog.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';

// Cryptographically generate a 6-digit OTP (avoids Math.random predictability).
function generateOtp() {
  // crypto.randomInt is uniformly distributed and safe for credential material.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Mirrors merchantAuthController.js's maskPhone — e.g. +254712345678 →
// +254•••••••78. Admin.phone is always stored pre-normalized (E.164), so
// this never needs the raw-fallback branch the merchant version has.
function maskPhone(e164) {
  const digits = String(e164 || '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  return `+${start}${'•'.repeat(Math.max(3, digits.length - start.length - end.length))}${end}`;
}

// Resolves the login "email" field to an actual Admin doc whether the user
// typed their email or their phone number — same email-or-phone login the
// merchant dashboard already supports. Returns null rather than throwing on
// a malformed phone (never let toE164Kenyan's null accidentally become a
// `{ phone: null }` query, which would match every admin with no phone set).
async function findAdminByIdentifier(identifier, { withPassword = false } = {}) {
  const isEmail = identifier.includes('@');
  const query = isEmail
    ? { email: identifier.toLowerCase() }
    : { phone: toE164Kenyan(identifier) };
  if (!isEmail && !query.phone) return null;
  const q = Admin.findOne(query);
  return withPassword ? q.select('+password') : q;
}

// Sends the login OTP via SMS when the admin/officer signed in with their
// phone number, otherwise email — mirrors merchantAuthController.js's
// dispatchOtp. Admin.phone is only ever set already-normalized (see
// officerAccountController.js), so unlike the merchant version there's no
// "phone present but won't normalize" fallback branch to handle.
async function dispatchAdminOtp(admin, { viaPhone, otp }) {
  if (viaPhone && admin.phone) {
    const result = await safeSendSMS({
      to: admin.phone,
      message: `Your PayChain verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    });
    if (!result.success) console.error(`SMS OTP dispatch failed for admin ${admin._id}:`, result.error);
    return { channel: 'sms', maskedPhone: maskPhone(admin.phone) };
  }
  // Dispatch async; never log the OTP value.
  sendOTP(admin.email, otp).catch((err) => {
    console.error('OTP dispatch failed:', err?.message || err);
  });
  return { channel: 'email', maskedPhone: null };
}

// Constant-time string comparison to prevent timing-based code guessing.
function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// @desc    Stage 1: Identity Verification (Email/Password -> OTP)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const identifier = String(email).trim();
    const viaPhone = !identifier.includes('@');

    // password is select:false on the schema; explicit opt-in for the compare.
    const admin = await findAdminByIdentifier(identifier, { withPassword: true });
    if (!admin) {
      // Same error + status as bad-password to avoid identifier enumeration.
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { channel, maskedPhone } = await dispatchAdminOtp(admin, { viaPhone, otp });

    admin.otp = otp;
    admin.otpExpires = otpExpires;
    admin.otpChannel = channel;
    await admin.save();

    res.json({
      success: true,
      mfaRequired: true,
      email: admin.email,
      channel,
      maskedPhone,
      message: channel === 'sms' ? 'OTP sent via SMS. Proceed to Stage 2.' : 'OTP sent to your email. Proceed to Stage 2.',
    });
  } catch (error) {
    console.error('Login error:', error?.message || error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Return the authenticated admin's profile.
// @route   GET /api/admin/auth/me
// @access  Private (Admin)
export const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password -otp -otpExpires');
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });
    res.json({ success: true, data: admin });
  } catch (error) {
    console.error('Get Me Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update display name / avatar URL. Email + role are immutable here
//          (role changes require a separate, higher-privileged flow).
// @route   PUT /api/admin/auth/me
// @access  Private (Admin)
export const updateMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });

    const { name, avatarUrl, avatarData } = req.body || {};
    if (typeof name === 'string') admin.name = name.trim().slice(0, 80);
    // Accept either a plain URL or an uploaded base64 data URL. Cap the data
    // URL at ~400 KB to keep Mongo doc size reasonable.
    if (typeof avatarData === 'string' && avatarData.startsWith('data:image/')) {
      if (avatarData.length > 400_000) {
        return res.status(413).json({ error: 'Avatar image is too large. Max 200 KB.' });
      }
      admin.avatarUrl = avatarData;
    } else if (typeof avatarUrl === 'string') {
      admin.avatarUrl = avatarUrl.trim().slice(0, 500) || null;
    }
    await admin.save();

    res.json({
      success: true,
      data: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error('Update Me Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Change admin password. Requires the current password to be
//          submitted alongside the new one (defense against session hijack).
//          Pre-save hook re-bcrypts at 12 rounds. Issues a fresh JWT so the
//          UI can keep the user signed in without a re-OTP.
// @route   PUT /api/admin/auth/password
// @access  Private (Admin)
export const changePassword = async (req, res) => {
  try {
    // Officers get their password set directly by an admin and can never
    // change it themselves — only an admin's reset-password action may.
    if (req.admin.role === 'officer') {
      return res.status(403).json({ error: 'Officers cannot change their own password. Contact an admin.', code: 'OFFICER_PASSWORD_LOCKED' });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 10) {
      return res.status(400).json({ error: 'New password must be at least 10 characters.' });
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });

    const ok = await admin.matchPassword(currentPassword);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    admin.password = newPassword;
    await admin.save();

    res.json({ success: true, message: 'Password updated.', token: generateToken(admin._id, '12h') });
  } catch (error) {
    console.error('Change Password Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Stage 2: Possession Verification (OTP -> JWT)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  const { email, otp, otpCode } = req.body;
  const submittedOtp = (otp || otpCode || '').toString().trim();
  const identifier = String(email || '').trim();

  if (!identifier || !submittedOtp) {
    return res.status(400).json({ error: 'Email/phone and verification code are required.' });
  }

  try {
    const admin = await findAdminByIdentifier(identifier);

    if (!admin || !admin.otp || !admin.otpExpires) {
      // Generic error — never reveal whether the email exists or whether
      // an OTP was issued.
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }

    // Reject expired codes BEFORE comparing — but with a generic message.
    if (new Date() > admin.otpExpires) {
      admin.otp = null;
      admin.otpExpires = null;
      await admin.save();
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }

    if (!timingSafeStringEqual(admin.otp, submittedOtp)) {
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }

    // Valid — single-use: clear the OTP and issue JWT.
    admin.otp = null;
    admin.otpExpires = null;
    admin.lastLogin = new Date();
    admin.loginCount = (admin.loginCount || 0) + 1;
    await admin.save();

    // Officer sign-ins are part of the same activity trail as the rest of
    // their KYC-pipeline actions (see officerController.js) — the admin
    // Audit Log page already filters by actor type 'officer'.
    if (admin.role === 'officer') {
      logAudit({
        action: 'officer.login.success',
        category: 'auth',
        severity: 'info',
        message: `${admin.name || admin.email} logged in`,
        actor: { type: 'officer', id: admin._id, email: admin.email, name: admin.name },
        req,
      });
    }

    res.json({
      success: true,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        lastLogin: admin.lastLogin,
      },
      token: generateToken(admin._id, '12h')
    });
  } catch (error) {
    console.error('Verify OTP error:', error?.message || error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};
