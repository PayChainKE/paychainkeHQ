import Admin from '../models/Admin.js';
import { sendOTP } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';

// @desc    Stage 1: Identity Verification (Email/Password -> OTP)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`🔑 DEBUG: Login attempt for email: [${email}]`);
  console.log(`🔑 DEBUG: Password length: ${password?.length}`);
  console.log(`🔑 Login attempt started for: ${email}`);

  try {
    // 1. Find Admin
    
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log(`❌ Admin not found: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log(`✅ Admin found: ${email}`);

    // 2. Compare Password
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      console.log(`❌ Password mismatch for: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log(`✅ Password matched for: ${email}`);

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 4. Save to DB
    admin.otp = otp;
    admin.otpExpires = otpExpires;
    await admin.save();
    console.log(`💾 OTP [${otp}] saved to DB for: ${email}`);

    // 5. Send via Resend (Non-blocking for faster response)
    console.log(`📧 Dispatching OTP via Resend to: ${admin.email}`);
    sendOTP(admin.email, otp).catch(err => {
      console.error(`📧 Resend Error: Failed to send OTP to ${admin.email}:`, err);
    });

    // 6. Success Response
    res.json({ 
      success: true, 
      mfaRequired: true, 
      email,
      message: 'OTP sent to your email. Proceed to Stage 2.' 
    });
  } catch (error) {
    console.error('Login Error:', error);
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
  const submittedOtp = otp || otpCode;

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    // Check if OTP exists and matches
    if (!admin.otp || admin.otp !== submittedOtp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Check if OTP is expired
    if (new Date() > admin.otpExpires) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    // Valid OTP - Clear it and issue JWT
    admin.otp = null;
    admin.otpExpires = null;
    await admin.save();

    res.json({
      success: true,
      admin: {
        _id: admin._id,
        email: admin.email
      },
      token: generateToken(admin._id)
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};
