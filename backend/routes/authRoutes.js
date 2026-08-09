import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, verifyOTP, getMe, updateMe, changePassword } from '../controllers/authController.js';
import { validateSetupToken as validateAdminSetupToken, setupPasswordWithToken } from '../controllers/teamController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getLoginOptions,
  verifyLogin,
  getPasskeys,
  deletePasskey,
  renamePasskey,
} from '../controllers/webauthnController.js';
import {
  registerMerchant,
  verifyMerchantOTP,
  loginMerchant,
  resendMerchantOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  changeMerchantPassword,
  getSecurityQuestions,
  updateSecurityQuestions,
  getSecurityHistory,
  signOutAllDevices,
  getMerchantMe,
  updateMerchantProfile,
  toggleBiometrics,
  setAppPin,
  verifyPaymentPin,
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

// PIN endpoints guard a 4-digit code (10,000 combinations) with a valid
// session already in hand — IP rate limiting alone doesn't stop a botnet,
// but it closes the trivial single-IP brute force this had zero protection
// against before.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

// Per-IP limiting alone doesn't stop a distributed/IP-rotating attacker
// from spamming one specific victim's phone/email with reset OTPs
// (harassment, not just brute force) — keyed on the submitted identifier
// instead of the caller's IP, stacked on top of merchantLoginLimiter below.
const forgotPasswordAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'unknown',
  message: { error: 'Too many reset requests for this account. Try again in an hour.' },
});

// Admin Auth Routes
router.post('/login', adminLoginLimiter, login);
router.post('/verify-otp', adminOtpLimiter, verifyOTP);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/password', protect, changePassword);

// Admin team-member setup (public — validates the time-limited invite token).
router.get('/setup-password/:token', validateAdminSetupToken);
router.post('/setup-password', adminOtpLimiter, setupPasswordWithToken);

// Registration is public and accepts a file upload — same abuse surface as
// login, so it gets the same per-IP throttle (merchantLoginLimiter was
// previously only applied to login itself, leaving this endpoint unlimited).
router.post('/merchant/register', merchantLoginLimiter, upload.single('certificate'), registerMerchant);
router.post('/merchant/verify-otp', merchantOtpLimiter, verifyMerchantOTP);
router.post('/merchant/login', merchantLoginLimiter, loginMerchant);
router.post('/merchant/resend-otp', merchantOtpLimiter, resendMerchantOTP);
router.post('/merchant/forgot-password',  merchantLoginLimiter, forgotPasswordAccountLimiter, forgotPassword);
router.post('/merchant/verify-reset-otp', merchantOtpLimiter,   verifyResetOTP);
router.post('/merchant/reset-password',   merchantOtpLimiter,   resetPassword);
router.get('/merchant/setup-password/:token', validateSetupToken);
router.post('/merchant/setup-password', merchantOtpLimiter, setupPassword);
router.put('/merchant/change-password', protectMerchant, changeMerchantPassword);
router.get('/merchant/security-questions', protectMerchant, getSecurityQuestions);
router.put('/merchant/security-questions', protectMerchant, updateSecurityQuestions);
router.get('/merchant/security-history', protectMerchant, getSecurityHistory);
router.post('/merchant/sign-out-all-devices', protectMerchant, signOutAllDevices);
router.get('/merchant/me', protectMerchant, getMerchantMe);
router.put('/merchant/profile', protectMerchant, updateMerchantProfile);
router.put('/merchant/biometrics', protectMerchant, toggleBiometrics);
// setAppPin now also verifies the current password when a PIN already
// exists (see merchantAuthController.js), so it needs the same throttle
// verify-payment-pin gets below — it had none before.
router.post('/merchant/set-app-pin', protectMerchant, pinLimiter, setAppPin);
router.post('/merchant/verify-payment-pin', protectMerchant, pinLimiter, verifyPaymentPin);

// WebAuthn / Passkey routes
// Public — called before the user holds a JWT
router.post('/merchant/webauthn/login-options',   getLoginOptions);
router.post('/merchant/webauthn/verify-login',    verifyLogin);
// Private — merchant must be logged in to register/manage passkeys
router.get ('/merchant/webauthn/register-options', protectMerchant, getRegistrationOptions);
router.post('/merchant/webauthn/verify-registration', protectMerchant, verifyRegistration);
router.get ('/merchant/webauthn/passkeys', protectMerchant, getPasskeys);
router.delete('/merchant/webauthn/passkeys/:credentialID', protectMerchant, deletePasskey);
router.patch('/merchant/webauthn/passkeys/:credentialID', protectMerchant, renamePasskey);

export default router;
