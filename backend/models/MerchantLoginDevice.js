import mongoose from 'mongoose';

// One row per (merchant, device+location fingerprint) ever successfully
// logged in from — the "have we seen this before" list
// utils/newDeviceLoginAlert.js checks on every completed login (password +
// OTP, or the app-review bypass — see buildMerchantSessionPayload) to warn
// a merchant the moment their account is used from somewhere unfamiliar.
// That's usually the earliest real signal of an account takeover, well
// before any money actually moves.
const merchantLoginDeviceSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },
  // sha256(userAgent + '|' + ip) — not the raw values, so this collection
  // isn't itself a second copy of PII to worry about; userAgent/ip below
  // are kept too, but only for admins to read back what tripped the alert.
  fingerprint: {
    type: String,
    required: true,
  },
  userAgent: { type: String, default: null },
  ip: { type: String, default: null },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { versionKey: false });

merchantLoginDeviceSchema.index({ merchantId: 1, fingerprint: 1 }, { unique: true });

export default mongoose.model('MerchantLoginDevice', merchantLoginDeviceSchema);
