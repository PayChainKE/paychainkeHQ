import mongoose from 'mongoose';

// One row per manual reconciliation check — there's no NCBA API to pull the
// real pooled account balance automatically (no such endpoint exists in
// their Open Banking integration), so an admin pastes in the real balance
// from NCBA's own statement/online banking, and this records what PayChain's
// own ledger expected it to be at that moment, so any gap is visible and
// timestamped rather than only discovered during a manual audit.
const bankReconciliationSchema = new mongoose.Schema({
  reportedBalance: { type: Number, required: true },
  merchantBalanceTotal: { type: Number, required: true },
  merchantCount: { type: Number, required: true },
  unsweptRevenue: { type: Number, required: true },
  expectedPoolBalance: { type: Number, required: true },
  difference: { type: Number, required: true }, // reportedBalance - expectedPoolBalance
  status: { type: String, enum: ['matched', 'discrepancy'], required: true },
  note: { type: String, default: null },
  checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, {
  timestamps: true,
});

export default mongoose.model('BankReconciliation', bankReconciliationSchema);
