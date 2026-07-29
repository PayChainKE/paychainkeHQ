import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateRandomMerchantCode } from '../utils/ncbaValidators.js';

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
  paybillAccount: {
    type: String,
    unique: true,
    minlength: 5,
    maxlength: 5,
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
  settlementMobile: {
    type: String,
    default: null,
  },
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
  registrationSource: {
    type: String,
    enum: ['web', 'mobile'],
    default: 'web',
  },
  biometricsEnabled: {
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
  // withdrawal through NCBA PesaLink/EFT.
  settlementBankCode: {
    type: String,
    default: null,
  },
  kesBalance: {
    type: Number,
    default: 0,
  },
  features: {
    digitalWallet: {
      type: Boolean,
      default: true
    },
    inflationShield: {
      type: Boolean,
      default: true
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
      createdAt:    { type: Date, default: Date.now },
      lastUsed:     { type: Date, default: null },
    }],
    select: false,
    default: [],
  },
  // Temporary WebAuthn challenge stored server-side between options and verify calls.
  currentChallenge: {
    type: String,
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
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  // Which channel the currently-pending `otp` was dispatched through — set
  // whenever a fresh OTP is minted (login/resend) so "resend" can repeat the
  // same channel the merchant originally received without the client having
  // to track/re-send that context itself.
  otpChannel: {
    type: String,
    enum: ['email', 'sms'],
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
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
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
    const exists = await this.constructor.exists({ ncbaMerchantCode: candidate });
    if (!exists) {
      this.ncbaMerchantCode = candidate;
      return;
    }
  }
  throw new Error('Failed to generate a unique NCBA merchant code after multiple attempts');
});

// Match user entered password to hashed password in database
merchantSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Merchant = mongoose.model('Merchant', merchantSchema);

export default Merchant;
