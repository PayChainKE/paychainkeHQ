import mongoose from 'mongoose';

// One row per Stellar-side settlement event for a Stellar pilot merchant
// (the isDemoMerchant accounts): either the auto-routed share of an incoming
// M-Pesa payment ('split_settlement', KES -> testnet USDC) or a merchant's
// Request Payout ('redemption', testnet USDC debited on-chain + a SIMULATED
// M-Pesa B2C disbursement). It is the source for the reconciliation table /
// statement that links each row to its StellarExpert testnet transaction.
//
// Testnet + simulated fiat only — nothing here moves real money.
const StellarLedgerEntrySchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  kind: { type: String, enum: ['split_settlement', 'redemption'], required: true },
  // pending: on-chain leg not finished yet. completed: confirmed on the
  // ledger. failed: definitively rejected (nothing moved, KES refunded).
  // unconfirmed: the network call timed out / errored ambiguously — it may or
  // may not have landed, so it is never auto-refunded (that could pay twice);
  // it stays visible for reconciliation against the on-chain balance.
  status: { type: String, enum: ['pending', 'completed', 'failed', 'unconfirmed'], default: 'pending' },
  // The incoming payment (Transaction.reference) a split was taken from.
  sourceReference: { type: String, default: null },
  splitPercent: { type: Number, default: null },
  kesAmount: { type: Number, default: 0 },
  usdcAmount: { type: Number, default: 0 },
  // USDC per 1 KES at the time.
  rate: { type: Number, default: null },
  stellarTxHash: { type: String, default: null },
  receiptHash: { type: String, default: null },
  // Redemptions only: the simulated Safaricom B2C request/response. Never sent
  // anywhere — generated locally and stored for the audit trail.
  simulatedB2C: { type: mongoose.Schema.Types.Mixed, default: null },
  destinationPhoneMasked: { type: String, default: null },
  errorCode: { type: String, default: null },
  errorMessage: { type: String, default: null },
}, { timestamps: true });

StellarLedgerEntrySchema.index({ merchantId: 1, createdAt: -1 });
// At most one split per incoming payment, so a webhook retry can never split
// the same payment twice.
StellarLedgerEntrySchema.index(
  { kind: 1, sourceReference: 1 },
  { unique: true, partialFilterExpression: { kind: 'split_settlement', sourceReference: { $type: 'string' } } }
);

export default mongoose.model('StellarLedgerEntry', StellarLedgerEntrySchema);
