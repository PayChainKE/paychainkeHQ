import mongoose from 'mongoose';

// Diagnostic-only record: every time an NCBA account-notification credit
// arrives with no usable payer MSISDN in PhoneNr, CustomerName, or
// Narrative (see ncbaAccountNotificationController.js's
// 'ncba_account_notification_customer_sms_skipped_no_phone' log event —
// this mirrors that same log line into the database instead of leaving it
// only in Render's console, so it can be queried directly rather than
// requiring live log-tailing at the exact moment a payment lands).
// Purely for root-causing why the customer payment-receipt SMS keeps
// getting skipped; never read by any live code path. Auto-expires after 30
// days — there's no reason to keep this once the underlying parsing gap
// is understood and fixed (or confirmed to be an NCBA-side data gap).
const NcbaPhoneExtractionMissSchema = new mongoose.Schema({
  transId: { type: String, default: null },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null },
  rawTransType: { type: String, default: null },
  rawPhoneNr: { type: String, default: null },
  rawCustomerName: { type: String, default: null },
  rawNarrative: { type: String, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

NcbaPhoneExtractionMissSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const NcbaPhoneExtractionMiss = mongoose.model('NcbaPhoneExtractionMiss', NcbaPhoneExtractionMissSchema);
export default NcbaPhoneExtractionMiss;
