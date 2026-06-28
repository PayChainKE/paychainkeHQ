import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  kesBalance: {
    type: Number,
    default: 0,
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
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginCount: {
    type: Number,
    default: 0,
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

// Match user entered password to hashed password in database
merchantSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Merchant = mongoose.model('Merchant', merchantSchema);

export default Merchant;
