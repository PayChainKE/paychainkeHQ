import mongoose from 'mongoose';

// The public-facing "payment object" the Developer API returns — a stable
// abstraction over two very different underlying realities: a real payment
// (mode:'live', backed by a real Transaction/STKRequest that actually moves
// KES) and a fully simulated one (mode:'test', synthetic pending->success
// with zero rail calls and zero balance changes). Kept as its own
// collection rather than overloading Transaction/STKRequest so simulated
// test traffic can never leak into ledger/revenue/wallet-audit aggregations
// that don't know to filter it out — nothing else in the app queries this.
const developerPaymentSchema = new mongoose.Schema({
  developerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Developer', required: true, index: true },
  apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  mode: { type: String, enum: ['test', 'live'], required: true },
  kind: { type: String, enum: ['collect', 'payout'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'KES' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  failureReason: { type: String, default: null },
  reference: { type: String, default: null },
  // Scoped per-developer (see claimClientIdempotencyKey) — kept here too,
  // read-only, purely so a GET can show the caller what key produced this
  // payment; the guard itself lives in PayoutIdempotencyGuard.
  idempotencyKey: { type: String, required: true, index: true },
  // { phone } for a collect, { bankCode, accountNumber, accountName } (bank),
  // { phone, network } (mobile money), or { paybillNumber | tillNumber,
  // accountReference } (paybill/till) for a payout.
  counterparty: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Only ever set for mode:'live' — the real record once it exists.
  linkedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  linkedStkCheckoutId: { type: String, default: null },
  // Set for a live mobile-money/paybill/till payout — those rails confirm
  // asynchronously (unlike bank, which resolves synchronously below), so
  // this is how resolvePendingOpenBankingTransaction (ncbaOpenBankingController.js)
  // finds this record to sync once NCBA's callback (or the reconciliation
  // sweep) actually resolves it. Same matching idiom as linkedStkCheckoutId
  // above, just for a different async rail.
  linkedPayoutReference: { type: String, default: null },
}, {
  timestamps: true,
});

const DeveloperPayment = mongoose.model('DeveloperPayment', developerPaymentSchema);

export default DeveloperPayment;
