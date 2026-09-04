import crypto from 'crypto';
import { serverError } from '../utils/serverError.js';
import Merchant from '../models/Merchant.js';
import AuditLog from '../models/AuditLog.js';
import { sendOTP, sendWelcomeEmail, sendPasswordResetConfirmation } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import generateToken from '../utils/generateToken.js';
import { provisionMerchantWallet, getWalletBalance } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import bcrypt from 'bcryptjs';
import { createNotification } from './notificationController.js';
import { getNcbaVirtualAccountNumber, formatAccountNumberDisplay, validatePhoneNumber, isValidPhoneInputFormat, NcbaValidationError } from '../utils/ncbaValidators.js';
import { buildMerchantWelcomeSms } from '../utils/accountSmsTemplates.js';
import { isValidEmail, EMAIL_FORMAT_HINT } from '../utils/emailValidator.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { assertOtpNotLocked, recordFailedOtpAttempt, resetOtpAttempts, OtpLockedError } from '../utils/otpLockout.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';
import { normalizeKraPin, isValidKraPin, KRA_PIN_FORMAT_HINT } from '../utils/kraPinValidator.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';
import { getAvailableBalance } from '../utils/availableBalance.js';

// Canonical option sets for self-serve signup's business-details step —
// kept here (not just in the frontend) so a request bypassing the UI can't
// write an arbitrary string into a field the admin/officer dashboards
// display and filter on. Mirrored exactly in Login.jsx (web) and
// Login.tsx (mobile); keep all three in sync if this list ever changes.
const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Partnership',
  'Limited Liability Company (LLC)',
  'Public Limited Company (PLC)',
  'SACCO',
  'NGO/Non-Profit',
  'Cooperative Society',
  'Other',
];
const EMPLOYEE_BANDS = ['1-10', '11-50', '51-200', '201-500', '501+'];

// Mask a phone number for safe display in the UI, e.g. +254712345678 →
// +254•••••••78. Falls back to the raw digits if the number can't be
// normalized to E.164 (still masks — never shows the full number either way).
const maskPhone = (raw) => {
  const e164 = toE164Kenyan(raw);
  const digits = (e164 || String(raw || '')).replace(/\D/g, '');
  if (digits.length < 6) return null;
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  const maskedLen = Math.max(3, digits.length - start.length - end.length);
  return `+${start}${'•'.repeat(maskedLen)}${end}`;
};

// Sends the login/resend OTP through whichever channel matches how the
// merchant is signing in: SMS when they typed their phone number, email
// otherwise. Never throws (safeSendSMS/sendOTP both swallow their own
// errors) and always returns enough info for the response to tell the
// frontend which channel was used and how to render "sent to ...".
async function dispatchOtp(merchant, { viaPhone, otp }) {
  if (viaPhone) {
    const e164Phone = toE164Kenyan(merchant.phone);
    if (e164Phone) {
      const result = await safeSendSMS({
        to: e164Phone,
        message: `Your PayChain verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
      });
      if (!result.success) {
        console.error(`📱 SMS Error: Failed to send OTP to ${e164Phone}:`, result.error);
      }
      return { channel: 'sms', maskedPhone: maskPhone(merchant.phone) };
    }
    console.warn(`📱 Merchant ${merchant._id} phone "${merchant.phone}" would not normalize — falling back to email OTP.`);
  }

  console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
  await sendOTP(merchant.email, otp).catch((err) => {
    console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
  });
  return { channel: 'email', maskedPhone: null };
}

// @desc    Register a new merchant
// @route   POST /api/auth/merchant/register
// @access  Public
export const registerMerchant = async (req, res) => {
  try {
    let {
      name, email, phone, businessName, password, registrationSource, kraPin, businessNumber,
      businessType, county, area, employees, ecommerce, agreedToTerms,
    } = req.body || {};
    const certificateFile = req.file;

    if (phone) phone = String(phone).replace(/\s+/g, '');
    if (email) email = String(email).trim().toLowerCase();
    if (kraPin) kraPin = normalizeKraPin(kraPin);
    if (businessNumber) businessNumber = String(businessNumber).trim();
    if (businessType) businessType = String(businessType).trim();
    if (county) county = String(county).trim();
    if (area) area = String(area).trim();
    if (employees) employees = String(employees).trim();
    // Both frontends currently send 'yes'/'no' strings; accept a real
    // boolean too so this doesn't silently break if either is updated to
    // send one directly.
    const isEcommerce = ecommerce === true || ecommerce === 'yes' ? true
      : ecommerce === false || ecommerce === 'no' ? false
      : null;

    if (!name?.trim() || !email || !phone || !businessName?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, phone, business name and password are all required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: EMAIL_FORMAT_HINT });
    }

    // Reject anything that isn't a real Kenyan mobile number (e.g. a random
    // string of digits like "14393360") before it ever reaches storage —
    // this used to go straight through unvalidated, unlike every other
    // money-movement destination in this codebase (see
    // ncbaValidators.js#validatePhoneNumber's own doc comment).
    if (!isValidPhoneInputFormat(phone)) {
      return res.status(400).json({ error: 'Enter a valid Kenyan mobile number starting with +254, 07, or 01 (e.g. 0712 345 678).' });
    }
    try {
      validatePhoneNumber(phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) {
        return res.status(400).json({ error: 'Enter a valid Kenyan mobile number (e.g. 0712 345 678).' });
      }
      throw e;
    }

    if (!businessType || !BUSINESS_TYPES.includes(businessType)) {
      return res.status(400).json({ error: 'Select a valid business type.' });
    }
    if (!county?.trim()) {
      return res.status(400).json({ error: 'County is required.' });
    }
    if (!area?.trim()) {
      return res.status(400).json({ error: 'Area/Location is required.' });
    }
    if (!employees || !EMPLOYEE_BANDS.includes(employees)) {
      return res.status(400).json({ error: 'Select a valid number of employees.' });
    }
    if (isEcommerce === null) {
      return res.status(400).json({ error: 'Let us know whether this is an eCommerce business.' });
    }
    // Not just a UI nicety — this is the actual consent record. Reject
    // outright rather than defaulting it, same as both frontends already
    // disable their submit button until this is checked.
    if (agreedToTerms !== true && agreedToTerms !== 'true') {
      return res.status(400).json({ error: 'You must agree to the Privacy Policy and Terms of Service to create an account.' });
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

    if (kraPin && !isValidKraPin(kraPin)) {
      return res.status(400).json({ error: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}` });
    }
    if (kraPin && await Merchant.exists({ kraPin })) {
      return res.status(400).json({ error: 'A merchant with that KRA PIN already exists.' });
    }
    if (businessNumber && await Merchant.exists({ businessNumber })) {
      return res.status(400).json({ error: 'A merchant with that business registration number already exists.' });
    }

    const certificateUrl = certificateFile ? certificateFile.path : null;
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

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
      kesBalance: 0,
      usdcBalance: 0,
      isVerified: true,
      registrationSource: registrationSource === 'mobile' ? 'mobile' : 'web',
      businessType,
      county,
      businessArea: area,
      employeeCount: employees,
      isEcommerce,
      agreedToTerms: true,
      agreedToTermsAt: new Date(),
      // Deliberately no tariffLock here — only the merchants that existed
      // before this feature shipped (locked once, in
      // migrations/backfillMerchantTariffLocks.js) are frozen to a fixed
      // rate. Every merchant signing up from now on keeps
      // Merchant.tariffLock at its default (null), so their pricing tracks
      // the live Transaction Tariffs sheet exactly like it always has,
      // however many times an admin edits it later (confirmed with
      // Brandon, 2026-09-03).
    });

    console.log(`📧 Dispatching Welcome Email to: ${merchant.email}`);
    const ncbaVirtualAccountNumber = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode);
    sendWelcomeEmail(merchant.email, merchant.name, password, merchant.phone, ncbaVirtualAccountNumber, merchant.ncbaMerchantCode, merchant.businessName).catch(err => {
      console.error(`📧 Resend Error: Failed to send Welcome Email to ${merchant.email}:`, err);
    });

    // Same account-number resolution as the welcome email above — never
    // let the SMS and email disagree on what the merchant's account number
    // is. Fire-and-forget, same as the email: a slow/down SMS provider must
    // never delay the signup response.
    const welcomePhone = toE164Kenyan(merchant.phone);
    if (welcomePhone) {
      safeSendSMS({
        to: welcomePhone,
        message: buildMerchantWelcomeSms({
          businessName: merchant.businessName,
          accountNumber: formatAccountNumberDisplay(ncbaVirtualAccountNumber || merchant.ncbaMerchantCode),
          accountIsInterim: !ncbaVirtualAccountNumber,
        }).message,
      }).catch((err) => console.error(`📱 SMS Error: Failed to send welcome SMS to ${welcomePhone}:`, err));
    }

    // Wallet provisioning is intentionally NOT done here. The Digital Wallet
    // is opt-in: a merchant activates it whenever they want via
    // POST /api/transactions/activate-wallet (one-time — that endpoint
    // rejects a second call once stellarPublicKey is already set).

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
    // String() coercion matters here — without it, an object payload like
    // {"$ne": null} would be handed straight to Mongo as a query operator
    // instead of a literal value, matching an arbitrary merchant instead of
    // a specific one. Mirrors the same guard verifyResetOTP already applies.
    const lookup = String(email || '').trim();
    const merchant = await Merchant.findOne({ email: lookup }).select('+password +otp +otpExpires');

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    try {
      await assertOtpNotLocked(Merchant, merchant._id);
    } catch (e) {
      if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    if (!merchant.otp || !timingSafeStringEqual(merchant.otp, String(otp || ''))) {
      await recordFailedOtpAttempt(Merchant, merchant._id);
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
    await resetOtpAttempts(Merchant, merchant._id);

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

    const platformSettings = await getOrCreatePlatformSettings();
    const { availableBalance, heldAmount } = await getAvailableBalance(merchant._id, merchant.kesBalance);

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        // NCBA virtual account — ncbaVirtualAccountNumber is null until
        // NCBA_INSTITUTION_PREFIX is configured (i.e. until NCBA actually
        // assigns PayChain's 4-digit code); render that as "pending bank
        // assignment" rather than an error.
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
        kesBalance: merchant.kesBalance,
        // What debitAvailableBalance will actually let this merchant send
        // right now — kesBalance minus anything credited in the last 2
        // minutes and still held (utils/availableBalance.js). Previously
        // absent here, so Send Money/Bulk Pay showed the full kesBalance as
        // "available" and a merchant who'd just been paid could pass the
        // UI's own balance check, enter their PIN, and only then be
        // rejected server-side.
        availableBalance,
        heldAmount,
        usdcBalance: merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status: merchant.status,
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
        settlementBankCode: merchant.settlementBankCode,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled,
        mobileBiometricUnlockEnabled: merchant.mobileBiometricUnlockEnabled,
        features: merchant.features,
        // Global admin kill switch (Merchants page) — distinct from
        // features.cashAdvanceForm, which is per-merchant. Either one being
        // off means the merchant can't apply.
        platformCashAdvanceEnabled: platformSettings.cashAdvanceEnabled,
        hasSeenOnboardingWalkthrough: merchant.hasSeenOnboardingWalkthrough,
        hasSeenAccountsWalkthrough: merchant.hasSeenAccountsWalkthrough,
        hasSeenSecurityWalkthrough: merchant.hasSeenSecurityWalkthrough,
        hasSeenProfileWalkthrough: merchant.hasSeenProfileWalkthrough,
        hasSeenTransactionsWalkthrough: merchant.hasSeenTransactionsWalkthrough
      },
      token: generateToken(merchant._id, '30d', { tokenVersion: merchant.tokenVersion || 0 })
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Verify Merchant OTP Error:');
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
    }).select('+password');
    
    if (!merchant || !merchant.password) {
      // Run a dummy bcrypt compare even on a miss so this branch takes
      // roughly the same time as a real wrong-password rejection below —
      // without it, "no such account"/"no password set" return near-
      // instantly while a real account always pays bcrypt's ~ms cost,
      // letting an attacker distinguish account existence by timing alone.
      await bcrypt.compare(String(password || ''), '$2a$12$CwTycUXWue0Thq9StjUM0uJ8i.dTQwsxOnJz3XkKvKl.mDcMxLj8O');
      logAudit({
        action: 'merchant.login.failed', category: 'auth', severity: 'warning',
        message: merchant ? 'Failed sign-in — account has no password (admin-onboarded)' : `Failed sign-in — no account for "${loginIdentifier}"`,
        merchant: merchant || undefined, req,
        metadata: { identifier: loginIdentifier, reason: merchant ? 'no_password' : 'no_account' },
      });
      // Same generic message either way — "no password set" previously
      // confirmed account existence to an unauthenticated caller.
      return res.status(401).json({ error: 'Invalid email/phone or password' });
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

    // Always require OTP verification for every login (removed 3-day bypass).
    // Login was via phone when the identifier the merchant typed had no '@'
    // (same check used above to build phoneVariations) — in that case the
    // OTP goes out over SMS instead of email.
    const viaPhone = !loginIdentifier.includes('@');
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Dispatch first (it may fall back from sms to email internally), then
    // persist the OTP alongside whichever channel was *actually* used — so
    // a later resend repeats the real delivery channel, not just the
    // originally-intended one.
    const { channel, maskedPhone } = await dispatchOtp(merchant, { viaPhone, otp });
    await Merchant.updateOne({ _id: merchant._id }, { $set: { otp, otpExpires, otpChannel: channel } });

    logAudit({
      action: 'merchant.login.otp_requested', category: 'auth', severity: 'info',
      message: `Password validated — OTP dispatched via ${channel}`,
      merchant, req,
      metadata: { channel },
    });

    return res.json({
      success: true,
      mfaRequired: true,
      email: merchant.email,
      channel,
      maskedPhone,
      message: channel === 'sms' ? 'OTP sent to your phone. Proceed to Stage 2.' : 'OTP sent to your email. Proceed to Stage 2.'
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Login Merchant Error:');
  }
};

// @desc    Resend Merchant OTP
// @route   POST /api/auth/merchant/resend-otp
// @access  Public
export const resendMerchantOTP = async (req, res) => {
  try {
    const { email } = req.body || {};
    // Same NoSQL-injection guard as verifyMerchantOTP above — String()
    // coercion so an object payload can't be evaluated as a Mongo operator.
    const lookup = String(email || '').trim();
    const merchant = await Merchant.findOne({ email: lookup }).select('+otpChannel');

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Repeat whichever channel the merchant's currently-pending OTP was sent
    // through (set on the original login/resend) rather than defaulting back
    // to email — a merchant who logged in with their phone keeps getting SMS.
    const { channel, maskedPhone } = await dispatchOtp(merchant, { viaPhone: merchant.otpChannel === 'sms', otp });
    await Merchant.updateOne({ _id: merchant._id }, { $set: { otp, otpExpires, otpChannel: channel } });

    res.json({
      success: true,
      channel,
      maskedPhone,
      message: channel === 'sms' ? 'New security code sent to your phone.' : 'New security code sent successfully.'
    });
  } catch (error) {
    serverError(res, 500, 'Server Error', error, 'Resend OTP Error:');
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
    }).select('+otp +otpExpires');

    if (!merchant || !merchant.otp || !merchant.otpExpires) {
      return res.status(400).json({ error: 'Invalid code. Request a new one and try again.' });
    }

    // Account-level lockout — the route's merchantOtpLimiter only throttles
    // per-IP, which a distributed attacker can spread guesses across to
    // brute-force this 6-digit code within its 10-min TTL. Mirrors the same
    // guard verifyMerchantOTP's login flow already applies.
    try {
      await assertOtpNotLocked(Merchant, merchant._id);
    } catch (e) {
      if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    // Timing-safe OTP comparison.
    const provided = Buffer.from(String(otp).padEnd(6));
    const stored   = Buffer.from(String(merchant.otp).padEnd(6));
    if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) {
      await recordFailedOtpAttempt(Merchant, merchant._id);
      return res.status(400).json({ error: 'Invalid code. Check your inbox and try again.' });
    }

    if (new Date() > merchant.otpExpires) {
      return res.status(400).json({ error: 'Code has expired. Request a new one.' });
    }

    await resetOtpAttempts(Merchant, merchant._id);

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
      merchant = await Merchant.findOne({ email: lookup }).select('+password +otp +otpExpires');
      if (!merchant) {
        return res.status(401).json({ error: 'Invalid verification code.' });
      }
      // Account-level lockout — same rationale as verifyResetOTP above.
      try {
        await assertOtpNotLocked(Merchant, merchant._id);
      } catch (e) {
        if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
        throw e;
      }
      if (!merchant.otp || !timingSafeStringEqual(merchant.otp, String(otp))) {
        await recordFailedOtpAttempt(Merchant, merchant._id);
        return res.status(401).json({ error: 'Invalid verification code.' });
      }
      if (!merchant.otpExpires || new Date() > merchant.otpExpires) {
        return res.status(401).json({ error: 'Verification code has expired.' });
      }
      await resetOtpAttempts(Merchant, merchant._id);
    } else {
      return res.status(400).json({ error: 'Reset token (or email + code) is required.' });
    }

    merchant.password = String(newPassword);
    merchant.otp = null;
    merchant.otpExpires = null;
    merchant.passwordResetToken = null;
    merchant.passwordResetExpires = null;
    // A reset is the standard remediation after a merchant suspects their
    // account/token was compromised — bumping tokenVersion here (same
    // mechanism as the explicit "sign out all devices" button, see
    // signOutAllDevices below) invalidates any JWT issued before this
    // point, not just ones the merchant happens to know about.
    merchant.tokenVersion = (merchant.tokenVersion || 0) + 1;
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
    // Invalidate any other JWT issued before this change — see the same
    // rationale in resetPassword above.
    merchant.tokenVersion = (merchant.tokenVersion || 0) + 1;
    await merchant.save();

    logAudit({
      action: 'merchant.password.changed', category: 'security', severity: 'critical',
      message: 'Password changed from dashboard (authenticated)',
      merchant, req,
    });

    // The bump above just invalidated the token this very request was
    // authenticated with — issue a fresh one so the merchant's current
    // session keeps working without an unexpected logout, while any OTHER
    // copy of the old token (e.g. one an attacker had) stops working.
    res.json({
      success: true,
      message: 'Password updated successfully',
      token: generateToken(merchant._id, '30d', { tokenVersion: merchant.tokenVersion || 0 }),
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get configured security questions (text only — never answers)
// @route   GET /api/auth/merchant/security-questions
// @access  Private (Merchant)
export const getSecurityQuestions = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+securityQuestions');
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      success: true,
      configured: merchant.securityQuestions.length > 0,
      count: merchant.securityQuestions.length,
      questions: merchant.securityQuestions.map((q) => q.question),
    });
  } catch (error) {
    console.error('Get Security Questions Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Set / replace security questions for identity recovery
// @route   PUT /api/auth/merchant/security-questions
// @access  Private (Merchant)
export const updateSecurityQuestions = async (req, res) => {
  const { questions, currentPassword } = req.body;

  try {
    if (!Array.isArray(questions) || questions.length < 3) {
      return res.status(400).json({ error: 'Please answer all 3 security questions.' });
    }
    for (const q of questions) {
      if (!q?.question?.trim() || !q?.answer?.trim()) {
        return res.status(400).json({ error: 'Every question needs an answer.' });
      }
      if (q.answer.trim().length < 2) {
        return res.status(400).json({ error: 'Answers must be at least 2 characters long.' });
      }
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+password');
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Re-authenticate before overwriting the recovery vault — same bar as a
    // password change, since these answers can be used to regain access.
    if (merchant.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please confirm your current password to update security questions.' });
      }
      const isMatch = await merchant.matchPassword(currentPassword);
      if (!isMatch) {
        logAudit({
          action: 'merchant.security_questions.update_failed', category: 'security', severity: 'warning',
          message: 'Security questions update failed — wrong current password',
          merchant, req,
        });
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const salt = await bcrypt.genSalt(12);
    merchant.securityQuestions = await Promise.all(
      questions.map(async (q) => ({
        question: q.question.trim(),
        answerHash: await bcrypt.hash(q.answer.trim().toLowerCase(), salt),
      }))
    );
    await merchant.save();

    logAudit({
      action: 'merchant.security_questions.updated', category: 'security', severity: 'critical',
      message: 'Security questions updated from dashboard',
      merchant, req,
    });

    res.json({ success: true, message: 'Security questions saved successfully' });
  } catch (error) {
    console.error('Update Security Questions Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Recent account-security activity (logins, password/PIN/security-question
//          changes) — sourced from the same audit trail admins see, scoped to
//          this merchant only.
// @route   GET /api/auth/merchant/security-history
// @access  Private (Merchant)
export const getSecurityHistory = async (req, res) => {
  try {
    const events = await AuditLog.find({
      merchantId: req.merchant._id,
      category: { $in: ['auth', 'security'] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('action message severity ip userAgent platform createdAt')
      .lean();

    res.json({ success: true, events });
  } catch (error) {
    console.error('Get Security History Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Sign out every device/session by invalidating all previously
//          issued JWTs at once (bumps tokenVersion — see generateToken /
//          protectMerchant). This also signs out the session making the
//          request; the client should clear its local token immediately.
// @route   POST /api/auth/merchant/sign-out-all-devices
// @access  Private (Merchant)
export const signOutAllDevices = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    merchant.tokenVersion = (merchant.tokenVersion || 0) + 1;
    await merchant.save();

    logAudit({
      action: 'merchant.sessions.revoked_all', category: 'security', severity: 'critical',
      message: 'Signed out of all devices',
      merchant, req,
    });

    res.json({ success: true, message: 'Signed out of all devices' });
  } catch (error) {
    console.error('Sign Out All Devices Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get current merchant profile
// @route   GET /api/auth/merchant/me
// @access  Private (Merchant)
export const getMerchantMe = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('+appPin +failedPinAttempts +pinLockedUntil');
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

    const platformSettings = await getOrCreatePlatformSettings();
    const { availableBalance, heldAmount } = await getAvailableBalance(merchant._id, merchant.kesBalance);

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        // NCBA virtual account — ncbaVirtualAccountNumber is null until
        // NCBA_INSTITUTION_PREFIX is configured (i.e. until NCBA actually
        // assigns PayChain's 4-digit code); render that as "pending bank
        // assignment" rather than an error.
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
        kesBalance: merchant.kesBalance,
        // What debitAvailableBalance will actually let this merchant send
        // right now — kesBalance minus anything credited in the last 2
        // minutes and still held (utils/availableBalance.js). Previously
        // absent here, so Send Money/Bulk Pay showed the full kesBalance as
        // "available" and a merchant who'd just been paid could pass the
        // UI's own balance check, enter their PIN, and only then be
        // rejected server-side.
        availableBalance,
        heldAmount,
        usdcBalance: merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status: merchant.status,
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
        settlementBankCode: merchant.settlementBankCode,
        hasAppPin: !!merchant.appPin,
        failedPinAttempts: merchant.failedPinAttempts || 0,
        pinBlocked: !!(merchant.pinLockedUntil && merchant.pinLockedUntil > new Date()),
        biometricsEnabled: merchant.biometricsEnabled,
        mobileBiometricUnlockEnabled: merchant.mobileBiometricUnlockEnabled,
        features: merchant.features,
        // Global admin kill switch (Merchants page) — distinct from
        // features.cashAdvanceForm, which is per-merchant. Either one being
        // off means the merchant can't apply.
        platformCashAdvanceEnabled: platformSettings.cashAdvanceEnabled,
        hasSeenOnboardingWalkthrough: merchant.hasSeenOnboardingWalkthrough,
        hasSeenAccountsWalkthrough: merchant.hasSeenAccountsWalkthrough,
        hasSeenSecurityWalkthrough: merchant.hasSeenSecurityWalkthrough,
        hasSeenProfileWalkthrough: merchant.hasSeenProfileWalkthrough,
        hasSeenTransactionsWalkthrough: merchant.hasSeenTransactionsWalkthrough
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

    const { kraPin, businessNumber, settlementMobile, settlementBankName, settlementBankAccount, settlementBankCode } = req.body;
    
    // KRA PIN format check — isKRAVerified means "passed format
    // validation," not "confirmed against a government system." The eTIMS
    // OSCU integration (controllers/etimsController.js) sends this PIN to
    // KRA as the tin when signing invoices, but neither it nor this check
    // performs an actual PIN lookup/verification against KRA — never
    // present a passed check to a merchant as an eTIMS lookup.
    if (kraPin !== undefined && normalizeKraPin(kraPin) !== merchant.kraPin) {
      if (!isValidKraPin(kraPin)) {
        return res.status(400).json({
          error: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}`
        });
      }

      merchant.kraPin = normalizeKraPin(kraPin);
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
    if (settlementBankCode !== undefined && settlementBankCode !== merchant.settlementBankCode) {
      merchant.settlementBankCode = settlementBankCode; changedFields.push('settlementBankCode');
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

    const { availableBalance, heldAmount } = await getAvailableBalance(merchant._id, merchant.kesBalance);

    res.json({
      success: true,
      merchant: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        // NCBA virtual account — ncbaVirtualAccountNumber is null until
        // NCBA_INSTITUTION_PREFIX is configured (i.e. until NCBA actually
        // assigns PayChain's 4-digit code); render that as "pending bank
        // assignment" rather than an error.
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
        kesBalance: merchant.kesBalance,
        // What debitAvailableBalance will actually let this merchant send
        // right now — kesBalance minus anything credited in the last 2
        // minutes and still held (utils/availableBalance.js). Previously
        // absent here, so Send Money/Bulk Pay showed the full kesBalance as
        // "available" and a merchant who'd just been paid could pass the
        // UI's own balance check, enter their PIN, and only then be
        // rejected server-side.
        availableBalance,
        heldAmount,
        usdcBalance: merchant.usdcBalance,
        stellarPublicKey: merchant.stellarPublicKey,
        status: merchant.status,
        isVerified: merchant.isVerified,
        createdAt: merchant.createdAt,
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        kraPin: merchant.kraPin,
        businessNumber: merchant.businessNumber,
        isKRAVerified: merchant.isKRAVerified,
        settlementMobile: merchant.settlementMobile,
        settlementBankAccount: merchant.settlementBankAccount,
        hasAppPin: !!merchant.appPin,
        biometricsEnabled: merchant.biometricsEnabled,
        mobileBiometricUnlockEnabled: merchant.mobileBiometricUnlockEnabled,
        hasSeenOnboardingWalkthrough: merchant.hasSeenOnboardingWalkthrough,
        hasSeenAccountsWalkthrough: merchant.hasSeenAccountsWalkthrough,
        hasSeenSecurityWalkthrough: merchant.hasSeenSecurityWalkthrough,
        hasSeenProfileWalkthrough: merchant.hasSeenProfileWalkthrough,
        hasSeenTransactionsWalkthrough: merchant.hasSeenTransactionsWalkthrough,
      }
    });
  } catch (error) {
    console.error('Update Merchant Profile Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle the mobile app's local Face ID/Touch ID device-unlock
//          (expo-local-authentication) — NOT a WebAuthn credential, just a
//          local re-entry gate for an already-authenticated app session.
//          Writes mobileBiometricUnlockEnabled, deliberately separate from
//          biometricsEnabled (which means "has a real web passkey" and is
//          only ever written by webauthnController.js) — see that field's
//          comment on Merchant.js for why they must not share a flag.
// @route   PUT /api/auth/merchant/biometrics
// @access  Private (Merchant)
export const toggleBiometrics = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const wasEnabled = !!merchant.mobileBiometricUnlockEnabled;
    const nowEnabled = !!req.body.enabled;
    merchant.mobileBiometricUnlockEnabled = nowEnabled;
    await merchant.save();

    if (wasEnabled !== nowEnabled) {
      logAudit({
        action: nowEnabled ? 'merchant.biometrics.enabled' : 'merchant.biometrics.disabled',
        category: 'security',
        severity: nowEnabled ? 'success' : 'warning',
        message: `Mobile device-unlock ${nowEnabled ? 'enabled' : 'disabled'}`,
        merchant, req,
      });
    }

    res.json({
      success: true,
      message: `Biometrics ${merchant.mobileBiometricUnlockEnabled ? 'enabled' : 'disabled'} successfully`,
      mobileBiometricUnlockEnabled: merchant.mobileBiometricUnlockEnabled,
    });
  } catch (error) {
    console.error('Toggle Biometrics Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Record that this merchant actually installed the web app (PWA)
//          to their home screen — fired once by useInstallPrompt.js's
//          `appinstalled` listener. Idempotent and never cleared back to
//          null (an uninstall doesn't reliably fire a browser event this
//          could listen for), so this stays "installed at least once" —
//          only set it the first time to avoid the timestamp drifting
//          forward on a merchant who installs on a second device later.
// @route   PUT /api/auth/merchant/pwa-installed
// @access  Private (Merchant)
export const reportPwaInstalled = async (req, res) => {
  try {
    await Merchant.updateOne(
      { _id: req.merchant._id, pwaInstalledAt: null },
      { $set: { pwaInstalledAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Report PWA Installed Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark the one-time feature walkthrough as seen. Idempotent — the
//          frontend calls this once the merchant finishes or skips the tour,
//          and never shows it again for this account regardless of device.
// @route   PUT /api/auth/merchant/onboarding-walkthrough
// @access  Private (Merchant)
export const completeOnboardingWalkthrough = async (req, res) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant._id, { hasSeenOnboardingWalkthrough: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Complete Onboarding Walkthrough Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark the My Accounts page's Generate QR / Download Sticker
//          walkthrough as seen. Same one-time pattern as
//          completeOnboardingWalkthrough above, scoped to that page.
// @route   PUT /api/auth/merchant/accounts-walkthrough
// @access  Private (Merchant)
export const completeAccountsWalkthrough = async (req, res) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant._id, { hasSeenAccountsWalkthrough: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Complete Accounts Walkthrough Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark the Security section's walkthrough (Enable Biometrics,
//          Change Password, Change PIN) as seen. Same one-time pattern as
//          completeOnboardingWalkthrough above, scoped to that section.
// @route   PUT /api/auth/merchant/security-walkthrough
// @access  Private (Merchant)
export const completeSecurityWalkthrough = async (req, res) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant._id, { hasSeenSecurityWalkthrough: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Complete Security Walkthrough Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark the Profile section's walkthrough (Identity, KRA PIN &
//          Business Number, Update Global Profile) as seen. Same one-time
//          pattern as completeOnboardingWalkthrough above, scoped to that
//          section.
// @route   PUT /api/auth/merchant/profile-walkthrough
// @access  Private (Merchant)
export const completeProfileWalkthrough = async (req, res) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant._id, { hasSeenProfileWalkthrough: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Complete Profile Walkthrough Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark the Transactions page's statement-export walkthrough as
//          seen. Same one-time pattern as completeOnboardingWalkthrough
//          above, scoped to that page.
// @route   PUT /api/auth/merchant/transactions-walkthrough
// @access  Private (Merchant)
export const completeTransactionsWalkthrough = async (req, res) => {
  try {
    await Merchant.findByIdAndUpdate(req.merchant._id, { hasSeenTransactionsWalkthrough: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Complete Transactions Walkthrough Error:', error);
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
    const setupNcbaVirtualAccountNumber = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode);
    sendWelcomeEmail(merchant.email, merchant.name, password, merchant.phone, setupNcbaVirtualAccountNumber, merchant.ncbaMerchantCode, merchant.businessName)
      .catch((err) => console.error(`📧 Failed to send credentials email to ${merchant.email}:`, err));

    // Same welcome SMS as self-signup (registerMerchant) — this is the
    // equivalent "account now usable" moment for an admin-invited merchant.
    const setupWelcomePhone = toE164Kenyan(merchant.phone);
    if (setupWelcomePhone) {
      safeSendSMS({
        to: setupWelcomePhone,
        message: buildMerchantWelcomeSms({
          businessName: merchant.businessName,
          accountNumber: formatAccountNumberDisplay(setupNcbaVirtualAccountNumber || merchant.ncbaMerchantCode),
          accountIsInterim: !setupNcbaVirtualAccountNumber,
        }).message,
      }).catch((err) => console.error(`📱 SMS Error: Failed to send welcome SMS to ${setupWelcomePhone}:`, err));
    }

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
    const { pin, currentPassword } = req.body;
    if (!pin || String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: 'A valid 4-digit PIN is required' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin +password');
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Overwriting an EXISTING PIN is a sensitive action — same re-auth bar as
    // changePassword/updateSecurityQuestions above. Without this, a session
    // token alone (e.g. one leaked/stolen after the merchant already set a
    // PIN) could silently replace it and immediately unlock money movement
    // (sendMoney/B2C/B2B all gate on this PIN), defeating its whole purpose
    // as a check beyond the session itself. First-time setup (no PIN yet)
    // doesn't need this — there's nothing to protect against being
    // overwritten, and it's the only path the UI currently exposes.
    if (merchant.appPin) {
      if (!merchant.password) {
        return res.status(400).json({ error: 'Your account has no password on file — contact support to change your payment PIN.' });
      }
      if (!currentPassword) {
        // pinAlreadySet lets the client (PinSetup.tsx's first-time flow, which
        // doesn't collect a password) distinguish "you need to re-auth" from
        // a generic failure and prompt for the password inline instead of
        // just failing — e.g. a merchant reinstalling the app or setting up
        // a second device, where the server already has an appPin from
        // before but this device has never captured one locally.
        return res.status(400).json({ error: 'Enter your current password to change your payment PIN.', pinAlreadySet: true });
      }
      const isMatch = await merchant.matchPassword(currentPassword);
      if (!isMatch) {
        logAudit({
          action: 'merchant.payment_pin.change_failed', category: 'security', severity: 'warning',
          message: 'Payment PIN change failed — wrong current password',
          merchant, req,
        });
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    // Hash the 4-digit PIN using bcrypt (12 rounds = OWASP 2024 baseline).
    const salt = await bcrypt.genSalt(12);
    const wasChange = !!merchant.appPin;
    merchant.appPin = await bcrypt.hash(pin, salt);

    await merchant.save();

    logAudit({
      action: wasChange ? 'merchant.payment_pin.changed' : 'merchant.payment_pin.set',
      category: 'security', severity: wasChange ? 'critical' : 'info',
      message: wasChange ? 'Payment PIN changed' : 'Payment PIN set for the first time',
      merchant, req,
    });

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

// @desc    Change an existing Payment PIN — the M-Pesa/bank-style "enter your
//          old PIN, then your new PIN" flow, as opposed to setAppPin's
//          password-gated overwrite (kept as a defense-in-depth fallback).
//          This is now THE single PIN used to authorise every payment
//          (sendMoney, B2C/B2B, and bulk-pay batch authorization all check
//          the same appPin) — there is no separate "Bulk Pay PIN" anymore.
// @route   PUT /api/auth/merchant/reset-app-pin
// @access  Private (Merchant)
export const resetAppPin = async (req, res) => {
  try {
    const { currentPin, newPin } = req.body || {};
    if (!currentPin || !newPin || String(newPin).length !== 4 || !/^\d{4}$/.test(String(newPin))) {
      return res.status(400).json({ error: 'Invalid PIN provided. New PIN must be exactly 4 digits.' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant || !merchant.appPin) {
      return res.status(400).json({ error: 'No existing PIN found to reset.' });
    }

    try {
      await assertPinNotLocked(merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(String(currentPin), merchant.appPin);
    if (!isMatch) {
      await recordFailedPinAttempt(merchant._id);
      logAudit({
        action: 'merchant.payment_pin.change_failed', category: 'security', severity: 'warning',
        message: 'Payment PIN change failed — wrong current PIN',
        merchant, req,
      });
      return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }
    await resetPinAttempts(merchant._id);

    const salt = await bcrypt.genSalt(12);
    merchant.appPin = await bcrypt.hash(String(newPin), salt);
    await merchant.save();

    logAudit({
      action: 'merchant.payment_pin.changed', category: 'security', severity: 'critical',
      message: 'Payment PIN changed',
      merchant, req,
    });

    res.status(200).json({ success: true, message: 'Payment PIN updated successfully.' });
  } catch (error) {
    console.error('Reset App PIN Error:', error);
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

    try {
      await assertPinNotLocked(merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(String(pin), merchant.appPin);
    if (!isMatch) {
      await recordFailedPinAttempt(merchant._id);
      logAudit({
        action: 'merchant.payment_pin.failed', category: 'security', severity: 'warning',
        message: 'Payment PIN verification failed',
        merchant, req,
      });
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }
    await resetPinAttempts(merchant._id);

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
