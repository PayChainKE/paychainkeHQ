import mongoose from 'mongoose';

// A one-time, explicit accounting adjustment that offsets real bank/tax
// charges (BankAccountCharge) against PayChain's running unswept-revenue
// total — WITHOUT pretending those charges never happened (they stay in
// BankAccountCharge exactly as recorded). Exists because
// computeUnsweptRevenue() is an all-time running total: once real Excise
// Duty/Withholding Tax charges outpaced accrued fee revenue (2026-09-01,
// after the bankChargeReconciliationService.js auto-detect sweep went
// live), the net figure got stuck at KES 0 and would have stayed there
// until enough NEW margin organically outpaced the OLD deficit — which,
// at the transaction volume seen so far, could take a very long time.
//
// A write-off is a deliberate decision that a historical shortfall is
// "priced in" / absorbed as a one-time cost of not having modeled Excise
// Duty sooner (see the 2026-09-01 tariff bump — config/*TariffCard.js —
// which stops new transactions from adding to the gap), and that the
// running total should stop being dragged down by it going forward.
// Never auto-created — always a deliberate admin action with a recorded
// amount, reason, and actor (see revenueController.js#writeOffRevenueDeficit).
const revenueWriteOffSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true },
  // The gross/net/charges figures at the moment of write-off, purely for
  // audit context — computeUnsweptRevenue() never reads these back.
  snapshotGrossUnswept: { type: Number, default: null },
  snapshotTotalCharges: { type: Number, default: null },
  writtenOffBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, {
  timestamps: true,
});

export default mongoose.model('RevenueWriteOff', revenueWriteOffSchema);
