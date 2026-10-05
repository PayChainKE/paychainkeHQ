import mongoose from 'mongoose';

// A real NCBA credit notification arrived (money genuinely landed on
// PayChain's account) but ncbaAccountNotificationController.js couldn't
// figure out which merchant it belongs to (extractMerchantCode found no
// usable code in AccountNr/Narrative/CustomerName) — so no Transaction was
// ever created and the merchant was never credited or notified. Previously
// this only hit console logs (ncba_account_notification_unattributed),
// which meant finding out about it depended on a merchant complaining
// days later and someone remembering to check Render's log retention
// window. Persisted here instead so it survives, is queryable after the
// fact, and (see adminController.js's notifyAdmins call at the point this
// is created) triggers an immediate admin email — the same real-money-risk
// treatment as a missed-collection reconciliation flag, just raised the
// moment it happens instead of waiting for the next hourly sweep.
const NcbaUnattributedCreditSchema = new mongoose.Schema({
  transId: { type: String, default: null },
  txnType: { type: String, default: null },
  amount: { type: Number, default: null },
  rawAccountNr: { type: String, default: null },
  rawNarrative: { type: String, default: null },
  rawCustomerName: { type: String, default: null },
  rawPhoneNr: { type: String, default: null },
  // Set once an admin has traced this to a real merchant and credited it
  // (via the existing Credit Missed Collection tool, or a manual fix) —
  // purely a bookkeeping flag so a resolved entry stops looking like an
  // open problem; nothing in this app re-reads this field automatically.
  resolved: { type: Boolean, default: false },
  resolvedNote: { type: String, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

NcbaUnattributedCreditSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const NcbaUnattributedCredit = mongoose.model('NcbaUnattributedCredit', NcbaUnattributedCreditSchema);
export default NcbaUnattributedCredit;
