import mongoose from 'mongoose';

// Permanent record of account-identifier codes that once belonged to a
// merchant who was later hard-deleted (see adminController.js's
// `delete` action, which wipes the Merchant document entirely). Without
// this, the random code generator for ncbaMerchantCode only checks
// uniqueness against merchants that currently exist, so a deleted
// merchant's 12-digit NCBA account number could be re-drawn and handed to
// a brand-new, unrelated merchant — a customer who saved the old number
// for repeat payments would then silently pay the wrong business. Rows
// here are never deleted or expired; the generator must check this
// collection forever, not just at delete-time.
//
// Note: existing rows with type 'paybillAccount' (from before the legacy
// Safaricom Daraja Paybill sub-account field was removed) are left as
// historical data — never queried, harmless to leave in place.
const RetiredMerchantCodeSchema = new mongoose.Schema({
  type: { type: String, enum: ['ncbaMerchantCode', 'paybillAccount'], required: true },
  code: { type: String, required: true },
  formerMerchantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  formerBusinessName: { type: String, default: null },
}, { timestamps: true });

RetiredMerchantCodeSchema.index({ type: 1, code: 1 }, { unique: true });

const RetiredMerchantCode = mongoose.model('RetiredMerchantCode', RetiredMerchantCodeSchema);
export default RetiredMerchantCode;
