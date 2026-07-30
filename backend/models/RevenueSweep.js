import mongoose from 'mongoose';

// One row per attempted weekly sweep of PayChain's accrued transaction fees
// out of the pooled NCBA paybill (where merchant funds also sit) into
// PayChain's own bank account. `amount` is only ever what was actually
// transferred — status 'completed' rows are the sole source of truth for
// "how much of PayChain's revenue has been physically moved out," which
// revenueSweepService.js uses to compute what's still owed next run.
const revenueSweepSchema = new mongoose.Schema({
  periodStart: { type: Date, required: true },
  periodEnd:   { type: Date, required: true },
  // What this run attempted to move — equals `amount` on success, or the
  // computed-but-unmet figure on 'skipped'/'failed' rows (for visibility).
  attemptedAmount: { type: Number, required: true },
  amount: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['completed', 'failed', 'skipped'],
    required: true,
  },
  destinationBankCode: { type: String, default: null },
  destinationAccountNumber: { type: String, default: null },
  // NCBA's TransactionID for a completed PesaLink transfer — the audit
  // trail linking this row to the real bank-side movement.
  ncbaReference: { type: String, default: null },
  failureReason: { type: String, default: null },
  // True when this 'completed' row was produced with NCBA_OPENBANKING_LIVE_ENABLED
  // off — nothing physically moved. computeUnsweptRevenue() must exclude these
  // from "already swept" or a test run permanently (and silently) writes off
  // real revenue as transferred when it never left the pooled account.
  simulated: { type: Boolean, default: false },
}, {
  timestamps: true,
});

export default mongoose.model('RevenueSweep', revenueSweepSchema);
