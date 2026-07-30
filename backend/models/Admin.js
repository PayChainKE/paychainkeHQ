import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    default: '',
    trim: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'analyst', 'officer'],
    default: 'owner',
  },
  avatarUrl: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active',
    index: true,
  },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  invitedAt: { type: Date, default: null },
  // Setup-token for newly-invited members (sha256 hashed).
  passwordResetToken: { type: String, select: false, default: null },
  passwordResetExpires: { type: Date, select: false, default: null },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginCount: {
    type: Number,
    default: 0,
  },
  password: {
    type: String,
    // Optional at insert time so invited admins can be created before they
    // set their own password via the setup link. Login flow still requires
    // a hash to be present; setup flow writes one.
    select: false,
    default: null,
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  // Sensitive admin actions (freeze/delete merchant, etc.) require a fresh
  // OTP that is *bound* to a specific action+target. We store the sha256 of
  // the OTP plus the action + targetId so an OTP minted for "freeze X" can
  // never be replayed against "delete Y".
  pendingAction: {
    action: { type: String, default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    otpHash: { type: String, default: null, select: false },
    expiresAt: { type: Date, default: null },
  },
}, {
  timestamps: true
});

// Hash password before saving
AdminSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  // 12 rounds = OWASP 2024 recommendation. Existing rounds=10 hashes still
  // verify correctly via bcrypt.compare (rounds are embedded in the hash).
  // Trimmed for the same reason matchPassword below trims the candidate —
  // see Merchant.js's identical pre-save hook for the full rationale.
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(String(this.password).trim(), salt);
});

// Match password. Trimmed — a pasted password (e.g. from the officer
// credentials email) can carry an invisible trailing space/newline that
// typing the same password never produces.
AdminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(String(enteredPassword).trim(), this.password);
};

const Admin = mongoose.model('Admin', AdminSchema, 'admins');

export default Admin;
