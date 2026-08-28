import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, verifyOTP, getMe, updateMe, changePassword, logout } from '../controllers/authController.js';
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
  reportPwaInstalled,
  setAppPin,
  resetAppPin,
  verifyPaymentPin,
  validateSetupToken,
  setupPassword,
  completeOnboardingWalkthrough,
  completeAccountsWalkthrough,
  completeSecurityWalkthrough,
  completeProfileWalkthrough,
  completeTransactionsWalkthrough
} from '../controllers/merchantAuthController.js';
import { protectMerchant, protectMerchantSSE, protectDeveloper } from '../middleware/authMiddleware.js';
import { registerMerchantEventClient } from '../utils/merchantEventStream.js';
import { upload } from '../utils/cloudinary.js';
import {
  registerDeveloper,
  verifyDeveloperOtp,
  resendDeveloperOtp,
  loginDeveloper,
  logoutDeveloper,
} from '../controllers/developerAuthController.js';
import {
  getApiPayoutStatus,
  enableApiPayout,
  disableApiPayout,
} from '../controllers/merchantApiPayoutController.js';

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

// WebAuthn login is a credential-validation path just like merchantLoginLimiter
// above — getLoginOptions doubles as an email/phone existence oracle (its
// response shape differs for a known vs unknown identifier) and writes a
// fresh challenge to the DB on every call, and verifyLogin lets an attacker
// probe assertions. Neither had any dedicated throttle before, only the
// app-wide 600/15min backstop.
const webauthnLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

// Password-change / security-question endpoints check `currentPassword` via
// bcrypt.compare inline (matchPassword) — the same brute-force-oracle shape
// as pinLimiter above, just gated on a valid session instead of none. Had
// no dedicated throttle before, only the shared 600/15min global backstop.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
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

// Developer equivalents — same shape as the merchant limiters above.
const developerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const developerOtpLimiter = rateLimit({
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
router.put('/password', protect, passwordChangeLimiter, changePassword);
router.post('/logout', protect, logout);

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
router.put('/merchant/change-password', protectMerchant, passwordChangeLimiter, changeMerchantPassword);
router.get('/merchant/security-questions', protectMerchant, getSecurityQuestions);
router.put('/merchant/security-questions', protectMerchant, passwordChangeLimiter, updateSecurityQuestions);
router.get('/merchant/security-history', protectMerchant, getSecurityHistory);
router.post('/merchant/sign-out-all-devices', protectMerchant, signOutAllDevices);
// Conventionally-named alias — same handler (bumps tokenVersion). There's
// no per-device session store, so a plain "logout" and "sign out
// everywhere" are the same operation today; this just gives frontends a
// predictable endpoint to call on logout instead of relying purely on a
// local token clear that leaves the JWT valid until its 30-day expiry.
router.post('/merchant/logout', protectMerchant, signOutAllDevices);
router.get('/merchant/me', protectMerchant, getMerchantMe);

// Live dashboard updates (Server-Sent Events) — mirrors the admin
// dashboard's identical stream (routes/adminRoutes.js#/events/stream). The
// merchant frontend opens one long-lived connection per session and gets a
// pushed event the instant something changes on their own account (a
// transaction settles, a notification arrives — see
// utils/merchantEventStream.js's call sites), so the dashboard can refetch
// immediately instead of waiting on its next poll interval.
router.get('/merchant/events/stream', protectMerchantSSE, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx/proxy response buffering, if any sits in front
  });
  res.write('\n');
  const unregister = registerMerchantEventClient(req.merchant._id, res);
  // res.on('close'), not req.on('close') — see adminRoutes.js's identical
  // comment: the request stream reports 'close' as soon as it's done being
  // read (essentially immediately on a bodyless GET), long before the
  // client actually disconnects. res's 'close' event is the one that
  // actually reflects the response connection closing.
  res.on('close', unregister);
});
router.put('/merchant/profile', protectMerchant, updateMerchantProfile);
router.put('/merchant/biometrics', protectMerchant, toggleBiometrics);
router.put('/merchant/pwa-installed', protectMerchant, reportPwaInstalled);
router.put('/merchant/onboarding-walkthrough', protectMerchant, completeOnboardingWalkthrough);
router.put('/merchant/accounts-walkthrough', protectMerchant, completeAccountsWalkthrough);
router.put('/merchant/security-walkthrough', protectMerchant, completeSecurityWalkthrough);
router.put('/merchant/profile-walkthrough', protectMerchant, completeProfileWalkthrough);
router.put('/merchant/transactions-walkthrough', protectMerchant, completeTransactionsWalkthrough);
// setAppPin now also verifies the current password when a PIN already
// exists (see merchantAuthController.js), so it needs the same throttle
// verify-payment-pin gets below — it had none before. This is now THE
// single Payment PIN used to authorize every money-movement flow
// (sendMoney, B2C/B2B, and bulk-pay batch authorization) — resetAppPin is
// the M-Pesa/bank-style "old PIN → new PIN" change flow on top of it.
router.post('/merchant/set-app-pin', protectMerchant, pinLimiter, setAppPin);
router.put('/merchant/reset-app-pin', protectMerchant, pinLimiter, resetAppPin);
router.post('/merchant/verify-payment-pin', protectMerchant, pinLimiter, verifyPaymentPin);

// Developer-API payout authorization — a separate PIN from appPin above,
// specifically for unattended payouts a linked developer's own backend can
// trigger. See merchantApiPayoutController.js and models/Merchant.js.
router.get('/merchant/api-payout/status', protectMerchant, getApiPayoutStatus);
router.post('/merchant/api-payout/enable', protectMerchant, pinLimiter, enableApiPayout);
router.post('/merchant/api-payout/disable', protectMerchant, pinLimiter, disableApiPayout);

// WebAuthn / Passkey routes
// Public — called before the user holds a JWT
router.post('/merchant/webauthn/login-options',   webauthnLoginLimiter, getLoginOptions);
router.post('/merchant/webauthn/verify-login',    webauthnLoginLimiter, verifyLogin);
// Private — merchant must be logged in to register/manage passkeys
router.get ('/merchant/webauthn/register-options', protectMerchant, getRegistrationOptions);
router.post('/merchant/webauthn/verify-registration', protectMerchant, verifyRegistration);
router.get ('/merchant/webauthn/passkeys', protectMerchant, getPasskeys);
router.delete('/merchant/webauthn/passkeys/:credentialID', protectMerchant, deletePasskey);
router.patch('/merchant/webauthn/passkeys/:credentialID', protectMerchant, renamePasskey);

// Developer Auth Routes — accounts for the public Developer API (see
// routes/developerRoutes.js for the protected self-service routes and
// routes/developerPublicRoutes.js for the actual API-key-authenticated
// traffic these accounts unlock).
router.post('/developer/register', developerLoginLimiter, registerDeveloper);
router.post('/developer/verify-otp', developerOtpLimiter, verifyDeveloperOtp);
router.post('/developer/resend-otp', developerOtpLimiter, resendDeveloperOtp);
router.post('/developer/login', developerLoginLimiter, loginDeveloper);
router.post('/developer/logout', protectDeveloper, logoutDeveloper);

export default router;
