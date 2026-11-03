import mongoose from 'mongoose';

// PayChain paying a merchant out of its OWN money held in the pooled NCBA
// account: a goodwill/compensation credit (e.g. a customer's payment that
// never reached the merchant and can't be traced to a bank reference).
// Not a collection: no bank event backs it, so it is funded from PayChain's
// unswept revenue. computeUnsweptRevenue (revenueSweepService.js) subtracts
// every completed row, so the revenue sweep can never move this money out
// of the pool a second time and Pool Reconciliation stays balanced.
// Created by poolCreditController.js only.
const poolGoodwillCreditSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true, trim: true },
  // Optional M-PESA/NCBA references of the original payments this makes good,
  // so a later manual credit of the same payment can be spotted.
  relatedRefs: { type: [String], default: [] },
  reference: { type: String, required: true, unique: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, { timestamps: true });

export default mongoose.model('PoolGoodwillCredit', poolGoodwillCreditSchema);
