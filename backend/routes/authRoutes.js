import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, verifyOTP, getMe, updateMe, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  registerMerchant,
  verifyMerchantOTP,
  loginMerchant,
  biometricLogin,
  resendMerchantOTP,
  forgotPassword,
  resetPassword,
  changeMerchantPassword,
  getMerchantMe,
  updateMerchantProfile,
  toggleBiometrics,
  setAppPin,
  validateSetupToken,
  setupPassword
} from '../controllers/merchantAuthController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

// ── Rate limiters for credential-validation endpoints ─────────────────────────
// Admin login: 5 attempts / 15 min / IP. Throws 429 with a generic message; never
// hints whether the email exists. Keys by IP via trust-proxy in server.js.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Admin OTP verify: 10 attempts / 15 min / IP. Slightly more lenient since users
// may mistype the 6-digit code.
const adminOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Restart the login flow.' },
});

// Merchant equivalents — 10 / 15 min to accommodate higher merchant volume.
const merchantLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const merchantOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Restart the login flow.' },
});

// Admin Auth Routes
router.post('/login', adminLoginLimiter, login);
router.post('/verify-otp', adminOtpLimiter, verifyOTP);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/password', protect, changePassword);

// Merchant Auth Routes
router.post('/merchant/register', upload.single('certificate'), registerMerchant);
router.post('/merchant/verify-otp', merchantOtpLimiter, verifyMerchantOTP);
router.post('/merchant/login', merchantLoginLimiter, loginMerchant);
router.post('/merchant/biometric-login', merchantLoginLimiter, biometricLogin);
router.post('/merchant/resend-otp', merchantOtpLimiter, resendMerchantOTP);
router.post('/merchant/forgot-password', merchantLoginLimiter, forgotPassword);
router.post('/merchant/reset-password', merchantOtpLimiter, resetPassword);
router.get('/merchant/setup-password/:token', validateSetupToken);
router.post('/merchant/setup-password', merchantOtpLimiter, setupPassword);
router.put('/merchant/change-password', protectMerchant, changeMerchantPassword);
router.get('/merchant/me', protectMerchant, getMerchantMe);
router.put('/merchant/profile', protectMerchant, updateMerchantProfile);
router.put('/merchant/biometrics', protectMerchant, toggleBiometrics);
router.post('/merchant/set-app-pin', protectMerchant, setAppPin);

export default router;
