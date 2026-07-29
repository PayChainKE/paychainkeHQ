import crypto from 'crypto';
import Admin from '../models/Admin.js';
import { sendOTP } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';
import { logAudit } from '../utils/auditLog.js';

// Cryptographically generate a 6-digit OTP (avoids Math.random predictability).
function generateOtp() {
  // crypto.randomInt is uniformly distributed and safe for credential material.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
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
    // password is select:false on the schema; explicit opt-in for the compare.
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!admin) {
      // Same error + status as bad-password to avoid email enumeration.
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    admin.otp = otp;
    admin.otpExpires = otpExpires;
    await admin.save();

    // Dispatch async; never log the OTP value.
    sendOTP(admin.email, otp).catch(err => {
      console.error('OTP dispatch failed:', err?.message || err);
    });

    res.json({
      success: true,
      mfaRequired: true,
      email: admin.email,
      message: 'OTP sent to your email. Proceed to Stage 2.'
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

  if (!email || !submittedOtp) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  try {
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

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
