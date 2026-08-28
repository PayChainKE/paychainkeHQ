import mongoose from 'mongoose';
import { calculateFees } from '../utils/feeCalculator.js';
import { broadcastAdminEvent } from '../utils/adminEventStream.js';
import { broadcastMerchantEvent } from '../utils/merchantEventStream.js';

const transactionSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: false
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number (virtual account) is required'],
  },
  type: {
    type: String,
    enum: ['inbound', 'outbound', 'bulk_pay', 'settlement', 'fx_swap', 'top_up', 'withdrawal', 'ncba_inbound', 'ncba_outbound', 'mpesa_b2c', 'mpesa_b2b', 'ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  kesAmount: {
    type: Number,
    default: 0
  },
  usdcAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'verified'],
    default: 'completed'
  },
  // Distinguishes WHY a payout is sitting 'pending' — only set for NCBA
  // Open Banking rails. 'ambiguous_response' means NCBA's response
  // couldn't be confidently read as success or failure (it may have
  // already gone through — never safe to blindly retry, only ever
  // resolved by a real callback or ncbaOpenBankingReconciliationService.js's
  // stuck-payout sweep). 'insufficient_funds' means NCBA gave a clear,
  // definitive rejection because the pooled account was short — nothing
  // moved, so it's safe to actively retry the same request later once
  // there's more real liquidity (see services/ncbaPayoutRetryService.js),
  // rather than just waiting out the reconciliation window.
  // 'stuck_timeout_needs_manual_review' means the payout sat 'pending' past
  // STUCK_AFTER_MS with no callback ever arriving. This does NOT get
  // auto-refunded: NCBA's TransactionStatusQuery endpoint (the only way to
  // ask "did this actually land?") is confirmed broken in production (see
  // scripts/probe-ncba-transaction-status-query.js), so there is no way to
  // tell "definitely never landed" apart from "landed but the callback was
  // lost" — and auto-refunding the latter would pay the merchant twice.
  // Stays 'pending' with the merchant's ledger balance untouched until an
  // admin checks NCBA's portal directly and resolves it by hand.
  pendingReason: {
    type: String,
    enum: ['ambiguous_response', 'insufficient_funds', 'stuck_timeout_needs_manual_review', null],
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: {
    type: Date,
    default: null
  },
  // Whatever services/ncbaPayoutRetryService.js needs to reconstruct the
  // exact original NCBA submit call for a pendingReason:'insufficient_funds'
  // transaction (e.g. Mobile B2W's beneficiaryName/recipientNumber, or
  // Lipa na M-Pesa's paymentType/payBillTillNo/accountReference) — shape
  // differs per rail, so this stays untyped rather than growing a new
  // top-level field per rail's own submit params. Only ever set alongside
  // pendingReason:'insufficient_funds'; unused/absent for every other
  // transaction.
  retryPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  sender: {
    name: String,
    id: String // e.g. Phone number
  },
  recipient: {
    name: String,
    id: String
  },
  // Per-transaction fee fields, auto-stamped at save time from the canonical
  // rate card. Persisting these (rather than always re-computing at query
  // time) means: (1) historical revenue is locked-in even if rates change,
  // (2) every PayChain account has a row-level audit trail of what was
  // charged, (3) downstream settlement systems can debit/credit directly
  // from these numbers without re-deriving them.
  paychainFee:  { type: Number, default: 0 },
  safaricomFee: { type: Number, default: 0 },
  revenueStream: { type: String, default: null },
  // The portion of paychainFee (if any) that came from PayChain's flat
  // customer-facing surcharge rather than the merchant-side tiered fee —
  // billed to the payer, not deducted from the merchant. Purely a
  // breakdown/audit field; it is always included inside paychainFee itself
  // (see utils/pricingEngine.js), so revenue sweeps and pool-balance
  // reconciliation only ever need to read paychainFee.
  customerSurchargeFee: { type: Number, default: 0 },
  // Same idea as customerSurchargeFee, but for the merchant-side portion of
  // paychainFee on a paid Invoice specifically (Electronic Invoicing's
  // "Invoice Service Fee", utils/pricingEngine.js#calculateInvoiceServiceFee)
  // — deducted from the merchant's net settlement, unlike every other
  // product's zero-merchant-fee model. Always included inside paychainFee
  // itself, same convention as customerSurchargeFee.
  invoiceServiceFee: { type: Number, default: 0 },
  // The merchant's KES balance immediately after this transaction was
  // applied — captured at write time from the atomic $inc's returned
  // document (never recomputed later), same "resulting balance" figure
  // M-Pesa's own SMS shows. Optional/null on transaction types that don't
  // stamp it yet — never back-computed from other rows.
  balanceAfter: { type: Number, default: null },
  // Which NCBA local/cross-border bank rail settled this transfer — only
  // meaningful for 'ncba_outbound' bank payouts, which can go via PesaLink
  // (immediate, 24/7/365), RTGS (T+3 hours, cross-border/multi-currency),
  // or IFT (Internal Funds Transfer, used when the destination account is
  // itself at NCBA). Null for every other transaction type. EFT was
  // removed as a supported rail (2026-08-13) — NCBA's EFT endpoint
  // rejected the confirmed PesaLink bank code with BIC_NOT_FOUND, and no
  // working code/format was found; kept in the enum below only so any
  // pre-existing 'eft' rows from before the removal stay schema-valid.
  settlementRail: { type: String, enum: ['pesalink', 'eft', 'rtgs', 'ift', null], default: null },
  // Which mobile money network the recipient's wallet is on — only
  // meaningful for 'ncba_mobile_b2w' payouts, which can target either
  // Safaricom M-Pesa or Airtel Money. Null for every other transaction type.
  mobileNetwork: { type: String, enum: ['safaricom', 'airtel', null], default: null },
}, {
  timestamps: true
});

// Auto-price every transaction on insert. Runs for both `Transaction.create`
// and `new Transaction().save()`. We re-stamp on amount/type change because
// admins may correct a transaction before it's finalised, but never re-stamp
// once the doc is saved (`isNew` guard) so historical fees stay immutable.
//
// This hook cannot tell a real revenue-generating transaction apart from a
// manually-inserted ledger correction (e.g. a REVERSAL-* entry undoing a
// duplicate credit — see the 2026-08-27 incident) — it prices purely off
// type + amount, unconditionally. A manual correction created via
// Transaction.create()/insertMany WILL get auto-stamped a nonzero
// paychainFee/safaricomFee/revenueStream here even though no real fee was
// ever collected, and every revenue aggregation in this codebase
// (backend/controllers/revenueController.js, backend/services/
// revenueSweepService.js's computeUnsweptRevenue — which decides how much
// REAL money the weekly sweep transfers out of the pooled NCBA account)
// sums directly off these persisted fields. Any script that inserts a
// correction/reversal Transaction MUST explicitly zero paychainFee,
// safaricomFee, and revenueStream in a follow-up update — this hook will
// not do it for you, and skipping it silently inflates PayChain's reported
// revenue with money that includes real merchant balance.
transactionSchema.pre('save', function() {
  if (this.isNew || this.isModified('amount') || this.isModified('kesAmount') || this.isModified('type')) {
    const basis = this.kesAmount > 0 ? this.kesAmount : this.amount;
    // settlementRail is only meaningful (and only ever varies the fee) for
    // 'ncba_outbound' — see feeCalculator.js. Passed through unconditionally
    // since every other type simply ignores it.
    const { paychainFee, safaricomFee, streamId } = calculateFees(this.type, basis, this.settlementRail);
    this.paychainFee  = paychainFee;
    this.safaricomFee = safaricomFee;
    this.revenueStream = streamId;
  }
});

// Mirror the hook for bulk insertMany — Mongoose does NOT run document
// middleware on insertMany unless `ordered: false` and we ask for it.
transactionSchema.pre('insertMany', function(docs) {
  for (const doc of docs) {
    const basis = (doc.kesAmount && doc.kesAmount > 0) ? doc.kesAmount : doc.amount;
    const { paychainFee, safaricomFee, streamId } = calculateFees(doc.type, basis, doc.settlementRail);
    doc.paychainFee  = paychainFee;
    doc.safaricomFee = safaricomFee;
    doc.revenueStream = streamId;
  }
});

// Live-push the admin dashboard the instant a transaction settles — covers
// both `new Transaction().save()`/`.create()` (post-save) and
// `findByIdAndUpdate`/`findOneAndUpdate` (post-findOneAndUpdate), the two
// ways controllers move a transaction to a terminal status across this
// codebase. Deliberately not trying to detect whether this was actually a
// *fresh* transition into completed/verified (no prior-value tracking
// exists to check against) — an occasional redundant broadcast just costs
// one harmless extra admin refetch, which is a fine trade against the
// complexity of precise transition-detection. Broadcasting must never be
// able to fail the save/update itself, so any error here is swallowed.
function broadcastIfSettled(doc) {
  if (!doc || !['completed', 'verified'].includes(doc.status)) return;
  try {
    broadcastAdminEvent('transaction', {
      transactionId: String(doc._id),
      merchantId: doc.merchantId ? String(doc.merchantId) : null,
      type: doc.type,
      status: doc.status,
    });
  } catch (err) {
    console.error('Admin event broadcast failed:', err?.message || err);
  }
  if (doc.merchantId) {
    try {
      broadcastMerchantEvent(doc.merchantId, 'transaction', {
        transactionId: String(doc._id),
        type: doc.type,
        status: doc.status,
      });
    } catch (err) {
      console.error('Merchant event broadcast failed:', err?.message || err);
    }
  }
}

transactionSchema.post('save', function(doc) { broadcastIfSettled(doc); });
transactionSchema.post('findOneAndUpdate', function(doc) { broadcastIfSettled(doc); });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
