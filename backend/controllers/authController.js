import crypto from 'crypto';
import Admin from '../models/Admin.js';
import { sendOTP } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';

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
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
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
    await admin.save();

    res.json({
      success: true,
      admin: {
        _id: admin._id,
        email: admin.email
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
