import Merchant from '../models/Merchant.js';
import { sendOTP } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';

// @desc    Register a new merchant
// @route   POST /api/auth/merchant/register
// @access  Public
export const registerMerchant = async (req, res) => {
  const { name, email, phone, businessName, password } = req.body;
  const certificateFile = req.file;

  try {
    const merchantExists = await Merchant.findOne({ email });

    if (merchantExists) {
      return res.status(400).json({ error: 'Merchant already exists' });
    }

    const certificateUrl = certificateFile ? certificateFile.path : null;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const merchant = await Merchant.create({
      name,
      email,
      phone,
      businessName,
      password,
      certificateUrl,
      otp,
      otpExpires,
      isVerified: false
    });

    if (merchant) {
      console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
      sendOTP(merchant.email, otp).catch(err => {
        console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify OTP sent to your email.',
        email: merchant.email
      });
    } else {
      res.status(400).json({ error: 'Invalid merchant data' });
    }
  } catch (error) {
    console.error('Register Merchant Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Verify Merchant OTP
// @route   POST /api/auth/merchant/verify-otp
// @access  Public
export const verifyMerchantOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const merchant = await Merchant.findOne({ email });

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    if (!merchant.otp || merchant.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (new Date() > merchant.otpExpires) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    merchant.otp = null;
    merchant.otpExpires = null;
    merchant.isVerified = true;
    await merchant.save();

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        businessName: merchant.businessName
      },
      token: generateToken(merchant._id)
    });
  } catch (error) {
    console.error('Verify Merchant OTP Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Login Merchant
// @route   POST /api/auth/merchant/login
// @access  Public
export const loginMerchant = async (req, res) => {
  const { email, password } = req.body;
  const loginIdentifier = email; // can be phone or email

  try {
    const merchant = await Merchant.findOne({ 
      $or: [{ email: loginIdentifier }, { phone: loginIdentifier }] 
    }).select('+password');
    
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    const isMatch = await merchant.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    merchant.otp = otp;
    merchant.otpExpires = otpExpires;
    await merchant.save();

    console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
    sendOTP(merchant.email, otp).catch(err => {
      console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
    });

    res.json({ 
      success: true, 
      mfaRequired: true, 
      email: merchant.email,
      message: 'OTP sent to your email. Proceed to Stage 2.' 
    });
  } catch (error) {
    console.error('Login Merchant Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/merchant/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      // Don't leak whether the email exists or not for security reasons
      return res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    merchant.otp = otp;
    merchant.otpExpires = otpExpires;
    await merchant.save();

    console.log(`📧 Dispatching Forgot Password OTP via Resend to: ${merchant.email}`);
    sendOTP(merchant.email, otp).catch(err => {
      console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
    });

    res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/merchant/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    if (!merchant.otp || merchant.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (new Date() > merchant.otpExpires) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    merchant.password = newPassword;
    merchant.otp = null;
    merchant.otpExpires = null;
    await merchant.save();

    res.json({ success: true, message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
