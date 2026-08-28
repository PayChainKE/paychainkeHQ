import mongoose from 'mongoose';

// Temporary diagnostic (2026-08-28): captures the full raw fields of every
// NCBA account-notification DEBIT (an outbound PayChain payout, e.g. Lipa
// na M-Pesa/Mobile B2W) — normally ignored outright by
// ncbaAccountNotificationController.js since that feed is built for
// inbound customer collections. This is the only feed confirmed to
// reliably arrive for a Lipa na M-Pesa payout (the dedicated settlement
// callback to handlePesaLinkCallback has never been observed arriving, and
// NCBA's TransactionStatusQuery is confirmed broken). Purpose: check
// whether Narrative/AccountNr/CustomerName ever echoes back our own
// reqTransactionReferenceNo/reqChnlId — if so, this feed could resolve
// stuck payouts (and fire their SMS) instead of waiting on a callback or
// status query that don't work. Never read by any live code path.
// Auto-expires after 14 days.
const NcbaDebitNotificationSampleSchema = new mongoose.Schema({
  transId: { type: String, default: null },
  txnType: { type: String, default: null },
  rawTransAmount: { type: String, default: null },
  rawNarrative: { type: String, default: null },
  rawAccountNr: { type: String, default: null },
  rawCustomerName: { type: String, default: null },
  rawPhoneNr: { type: String, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

NcbaDebitNotificationSampleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const NcbaDebitNotificationSample = mongoose.model('NcbaDebitNotificationSample', NcbaDebitNotificationSampleSchema);
export default NcbaDebitNotificationSample;
