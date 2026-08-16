import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateRandomMerchantCode } from '../utils/ncbaValidators.js';
import RetiredMerchantCode from './RetiredMerchantCode.js';

const merchantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
  },
  businessName: {
    type: String,
    required: [true, 'Please add a business name'],
  },
  businessNumber: {
    type: String,
    default: null,
    unique: true,
    sparse: true,
  },
  kraPin: {
    type: String,
    default: null,
    unique: true,
    sparse: true,
  },
  isKRAVerified: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    // Optional at create time so admin-onboarded merchants can be created
    // without a password and complete it via the setup-password link.
    required: false,
    minlength: 8,
    select: false,
  },
  // Setup / reset token (sha256 hex of the raw token sent by email).
  passwordResetToken: {
    type: String,
    select: false,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
    default: null,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  certificateUrl: {
    type: String,
    required: [false, 'Certificate URL is not mandatory yet'],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'locked'],
    default: 'active',
    index: true,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  // Manually pin-dropped by an admin on the Merchants Map view (no
  // geocoding — merchants don't have any address/town field to derive this
  // from). Absent entirely for merchants nobody has placed yet, which is
  // how the map endpoint knows to skip them rather than plotting a bogus
  // default location.
  mapLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    label: { type: String, default: '', trim: true },
    setAt: { type: Date, default: null },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  // Suspicious-activity flag. Manual, set by an admin with a written reason.
  // Reversible — `unflag` clears all four fields. Separate from `status`
  // (locked) because flagging is a label/review-marker, not access denial.
  flagged: {
    type: Boolean,
    default: false,
    index: true,
  },
  flagReason: {
    type: String,
    default: null,
  },
  flaggedAt: {
    type: Date,
    default: null,
  },
  flaggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  // PayChain's 8-digit half of the NCBA Virtual Account number — NCBA
  // concatenates its own 4-digit institution prefix with this to form the
  // full 12-digit virtual account merchants receive M-Pesa/EFT/PesaLink
  // funds on (e.g. prefix "9868" + this "00000001" -> "986800000001").
  // Zero-padded, exactly 8 digits, auto-assigned on merchant creation (see
  // the pre-save hook below) — this is how inbound NCBA reconciliation
  // pushes are matched back to a merchant. See utils/ncbaValidators.js.
  ncbaMerchantCode: {
    type: String,
    default: null,
    unique: true,
    sparse: true,
  },
  // Deprecated — used to cache NCBA's own Dynamic QR image (a link to
  // NCBA's c2bportal.ncbagroup.com checkout, not a native M-PESA prompt).
  // Replaced by checkoutQrCodeDataUri below; left in place (unread) rather
  // than migrated, since any old value here is now simply stale, not
  // reused for anything.
  ncbaAccountQrCodeDataUri: {
    type: String,
    default: null,
  },
  // Cached, PayChain-branded QR (PayChain logo composited in the center)
  // encoding a link to this merchant's own /pay/account/:code checkout page
  // — same open-amount "Scan to Pay" QR (Wallet / My Accounts), but hosted
  // and controlled entirely by PayChain rather than depending on NCBA's own
  // QR product. Content is fixed once ncbaMerchantCode is assigned, so it's
  // generated once and cached here (see mpesaController.js#generateAccountQr)
  // rather than re-rendered on every page/modal load.
  checkoutQrCodeDataUri: {
    type: String,
    default: null,
  },
  settlementMobile: {
    type: String,
    default: null,
  },
  // Deprecated — bulk pay used to be guarded by its own separate PIN.
  // Nothing writes or checks this field anymore; every money-movement flow
  // (including bulk-pay authorization) now shares the single `appPin`
  // below, same as an M-Pesa or bank card PIN confirms every transaction.
  // Kept only so any legacy hash already on a document isn't silently
  // dropped by a schema change.
  bulkPayPin: {
    type: String,
    select: false,
    default: null,
  },
  appPin: {
    type: String,
    select: false,
    default: null,
  },
  // Account-level PIN brute-force lockout — IP rate limiting alone is
  // bypassable via botnets/proxies and doesn't protect a single targeted
  // account. See utils/pinLockout.js for the read/write helpers; every PIN
  // check in the app (payment PIN, bulk-pay PIN) goes through it.
  failedPinAttempts: {
    type: Number,
    select: false,
    default: 0,
  },
  pinLockedUntil: {
    type: Date,
    select: false,
    default: null,
  },
  // Same account-level lockout as the PIN fields above, but for OTP
  // brute-forcing — per-IP rate limiting alone doesn't stop a distributed
  // attacker from spreading guesses across many IPs against one account.
  // See utils/otpLockout.js.
  failedOtpAttempts: {
    type: Number,
    select: false,
    default: 0,
  },
  otpLockedUntil: {
    type: Date,
    select: false,
    default: null,
  },
  // Separate PIN for the Developer API's unattended payout endpoint — never
  // the same value as appPin. appPin is meant for lockout-protected,
  // human-paced mobile entry; reusing it here would mean that same secret
  // also lives in a third party's server config. Deliberately its own
  // field, own hash, own lockout counters (see utils/apiPayoutPinLockout.js
  // — pinLockout.js is hardcoded to appPin's field names and can't be
  // reused as-is for a second PIN).
  apiPayoutPin: {
    type: String,
    select: false,
    default: null,
  },
  apiPayoutEnabled: {
    type: Boolean,
    default: false,
  },
  apiPayoutCaps: {
    perTransactionKes: { type: Number, default: 0 },
    dailyKes: { type: Number, default: 0 },
  },
  failedApiPayoutPinAttempts: {
    type: Number,
    select: false,
    default: 0,
  },
  apiPayoutPinLockedUntil: {
    type: Date,
    select: false,
    default: null,
  },
  // Verifies a Developer account's claim to control this merchant when
  // linking (see developerMerchantLinkController.js). Deliberately separate
  // from the login otp/otpExpires fields above — sharing them would let a
  // link-merchant request racing a merchant's own in-flight login silently
  // overwrite each other's pending code.
  developerLinkOtp: {
    type: String,
    select: false,
    default: null,
  },
  developerLinkOtpExpires: {
    type: Date,
    select: false,
    default: null,
  },
  registrationSource: {
    type: String,
    enum: ['web', 'mobile'],
    default: 'web',
  },
  // Set only by adminController.js's createMerchant when an admin explicitly
  // marks a merchant as a demo/evidence account (Stellar grant deliverable
  // pipeline) — never by self-serve signup. Two things key off this: (1) a
  // Stellar testnet wallet is auto-provisioned at creation instead of the
  // normal opt-in activate-wallet flow, and (2) the M-Pesa confirmationURL
  // webhook auto-converts every incoming payment to on-chain USDC regardless
  // of the global AUTO_INFLATION_SHIELD_ENABLED flag (see mpesaController.js)
  // — real merchants are completely unaffected either way.
  isDemoMerchant: {
    type: Boolean,
    default: false,
  },
  // ── Onboarding-Officer KYC pipeline (unset for self-serve merchants) ──
  // kybStatus has NO default — it must stay genuinely absent on every
  // merchant created by self-serve signup or the admin direct-onboard flow,
  // so `Merchant.find({ kybStatus: { $exists: true } })` scopes the officer
  // queue to officer-originated applications only, permanently, with no
  // migration/backfill needed for pre-existing merchants.
  businessType: {
    type: String,
    default: null,
    trim: true,
  },
  // Collected at self-serve signup (Login.jsx/Login.tsx's business-details
  // step) — previously gathered client-side and silently discarded, never
  // sent to or accepted by this endpoint. Free-text like businessType
  // above (not an enum) so it stays valid regardless of which list the
  // frontend currently offers; registerMerchant still validates against
  // the canonical option set before persisting.
  county: {
    type: String,
    default: null,
    trim: true,
  },
  businessArea: {
    type: String,
    default: null,
    trim: true,
  },
  employeeCount: {
    type: String,
    default: null,
    trim: true,
  },
  isEcommerce: {
    type: Boolean,
    default: null,
  },
  // Consent record for the Privacy Policy / Terms of Service checkbox on
  // signup — a real compliance requirement, not just a client-side submit
  // gate. registerMerchant rejects signup outright when this isn't true.
  agreedToTerms: {
    type: Boolean,
    default: false,
  },
  agreedToTermsAt: {
    type: Date,
    default: null,
  },
  kybStatus: {
    type: String,
    enum: ['pending', 'requires_revision', 'approved', 'rejected'],
  },
  kybDocuments: {
    type: [{
      type: { type: String, enum: ['business_registration', 'kra_pin', 'national_id', 'address_proof'], required: true },
      url: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      note: { type: String, default: null },
    }],
    default: [],
  },
  // Optional evidence an onboarding officer photographs on-site (e.g. the
  // shopfront) as due-diligence proof the business physically exists.
  // Unlike kybDocuments these aren't a required checklist item and carry no
  // approve/reject workflow — they're supplementary, admin-reviewed only.
  businessPhotos: {
    type: [{
      url: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  kybChecklist: {
    legalNameMatch: { type: Boolean, default: false },
    ubosIdentified: { type: Boolean, default: false },
    kraPinVerified: { type: Boolean, default: false },
    tillVerified: { type: Boolean, default: false },
    businessTypeCompliant: { type: Boolean, default: false },
  },
  riskTier: {
    type: String,
    enum: ['low', 'medium', 'high'],
  },
  onboardingOfficerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  kybNotes: {
    type: [{
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      authorName: { type: String, default: null },
      note: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  submittedAt: {
    type: Date,
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  resubmissionCount: {
    type: Number,
    default: 0,
  },
  // Public resubmission link token (sha256 hex at rest) — same shape as
  // passwordResetToken above. Lets an applicant fix flagged KYC documents
  // without officer involvement or re-entering everything from scratch.
  kybResubmitToken: {
    type: String,
    select: false,
    default: null,
  },
  kybResubmitTokenExpires: {
    type: Date,
    select: false,
    default: null,
  },
  // Authoritative for "has at least one real WebAuthn passkey registered
  // on the web dashboard" — written ONLY by webauthnController.js (true on
  // first passkey registration, false when the last one is deleted). Never
  // write this from the mobile app's local Face/Touch ID toggle below —
  // that's a completely different, device-local feature (no WebAuthn
  // credential involved at all) and the two were previously sharing this
  // one flag, which let a mobile-only merchant show as "biometrics
  // enabled" on web with zero actual passkeys — the web onboarding prompt
  // would then silently never offer to set one up, and biometric web login
  // would have nothing to authenticate against.
  biometricsEnabled: {
    type: Boolean,
    default: false,
  },
  // Mobile app's own Face ID/Touch ID *device unlock* toggle (via
  // expo-local-authentication) — gates re-entering the already-authenticated
  // app locally, not a login credential. Deliberately separate from
  // biometricsEnabled above; see that field's comment for why they were
  // merged before and why that was wrong.
  mobileBiometricUnlockEnabled: {
    type: Boolean,
    default: false,
  },
  settlementBankName: {
    type: String,
    default: null,
  },
  settlementBankAccount: {
    type: String,
    default: null,
  },
  // NCBA bank clearing code (see config/kenyanBankCodes.js) for
  // settlementBankAccount — required to route a merchant's own bank
  // withdrawal through NCBA PesaLink/RTGS.
  settlementBankCode: {
    type: String,
    default: null,
  },
  kesBalance: {
    type: Number,
    default: 0,
  },
  features: {
    // Both default to off as of 2026-08-11 — every new merchant signs up
    // without Digital Wallet or Inflation Shield visible at all, until an
    // admin explicitly turns it on for that merchant (Merchants.jsx's
    // "Feature Access" panel → PATCH /api/admin/merchants/:id/features).
    // Same pattern cashAdvanceForm already used below.
    digitalWallet: {
      type: Boolean,
      default: false
    },
    inflationShield: {
      type: Boolean,
      default: false
    },
    // Defaults to off — Cash Advance is a credit product that likely falls
    // under CBK's Digital Credit Providers Regulations, 2022, and licensing
    // status hasn't been confirmed. Re-enable per-merchant (or flip this
    // default back) once that's resolved, not before.
    cashAdvanceForm: {
      type: Boolean,
      default: false
    }
  },
  stellarPublicKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  stellarEncryptedSecretKey: {
    type: String,
    select: false,
  },
  usdcBalance: {
    type: Number,
    default: 0,
  },
  // WebAuthn Passkeys — each device gets its own entry.
  // credentialID is base64url, publicKey is base64.
  // `select: false` keeps passkey data out of every normal query.
  passkeys: {
    type: [{
      credentialID: { type: String, required: true },
      publicKey:    { type: String, required: true },
      counter:      { type: Number, required: true, default: 0 },
      deviceType:   { type: String, default: 'singleDevice' },
      backedUp:     { type: Boolean, default: false },
      transports:   [String],
      userAgent:    { type: String, default: null },
      platform:     { type: String, default: null },
      // Merchant-assigned name (e.g. "My iPhone", "Work Laptop") — falls
      // back to the auto-derived userAgent/platform label on the frontend
      // when unset, but a real name survives a browser/OS update changing
      // the user-agent string, which the auto label doesn't.
      label:        { type: String, default: null, trim: true, maxlength: 60 },
      createdAt:    { type: Date, default: Date.now },
      lastUsed:     { type: Date, default: null },
    }],
    select: false,
    default: [],
  },
  // Temporary WebAuthn challenge stored server-side between options and
  // verify calls. currentChallengeAt lets verify calls reject a stale
  // challenge (e.g. a browser tab left open mid-flow) instead of trusting
  // one indefinitely — defense-in-depth on top of the challenge itself
  // already being single-use (cleared right after a successful verify).
  currentChallenge: {
    type: String,
    select: false,
    default: null,
  },
  currentChallengeAt: {
    type: Date,
    select: false,
    default: null,
  },
  // Identity-recovery security questions. Answers are bcrypt-hashed and
  // never returned to the client — only the question text is exposed.
  securityQuestions: {
    type: [{
      question:   { type: String, required: true },
      answerHash: { type: String, required: true },
    }],
    select: false,
    default: [],
  },
  // select: false — a live OTP is a bearer credential for login/password-reset.
  // Previously selectable by default, which meant ANY endpoint that returned
  // a full Merchant document without an explicit field allowlist (e.g. the
  // officer KYB application-detail view) leaked the merchant's current
  // pending OTP verbatim, letting anyone who could read that response
  // complete the merchant's login or password reset. Every call site that
  // legitimately needs these now explicitly `.select('+otp +otpExpires')`.
  otp: {
    type: String,
    select: false,
    default: null,
  },
  otpExpires: {
    type: Date,
    select: false,
    default: null,
  },
  // Which channel the currently-pending `otp` was dispatched through — set
  // whenever a fresh OTP is minted (login/resend) so "resend" can repeat the
  // same channel the merchant originally received without the client having
  // to track/re-send that context itself. Not itself a secret, but kept
  // alongside otp/otpExpires since it's meaningless without them.
  otpChannel: {
    type: String,
    enum: ['email', 'sms'],
    select: false,
    default: 'email',
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginCount: {
    type: Number,
    default: 0,
  },
  // Bumped whenever "Sign Out All Devices" runs. Embedded in every issued JWT
  // (see generateToken) — a token whose tokenVersion doesn't match this value
  // is treated as revoked, even though JWTs are otherwise stateless.
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // One-shot markers for the dormancy email reminders (see
  // services/dormancyReminderService.js) — set when a notice goes out,
  // cleared automatically the next time the merchant is active again, so a
  // merchant who goes dormant more than once gets reminded every time, not
  // just the first.
  dormancyReminderSentAt: {
    type: Date,
    default: null,
  },
  dormancyFinalWarningSentAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

// Encrypt password using bcrypt
merchantSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  // 12 rounds = OWASP 2024 recommendation. Existing rounds=10 hashes still
  // verify correctly via bcrypt.compare (rounds are embedded in the hash).
  // Trimmed for the same reason matchPassword below trims the candidate —
  // copying a password out of an email often drags along a trailing
  // space/newline invisibly, which typing the same password never does.
  // Hashing and comparing on the same trimmed string keeps both paths
  // consistent regardless of which one was used when the password was set.
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(String(this.password).trim(), salt);
});

// Auto-assign an NCBA merchant code to every new merchant. Random rather
// than sequential (see generateRandomMerchantCode) so codes don't read as
// "00000001, 00000002, ..." to a customer paying by hand. Checked against
// the DB before assigning — the unique index on ncbaMerchantCode is the
// final backstop if two signups ever raced on the same random value.
merchantSchema.pre('save', async function() {
  if (!this.isNew || this.ncbaMerchantCode) {
    return;
  }

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateRandomMerchantCode();
    const [exists, retired] = await Promise.all([
      this.constructor.exists({ ncbaMerchantCode: candidate }),
      RetiredMerchantCode.exists({ type: 'ncbaMerchantCode', code: candidate }),
    ]);
    if (!exists && !retired) {
      this.ncbaMerchantCode = candidate;
      return;
    }
  }
  throw new Error('Failed to generate a unique NCBA merchant code after multiple attempts');
});

// Match user entered password to hashed password in database.
// Trimmed — a password pasted from an email/password-manager can carry an
// invisible trailing space or newline that typing the same password never
// produces, which otherwise fails bcrypt.compare even though it "looks"
// identical to the user.
merchantSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(String(enteredPassword).trim(), this.password);
};

const Merchant = mongoose.model('Merchant', merchantSchema);

export default Merchant;
