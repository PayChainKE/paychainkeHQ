import mongoose from 'mongoose';

// A Developer's credential for calling the public API (see
// middleware/authMiddleware.js's authenticateApiKey). The plaintext key is
// shown exactly once, in the create-response — only its SHA-256 hash is
// ever persisted. SHA-256 (not bcrypt) is deliberate: the key itself is a
// 48-hex-char cryptographically random token, not a low-entropy user
// password, so a fast hash is the standard approach here (e.g. Stripe does
// the same) — bcrypt's slow-by-design cost buys nothing against a token
// that's already unguessable, and would needlessly slow every API call.
const apiKeySchema = new mongoose.Schema({
  developerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true,
    index: true,
  },
  mode: {
    type: String,
    enum: ['test', 'live'],
    required: true,
  },
  // First ~12 chars of the plaintext key (e.g. "pc_test_ab12") — safe to
  // store and display unhashed so a developer can tell keys apart in a
  // list without the full secret ever being retrievable again.
  keyPrefix: {
    type: String,
    required: true,
  },
  hashedKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  label: {
    type: String,
    default: null,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
    index: true,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;
