import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import { sendOTP, sendWelcomeEmail, sendPasswordResetConfirmation } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import generateToken from '../utils/generateToken.js';
import { provisionMerchantWallet, getWalletBalance } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import bcrypt from 'bcryptjs';
import { createNotification } from './notificationController.js';

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
  try {
    let { name, email, phone, businessName, password, registrationSource, kraPin, businessNumber } = req.body || {};
    const certificateFile = req.file;

    if (phone) phone = String(phone).replace(/\s+/g, '');
    if (email) email = String(email).trim().toLowerCase();
    if (kraPin) kraPin = String(kraPin).trim().toUpperCase();
    if (businessNumber) businessNumber = String(businessNumber).trim();

    if (!name?.trim() || !email || !phone || !businessName?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, phone, business name and password are all required.' });
    }

    // Build phone variations (handles 0790…, 254790…, +254790…, 790…) to
    // catch duplicates regardless of stored format.
    const phoneBase = (() => {
      let b = phone;
      if (b.startsWith('+254')) b = b.substring(4);
      else if (b.startsWith('254')) b = b.substring(3);
      else if (b.startsWith('0')) b = b.substring(1);
      return b;
    })();
    const phoneVars = Array.from(new Set([phone, phoneBase, `0${phoneBase}`, `254${phoneBase}`, `+254${phoneBase}`]));

    const NO_PASSWORD_MSG = 'An account with these details already exists but has no password set. Use "Reset Password" to create one and gain access.';

    const existingByEmail = await Merchant.findOne({ email }).select('+password');
    if (existingByEmail) {
      const msg = !existingByEmail.password ? NO_PASSWORD_MSG : 'A merchant with that email already exists.';
      return res.status(400).json({ error: msg });
    }

    const existingByPhone = await Merchant.findOne({ phone: { $in: phoneVars } }).select('+password');
    if (existingByPhone) {
      const msg = !existingByPhone.password ? NO_PASSWORD_MSG : 'A merchant with that phone number already exists.';
      return res.status(400).json({ error: msg });
    }

    if (kraPin && await Merchant.exists({ kraPin })) {
      return res.status(400).json({ error: 'A merchant with that KRA PIN already exists.' });
    }
    if (businessNumber && await Merchant.exists({ businessNumber })) {
      return res.status(400).json({ error: 'A merchant with that business registration number already exists.' });
    }

    const certificateUrl = certificateFile ? certificateFile.path : null;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const paybillAccount = await generateUniquePaybillAccount();

    const merchant = await Merchant.create({
      name,
      email,
      phone,
      businessName,
      kraPin: kraPin || null,
      businessNumber: businessNumber || null,
      password,
      certificateUrl,
      otp,
      otpExpires,
      paybillAccount,
      kesBalance: 0,
      usdcBalance: 0,
      isVerified: true,
      registrationSource: registrationSource === 'mobile' ? 'mobile' : 'web'
    });

    console.log(`📧 Dispatching Welcome Email to: ${merchant.email}`);
    sendWelcomeEmail(merchant.email, merchant.name, password, merchant.phone, merchant.paybillAccount).catch(err => {
      console.error(`📧 Resend Error: Failed to send Welcome Email to ${merchant.email}:`, err);
    });

    logAudit({
      action: 'merchant.signup', category: 'auth', severity: 'success',
      message: `Merchant signed up — ${merchant.businessName || merchant.email}`,
      merchant, req,
      metadata: { source: merchant.registrationSource || 'web' },
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Account created.',
      email: merchant.email
    });
  } catch (error) {
    console.error('Register Merchant Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const labels = {
        email: 'email',
        phone: 'phone number',
        kraPin: 'KRA PIN',
        businessNumber: 'business registration number',
        paybillAccount: 'paybill account',
      };
      const label = labels[key] || 'detail';
      return res.status(400).json({ error: `A merchant with that ${label} already exists.` });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Verify Merchant OTP
// @route   POST /api/auth/merchant/verify-otp
// @access  Public
export const verifyMerchantOTP = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const merchant = await Merchant.findOne({ email }).select('+password +bulkPayPin');

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

    logAudit({
      action: 'merchant.login.success', category: 'auth', severity: 'success',
      message: 'Signed in successfully',
      merchant, req,
      metadata: { loginCount: merchant.loginCount, method: 'password+otp' },
    });

    createNotification({
      merchantId: merchant._id,
      kind: 'security',
      title: 'New sign-in detected',
      message: 'Your account was just accessed with a verified sign-in code.',
    });

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
        isKRAVerified: merchant.isKRAVerified,
        settlementMobile: merchant.settlementMobile,
        settlementBankName: merchant.settlementBankName,
        settlementBankAccount: merchant.settlementBankAccount,
        hasBulkPayPin: !!merchant.bulkPayPin,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled,
        features: merchant.features
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
  try {
    const { email, password } = req.body || {};
    let loginIdentifier = email ? email.trim() : '';

    let phoneVariations = [loginIdentifier];
    if (!loginIdentifier.includes('@')) {
      let cleanPhone = loginIdentifier.replace(/\s+/g, '');
      if (cleanPhone.startsWith('+254')) cleanPhone = cleanPhone.substring(4);
      else if (cleanPhone.startsWith('254')) cleanPhone = cleanPhone.substring(3);
      else if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
      phoneVariations = [cleanPhone, `0${cleanPhone}`, `254${cleanPhone}`, `+254${cleanPhone}`];
    }

    const merchant = await Merchant.findOne({
      $or: [
        { email: loginIdentifier },
        { phone: { $in: phoneVariations } }
      ]
    }).select('+password +bulkPayPin');
    
    if (!merchant) {
      logAudit({
        action: 'merchant.login.failed', category: 'auth', severity: 'warning',
        message: `Failed sign-in — no account for "${loginIdentifier}"`,
        req, metadata: { identifier: loginIdentifier, reason: 'no_account' },
      });
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    if (!merchant.password) {
      logAudit({
        action: 'merchant.login.failed', category: 'auth', severity: 'warning',
        message: 'Failed sign-in — account has no password (admin-onboarded)',
        merchant, req, metadata: { reason: 'no_password' },
      });
      return res.status(401).json({ error: 'Your account was set up without a password. Please use "Reset Password" to create one.' });
    }

    const isMatch = await merchant.matchPassword(password);
    if (!isMatch) {
      logAudit({
        action: 'merchant.login.failed', category: 'auth', severity: 'warning',
        message: 'Failed sign-in — incorrect password',
        merchant, req, metadata: { reason: 'bad_password' },
      });
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    if (merchant.status === 'locked') {
      logAudit({
        action: 'merchant.login.blocked', category: 'security', severity: 'critical',
        message: 'Sign-in blocked — account is locked',
        merchant, req,
      });
      return res.status(403).json({ error: 'This account has been locked. Please contact PayChain support.' });
    }

    // Always require OTP verification for every login (removed 3-day bypass)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Fire email and DB write in parallel — don't wait for one before the other
    console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
    await Promise.all([
      Merchant.updateOne({ _id: merchant._id }, { $set: { otp, otpExpires } }),
      sendOTP(merchant.email, otp).catch(err => {
        console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
      }),
    ]);

    logAudit({
      action: 'merchant.login.otp_requested', category: 'auth', severity: 'info',
      message: 'Password validated — OTP dispatched',
      merchant, req,
    });

    return res.json({
      success: true,
      mfaRequired: true,
      email: merchant.email,
      message: 'OTP sent to your email. Proceed to Stage 2.'
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
    const merchant = await Merchant.findOne({ email }).select('+bulkPayPin');

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid biometric credential' });
    }

    if (merchant.status === 'locked') {
      return res.status(403).json({ error: 'This account has been locked. Please contact PayChain support.' });
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

    logAudit({
      action: 'merchant.login.biometric', category: 'auth', severity: 'success',
      message: 'Signed in via biometrics / passkey',
      merchant, req,
      metadata: { loginCount: merchant.loginCount, method: 'biometric' },
    });

    createNotification({
      merchantId: merchant._id,
      kind: 'security',
      title: 'New sign-in detected',
      message: `Your account was accessed via biometrics from a device in ${merchant.loginHistory[0]?.location || 'an unknown location'}.`,
    });

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
        kesBalance: merchant.kesBalance,
        usdcBalance: merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status: merchant.status,
        loginCount: merchant.loginCount,
        settlementMobile: merchant.settlementMobile,
        settlementBankName: merchant.settlementBankName,
        settlementBankAccount: merchant.settlementBankAccount,
        hasBulkPayPin: !!merchant.bulkPayPin,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled,
        features: merchant.features
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
  try {
    const { email } = req.body || {};
    const merchant = await Merchant.findOne({ email });

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`📧 Dispatching Resend OTP via Resend to: ${merchant.email}`);
    await Promise.all([
      Merchant.updateOne({ _id: merchant._id }, { $set: { otp, otpExpires } }),
      sendOTP(merchant.email, otp).catch(err => {
        console.error(`📧 Resend Error: Failed to resend OTP to ${merchant.email}:`, err);
      }),
    ]);

    res.json({ success: true, message: 'New security code sent successfully.' });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Mask an email for safe display in the UI: jane@example.com → j••e@e••••e.com
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

// @desc    Forgot Password — step 1 of 3. Mints a 6-digit OTP (10 min TTL)
//          and emails it to the merchant's registered address. Always
//          responds 200 success to prevent account enumeration; the OTP
//          only dispatches when a real account matched.
// @route   POST /api/auth/merchant/forgot-password
// @access  Public (rate-limited at the route layer)
export const forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  try {
    const lookup = String(email || '').trim();
    if (!lookup) {
      return res.status(400).json({ error: 'Enter your email or registered phone number.' });
    }

    const merchant = await Merchant.findOne({
      $or: [{ email: lookup.toLowerCase() }, { phone: lookup }],
    });

    if (merchant) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      console.log(`📧 Reset OTP → ${merchant.email}`);
      await Promise.all([
        // Fresh reset attempt invalidates any prior reset token
        Merchant.updateOne({ _id: merchant._id }, {
          $set: { otp, otpExpires, passwordResetToken: null, passwordResetExpires: null },
        }),
        sendOTP(merchant.email, otp).catch((err) => {
          console.error(`📧 Reset OTP send failed for ${merchant.email}:`, err);
        }),
      ]);

      logAudit({
        action: 'merchant.password.reset_requested', category: 'security', severity: 'warning',
        message: 'Password reset requested — OTP dispatched',
        merchant, req,
        metadata: { lookup: lookup.includes('@') ? 'email' : 'phone' },
      });
    } else {
      // Still log the attempt so we can spot enumeration / spray attacks.
      logAudit({
        action: 'merchant.password.reset_attempt_unknown', category: 'security', severity: 'warning',
        message: `Reset requested for unknown identifier "${lookup}"`,
        req, metadata: { identifier: lookup },
      });
    }

    res.json({
      success: true,
      message: 'If an account exists, a 6-digit verification code has been sent.',
      // Echoes the masked address ONLY when a real account matched, so the UI
      // can render "code sent to j••e@e••••e.com" without leaking unknowns.
      maskedEmail: merchant ? maskEmail(merchant.email) : null,
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Verify Reset OTP — step 2 of 3. Validates the 6-digit code
//          (timing-safe), clears it, and mints a single-use sha256-hashed
//          reset token (15 min TTL) returned to the caller. The caller
//          must present this token to set the new password — meaning the
//          OTP itself never has to leave the client again.
// @route   POST /api/auth/merchant/verify-reset-otp
// @access  Public (rate-limited at the route layer)
export const verifyResetOTP = async (req, res) => {
  const { email, otp } = req.body || {};
  try {
    const lookup = String(email || '').trim();
    if (!lookup || !/^\d{6}$/.test(String(otp || ''))) {
      return res.status(400).json({ error: 'Email and 6-digit code are required.' });
    }

    const merchant = await Merchant.findOne({
      $or: [{ email: lookup.toLowerCase() }, { phone: lookup }],
    });

    if (!merchant || !merchant.otp || !merchant.otpExpires) {
      return res.status(400).json({ error: 'Invalid code. Request a new one and try again.' });
    }

    // Timing-safe OTP comparison.
    const provided = Buffer.from(String(otp).padEnd(6));
    const stored   = Buffer.from(String(merchant.otp).padEnd(6));
    if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) {
      return res.status(400).json({ error: 'Invalid code. Check your inbox and try again.' });
    }

    if (new Date() > merchant.otpExpires) {
      return res.status(400).json({ error: 'Code has expired. Request a new one.' });
    }

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    merchant.passwordResetToken   = hashedToken;
    merchant.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    merchant.otp = null;
    merchant.otpExpires = null;
    await merchant.save();

    logAudit({
      action: 'merchant.password.reset_verified', category: 'security', severity: 'info',
      message: 'Reset OTP verified — reset token minted',
      merchant, req,
    });

    res.json({
      success: true,
      message: 'Code verified. Set your new password to continue.',
      resetToken: rawToken,
      expiresInSeconds: 15 * 60,
    });
  } catch (error) {
    console.error('Verify Reset OTP Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reset Password — step 3 of 3. Validates the reset token, sets
//          the new password (Merchant pre-save hook bcrypt-hashes at 12
//          rounds), clears all reset state, and fires a confirmation
//          email so the merchant has an audit trail. We intentionally do
//          NOT email the plaintext password — that's a long-recognised
//          anti-pattern (the email lives in inbox + backups + ESP logs
//          indefinitely). Legacy `{ email, otp, newPassword }` shape is
//          still accepted for backward-compat with older clients.
// @route   POST /api/auth/merchant/reset-password
// @access  Public (rate-limited at the route layer)
export const resetPassword = async (req, res) => {
  const { resetToken, email, otp, newPassword } = req.body || {};
  try {
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    let merchant;

    if (resetToken) {
      const hashedToken = crypto.createHash('sha256').update(String(resetToken)).digest('hex');
      merchant = await Merchant.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      }).select('+passwordResetToken +passwordResetExpires +password');
      if (!merchant) {
        return res.status(401).json({
          error: 'This reset link has expired. Start the password reset flow again.',
        });
      }
    } else if (email && otp) {
      // Legacy single-shot path (kept so older mobile builds keep working).
      const lookup = String(email).trim().toLowerCase();
      merchant = await Merchant.findOne({ email: lookup }).select('+password');
      if (!merchant || !merchant.otp || merchant.otp !== String(otp)) {
        return res.status(401).json({ error: 'Invalid verification code.' });
      }
      if (!merchant.otpExpires || new Date() > merchant.otpExpires) {
        return res.status(401).json({ error: 'Verification code has expired.' });
      }
    } else {
      return res.status(400).json({ error: 'Reset token (or email + code) is required.' });
    }

    merchant.password = String(newPassword);
    merchant.otp = null;
    merchant.otpExpires = null;
    merchant.passwordResetToken = null;
    merchant.passwordResetExpires = null;
    await merchant.save();

    // Confirmation email — paper trail + recovery path if it wasn't them.
    const when = new Date().toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short',
    });
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
    const ua = String(req.headers['user-agent'] || 'unknown device').slice(0, 200);

    sendPasswordResetConfirmation(merchant.email, merchant.name, when, ip, ua)
      .catch((err) => console.error('📧 Reset confirmation email failed:', err));

    logAudit({
      action: 'merchant.password.reset_completed', category: 'security', severity: 'critical',
      message: 'Password reset completed — receipt email dispatched',
      merchant, req,
      metadata: { via: resetToken ? 'reset_token' : 'legacy_otp' },
    });

    res.json({
      success: true,
      message: 'Password has been reset. Sign in with your new password.',
    });
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
      logAudit({
        action: 'merchant.password.change_failed', category: 'security', severity: 'warning',
        message: 'In-dashboard password change failed — wrong current password',
        merchant, req,
      });
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    merchant.password = newPassword;
    await merchant.save();

    logAudit({
      action: 'merchant.password.changed', category: 'security', severity: 'critical',
      message: 'Password changed from dashboard (authenticated)',
      merchant, req,
    });

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
    const merchant = await Merchant.findById(req.merchant._id).select('+bulkPayPin +appPin');
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
        isKRAVerified: merchant.isKRAVerified,
        settlementMobile: merchant.settlementMobile,
        settlementBankName: merchant.settlementBankName,
        settlementBankAccount: merchant.settlementBankAccount,
        hasBulkPayPin: !!merchant.bulkPayPin,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled,
        features: merchant.features
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
    const merchant = await Merchant.findById(req.merchant._id).select('+bulkPayPin');
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const { kraPin, businessNumber, settlementMobile, settlementBankName, settlementBankAccount } = req.body;
    
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

    const changedFields = [];
    if (businessNumber !== undefined && businessNumber !== merchant.businessNumber) {
      merchant.businessNumber = businessNumber; changedFields.push('businessNumber');
    }
    if (settlementMobile !== undefined && settlementMobile !== merchant.settlementMobile) {
      merchant.settlementMobile = settlementMobile; changedFields.push('settlementMobile');
    }
    if (settlementBankName !== undefined && settlementBankName !== merchant.settlementBankName) {
      merchant.settlementBankName = settlementBankName; changedFields.push('settlementBankName');
    }
    if (settlementBankAccount !== undefined && settlementBankAccount !== merchant.settlementBankAccount) {
      merchant.settlementBankAccount = settlementBankAccount; changedFields.push('settlementBankAccount');
    }

    await merchant.save();

    if (changedFields.length > 0 || kraPin) {
      const fields = [...changedFields];
      if (kraPin) fields.push('kraPin');
      logAudit({
        action: 'merchant.profile.updated', category: 'profile', severity: 'info',
        message: `Profile updated — ${fields.join(', ')}`,
        merchant, req,
        metadata: { fields },
      });
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
        isKRAVerified: merchant.isKRAVerified,
        settlementMobile: merchant.settlementMobile,
        settlementBankAccount: merchant.settlementBankAccount,
        hasBulkPayPin: !!merchant.bulkPayPin,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled
      }
    });
  } catch (error) {
    console.error('Update Merchant Profile Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle Biometrics
// @route   PUT /api/auth/merchant/biometrics
// @access  Private (Merchant)
export const toggleBiometrics = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const wasEnabled = !!merchant.biometricsEnabled;
    const nowEnabled = !!req.body.enabled;
    merchant.biometricsEnabled = nowEnabled;
    await merchant.save();

    if (wasEnabled !== nowEnabled) {
      logAudit({
        action: nowEnabled ? 'merchant.biometrics.enabled' : 'merchant.biometrics.disabled',
        category: 'security',
        severity: nowEnabled ? 'success' : 'warning',
        message: `Biometric sign-in ${nowEnabled ? 'enabled' : 'disabled'}`,
        merchant, req,
      });
    }

    res.json({
      success: true,
      message: `Biometrics ${merchant.biometricsEnabled ? 'enabled' : 'disabled'} successfully`,
      biometricsEnabled: merchant.biometricsEnabled
    });
  } catch (error) {
    console.error('Toggle Biometrics Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Validate a password-setup token (admin-invite flow). Lets the
//          frontend decide whether to render the form or a "link expired" view.
//          Returns minimal info (email) and never leaks reset metadata.
// @route   GET /api/auth/merchant/setup-password/:token
// @access  Public
export const validateSetupToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const merchant = await Merchant.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires email name businessName');

    if (!merchant) {
      return res.status(400).json({ error: 'This setup link is invalid or has expired.' });
    }

    res.json({
      success: true,
      data: {
        email: merchant.email,
        name: merchant.name,
        businessName: merchant.businessName,
      },
    });
  } catch (error) {
    console.error('Validate Setup Token Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Consume a password-setup token and set the merchant's password.
//          Pre-save bcrypt hook handles hashing (12 rounds). The reset token
//          is cleared on success — single-use semantics.
// @route   POST /api/auth/merchant/setup-password
// @access  Public
export const setupPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const merchant = await Merchant.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!merchant) {
      return res.status(400).json({ error: 'This setup link is invalid or has expired.' });
    }

    merchant.password = password;
    merchant.passwordResetToken = null;
    merchant.passwordResetExpires = null;
    merchant.isVerified = true;
    await merchant.save();

    // Send confirmation email with their official credentials so the merchant
    // has a record of their username (email/phone) and the password they just set.
    // Fire-and-forget — never block the response on email delivery.
    sendWelcomeEmail(merchant.email, merchant.name, password, merchant.phone, merchant.paybillAccount)
      .catch((err) => console.error(`📧 Failed to send credentials email to ${merchant.email}:`, err));

    res.json({ success: true, message: 'Password set successfully. You can now sign in.' });
  } catch (error) {
    console.error('Setup Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Set Mobile App PIN
// @route   POST /api/auth/merchant/set-app-pin
// @access  Private (Merchant)
export const setAppPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length !== 4) {
      return res.status(400).json({ error: 'A valid 4-digit PIN is required' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Hash the 4-digit PIN using bcrypt (12 rounds = OWASP 2024 baseline).
    const salt = await bcrypt.genSalt(12);
    merchant.appPin = await bcrypt.hash(pin, salt);
    
    await merchant.save();

    res.json({
      success: true,
      message: 'Payment PIN set successfully.',
      hasAppPin: true,
    });
  } catch (error) {
    console.error('Set App PIN Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Verify Payment PIN (used before authorising money movements)
// @route   POST /api/auth/merchant/verify-payment-pin
// @access  Private (Merchant)
export const verifyPaymentPin = async (req, res) => {
  try {
    const { pin } = req.body || {};
    if (!pin || String(pin).length !== 4) {
      return res.status(400).json({ error: 'A valid 4-digit PIN is required.' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    if (!merchant.appPin) {
      return res.status(400).json({ error: 'No payment PIN has been set. Please set one first.', pinNotSet: true });
    }

    const isMatch = await bcrypt.compare(String(pin), merchant.appPin);
    if (!isMatch) {
      logAudit({
        action: 'merchant.payment_pin.failed', category: 'security', severity: 'warning',
        message: 'Payment PIN verification failed',
        merchant, req,
      });
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }

    logAudit({
      action: 'merchant.payment_pin.verified', category: 'security', severity: 'info',
      message: 'Payment PIN verified successfully',
      merchant, req,
    });

    res.json({ success: true, message: 'PIN verified.' });
  } catch (error) {
    console.error('Verify Payment PIN Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
