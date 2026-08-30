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
  // The real NCBA fee for moving this transfer, looked up via NCBA's own
  // ChargeInquiry endpoint before submission (see
  // services/ncbaOpenBankingService.js#getNcbaChargeInquiry). Kept separate
  // from `amount` (which stays "what actually landed at PayChain's revenue
  // account," so the notification email's "KES X moved" claim never
  // changes) — but computeUnsweptRevenue() sums amount + bankChargeAmount
  // as what left the pooled account, so a real bank charge on the sweep
  // itself is never mistaken for revenue that's still sitting unswept in
  // the shared pool. 0 when the inquiry wasn't available/failed (fails
  // open — a charge-lookup hiccup must never block a real sweep) or on a
  // simulated run.
  bankChargeAmount: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['completed', 'failed', 'skipped'],
    required: true,
  },
  destinationBankCode: { type: String, default: null },
  destinationAccountNumber: { type: String, default: null },
  // Recorded for the audit trail / an NCBA support ticket, not used to place
  // the transfer itself (NCBA's Internal Funds Transfer API takes only the
  // account number — see services/ncbaOpenBankingService.js).
  destinationBranchCode: { type: String, default: null },
  destinationSwiftCode: { type: String, default: null },
  // NCBA's TransactionID for a completed PesaLink transfer — the audit
  // trail linking this row to the real bank-side movement.
  ncbaReference: { type: String, default: null },
  failureReason: { type: String, default: null },
  // True when this 'completed' row was produced with NCBA_OPENBANKING_LIVE_ENABLED
  // off — nothing physically moved. computeUnsweptRevenue() must exclude these
  // from "already swept" or a test run permanently (and silently) writes off
  // real revenue as transferred when it never left the pooled account.
  simulated: { type: Boolean, default: false },
  // Admin "clear" on the Revenue page — hides the row from the sweep
  // history list without touching the underlying data. Deliberately never
  // read by revenueSweepService.js's computeUnsweptRevenue() or anything
  // else that sums real sweep amounts — archiving is a display-only filter,
  // the row still counts as a real completed/failed/skipped attempt. The
  // full CSV export ignores this flag too, so nothing is ever actually lost.
  archived:   { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, {
  timestamps: true,
});

export default mongoose.model('RevenueSweep', revenueSweepSchema);
