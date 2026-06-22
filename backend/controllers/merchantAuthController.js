import Merchant from '../models/Merchant.js';
import { sendOTP, sendWelcomeEmail } from '../utils/resend.js';
import generateToken from '../utils/generateToken.js';
import { provisionMerchantWallet, getWalletBalance } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';

// Helper to generate unique 5-digit account number
const generateUniquePaybillAccount = async () => {
  let isUnique = false;
  let accountNum;
  while (!isUnique) {
    accountNum = Math.floor(10000 + Math.random() * 90000).toString();
    const existing = await Merchant.findOne({ paybillAccount: accountNum });
    if (!existing) isUnique = true;
  }
  return accountNum;
};

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

    const paybillAccount = await generateUniquePaybillAccount();

    const merchant = await Merchant.create({
      name,
      email,
      phone,
      businessName,
      password,
      certificateUrl,
      otp,
      otpExpires,
      paybillAccount,
      kesBalance: 0,
      usdcBalance: 0,
      stellarPublicKey: null,
      stellarEncryptedSecretKey: null,
      isVerified: true // The user requested immediate login redirection, setting isVerified true for smoother flow.
    });

    if (merchant) {
      console.log(`📧 Dispatching Welcome Email to: ${merchant.email}`);
      sendWelcomeEmail(merchant.email, merchant.name, password, merchant.phone, merchant.paybillAccount).catch(err => {
        console.error(`📧 Resend Error: Failed to send Welcome Email to ${merchant.email}:`, err);
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Account created.',
        email: merchant.email
      });
    } else {
      res.status(400).json({ error: 'Invalid merchant data' });
    }
  } catch (error) {
    console.error('Register Merchant Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    // Check for unique email constraint error
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Merchant already exists' });
    }
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
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.lastLogin = new Date();
    await merchant.save();

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        kesBalance: merchant.kesBalance,
        isVerified: merchant.isVerified,
        createdAt: merchant.createdAt,
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        kraPin: merchant.kraPin,
        businessNumber: merchant.businessNumber,
        isKRAVerified: merchant.isKRAVerified
      },
      token: generateToken(merchant._id)
    });
  } catch (error) {
    console.error('Verify Merchant OTP Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
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

    // Check if account has been logged in within the last 3 days
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const needsOTP = !merchant.lastLogin || (now - new Date(merchant.lastLogin)) > THREE_DAYS_MS;

    if (needsOTP) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      merchant.otp = otp;
      merchant.otpExpires = otpExpires;
      await merchant.save();

      console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
      sendOTP(merchant.email, otp).catch(err => {
        console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
      });

      return res.json({ 
        success: true, 
        mfaRequired: true, 
        email: merchant.email,
        message: 'OTP sent to your email. Proceed to Stage 2.' 
      });
    }

    // Direct login (within 3 days)
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.lastLogin = now;
    
    merchant.loginHistory = merchant.loginHistory || [];
    merchant.loginHistory.unshift({
      timestamp: now,
      device: req.headers['user-agent']?.substring(0, 40) || 'Unknown Device',
      ip: req.ip || req.connection.remoteAddress,
      location: 'Nairobi, KE' // Mock
    });
    if (merchant.loginHistory.length > 10) {
      merchant.loginHistory = merchant.loginHistory.slice(0, 10);
    }
    
    await merchant.save();

    res.json({
      success: true,
      mfaRequired: false,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        status: merchant.status,
        loginCount: merchant.loginCount
      },
      token: generateToken(merchant._id)
    });
  } catch (error) {
    console.error('Login Merchant Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Biometric Login (Demo Bypass)
// @route   POST /api/auth/merchant/biometric-login
// @access  Public
export const biometricLogin = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required for biometric lookup' });
  }

  try {
    const merchant = await Merchant.findOne({ email });

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid biometric credential' });
    }

    if (merchant.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Since biometrics verified at the OS level, we bypass password check.
    // Skip 2FA/OTP for biometrics since it's already multi-factor (device + inherent).
    
    // Increment login count & log history
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.loginHistory = merchant.loginHistory || [];
    merchant.loginHistory.unshift({
      timestamp: new Date(),
      device: req.headers['user-agent']?.substring(0, 40) || 'Unknown Device',
      ip: req.ip || req.connection.remoteAddress,
      location: 'Nairobi, KE' // Mock
    });
    
    // Keep max 10 logs
    if (merchant.loginHistory.length > 10) {
      merchant.loginHistory = merchant.loginHistory.slice(0, 10);
    }
    
    await merchant.save();

    res.json({
      success: true,
      mfaRequired: false,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        status: merchant.status,
        loginCount: merchant.loginCount
      },
      token: generateToken(merchant._id)
    });
  } catch (error) {
    console.error('Biometric Login Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Resend Merchant OTP
// @route   POST /api/auth/merchant/resend-otp
// @access  Public
export const resendMerchantOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const merchant = await Merchant.findOne({ email });

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    merchant.otp = otp;
    merchant.otpExpires = otpExpires;
    await merchant.save();

    console.log(`📧 Dispatching Resend OTP via Resend to: ${merchant.email}`);
    sendOTP(merchant.email, otp).catch(err => {
      console.error(`📧 Resend Error: Failed to resend OTP to ${merchant.email}:`, err);
    });

    res.json({ success: true, message: 'New security code sent successfully.' });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/merchant/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const merchant = await Merchant.findOne({ 
      $or: [{ email: email }, { phone: email }] 
    });
    if (!merchant) {
      return res.status(404).json({ error: 'No account found with that email or phone number.' });
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

// @desc    Change Password (Authenticated)
// @route   PUT /api/auth/merchant/change-password
// @access  Private (Merchant)
export const changeMerchantPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+password');
    if (!merchant) {
      return res.status(401).json({ error: 'Merchant not found' });
    }

    const isMatch = await merchant.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    merchant.password = newPassword;
    await merchant.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get current merchant profile
// @route   GET /api/auth/merchant/me
// @access  Private (Merchant)
export const getMerchantMe = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Sync on-chain USDC balance if wallet exists
    if (merchant.stellarPublicKey) {
      try {
        const liveBalance = await getWalletBalance(merchant.stellarPublicKey);
        if (liveBalance !== merchant.usdcBalance) {
          merchant.usdcBalance = liveBalance;
          await merchant.save();
        }
      } catch (e) {
        console.warn('⚠️ Failed to sync live USDC balance:', e.message);
      }
    }

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        kesBalance: merchant.kesBalance,
        usdcBalance: merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        isVerified: merchant.isVerified,
        createdAt: merchant.createdAt,
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        kraPin: merchant.kraPin,
        businessNumber: merchant.businessNumber,
        isKRAVerified: merchant.isKRAVerified
      }
    });
  } catch (error) {
    console.error('Get Merchant Me Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update merchant profile
// @route   PUT /api/auth/merchant/profile
// @access  Private (Merchant)
export const updateMerchantProfile = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const { kraPin, businessNumber } = req.body;
    
    // Validate KRA Pin and Mock eTIMS API
    if (kraPin !== undefined && kraPin !== merchant.kraPin) {
      // Simulate external API network latency
      await new Promise(r => setTimeout(r, 1500));
      
      const kraRegex = /^[AP][0-9]{9}[A-Z]$/i;
      if (!kraRegex.test(kraPin)) {
        return res.status(400).json({ 
          error: 'eTIMS Verification Failed: The KRA PIN provided is invalid or not registered with KRA. Format expected: P123456789A' 
        });
      }
      
      merchant.kraPin = kraPin.toUpperCase();
      merchant.isKRAVerified = true;
    }

    if (businessNumber !== undefined) merchant.businessNumber = businessNumber;

    await merchant.save();

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        kesBalance: merchant.kesBalance,
        isVerified: merchant.isVerified,
        createdAt: merchant.createdAt,
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        kraPin: merchant.kraPin,
        businessNumber: merchant.businessNumber,
        isKRAVerified: merchant.isKRAVerified
      }
    });
  } catch (error) {
    console.error('Update Merchant Profile Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
