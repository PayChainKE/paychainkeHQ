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
  password: {
    type: String,
    required: [true, 'Password is required'],
    // Never return the hash on default queries. Controllers must opt in
    // via .select('+password') when they need to compare on login.
    select: false,
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
  if (!this.isModified('password')) {
    return;
  }
  // 12 rounds = OWASP 2024 recommendation. Existing rounds=10 hashes still
  // verify correctly via bcrypt.compare (rounds are embedded in the hash).
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
AdminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Admin = mongoose.model('Admin', AdminSchema, 'admins');

export default Admin;
