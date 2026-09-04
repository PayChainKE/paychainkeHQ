import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Third-party account type for the public Developer API — distinct from
// Merchant (moves the developer's own money) and Admin/Officer (internal
// staff). A Developer only ever authenticates to manage their own API keys;
// actual API traffic authenticates via ApiKey, not this model's JWT.
const developerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a contact name'],
    trim: true,
  },
  companyName: {
    type: String,
    required: [true, 'Please add a company name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    // Linear-time shape check — see models/Merchant.js's identical field
    // for why the old pattern was a catastrophic-backtracking DoS,
    // reachable here from the public POST /api/auth/developer/register.
    match: [
      /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      'Please add a valid email',
    ],
  },
  phone: {
    type: String,
    default: null,
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 8,
    select: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  // pending_verification: signed up, hasn't completed OTP verification yet.
  // active: verified, can sign in and manage sandbox keys.
  // suspended: admin-disabled — blocks sign-in entirely (see protectDeveloper).
  status: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended'],
    default: 'pending_verification',
    index: true,
  },
  // Gate for live-mode (real money) API keys — separate from `status`
  // because a developer can be a fully verified, active account and still
  // not be cleared to move real funds until an admin reviews them. Mirrors
  // the Merchant KYB pending->approved shape.
  liveAccess: {
    approved: { type: Boolean, default: false },
    requestedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  // Set once this developer proves control of a Merchant account (see
  // developerMerchantLinkController.js) — the public payment API operates
  // on this merchant's own wallet, never a separate developer-owned one.
  linkedMerchant: {
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null },
    linkedAt: { type: Date, default: null },
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  // Bumped on logout — embedded in every issued JWT so a token issued
  // before the bump is treated as revoked. Same mechanism as Admin/Merchant.
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // select:false — a live OTP is a bearer credential for verification/login.
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
  otpChannel: {
    type: String,
    enum: ['email'],
    select: false,
    default: 'email',
  },
  // Account-level OTP brute-force lockout — see utils/otpLockout.js, which
  // is generic over any model carrying these two fields.
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
}, {
  timestamps: true,
});

// Same shape as Merchant.js's pre-save hook — 12 rounds (OWASP 2024),
// trimmed before hashing so a copy-pasted password with a trailing
// space/newline still verifies consistently against matchPassword below.
developerSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(String(this.password).trim(), salt);
});

developerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(String(enteredPassword).trim(), this.password);
};

const Developer = mongoose.model('Developer', developerSchema);

export default Developer;
