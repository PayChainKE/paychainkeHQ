import mongoose from 'mongoose';

// One KRA OSCU device registration per merchant per branch. `cmcKeyEncrypted`
// is the long-lived Communication Key KRA's /selectInitOsdcInfo handshake
// returns — it authenticates every subsequent call to KRA's live tax
// infrastructure for this device, so it's encrypted at rest with the same
// AES-256-GCM helper used for Stellar secret keys (utils/cryptoHelper.js),
// never stored or logged in plaintext, and excluded from default query
// projections (select: false).
const etimsConfigSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },
  // The merchant's KRA PIN, snapshotted from Merchant.kraPin at init time —
  // kept here too (not just looked up live) so a later PIN change on the
  // merchant profile can't silently invalidate an already-signed invoice's
  // stored config context.
  tin: { type: String, required: true, trim: true },
  // KRA branch code — "00" is the head office / default branch. A merchant
  // with multiple physical branches registers one EtimsConfig per bhfId.
  bhfId: { type: String, required: true, default: '00', trim: true },
  dvcSrlNo: { type: String, required: true, trim: true },
  // cryptoHelper.encryptKey format: "ivHex:authTagHex:encryptedHex". Null
  // until initializeDevice() succeeds.
  cmcKeyEncrypted: { type: String, default: null, select: false },
  // Ascending, per-branch, uninterrupted — KRA rejects any gap or
  // out-of-order invcNo. Incremented atomically via $inc (findByIdAndUpdate),
  // never read-then-write, so two concurrent sales on the same branch can
  // never claim the same number.
  lastInvcNo: { type: Number, default: 0 },
  isInitialized: { type: Boolean, default: false },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  initializedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  // Set every time an activation attempt runs — including a failed one.
  // Lets the automatic (no-merchant-action) activation in
  // invoicingService.ensureEtimsDevice back off after a failure instead of
  // re-hitting KRA's real infrastructure on every single invoice a
  // not-yet-OSCU-approved merchant sends.
  lastAttemptAt: { type: Date, default: null },
}, { timestamps: true });

etimsConfigSchema.index({ merchantId: 1, bhfId: 1 }, { unique: true });

export default mongoose.model('EtimsConfig', etimsConfigSchema);
