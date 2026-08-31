import Transaction from '../models/Transaction.js';
import { NCBA_STK_BUSINESS_NUMBER } from './ncbaStkPushService.js';
import { resolvePendingOpenBankingTransaction } from '../controllers/ncbaOpenBankingController.js';

// A stuck ncba_lipa_na_mpesa payout whose destination is PayChain's OWN
// shared paybill (NCBA_STK_BUSINESS_NUMBER, e.g. one merchant paying
// another via the paybill) is the one case where "did this land?" doesn't
// require NCBA's broken status API or a human checking a third party at
// all — the money never actually leaves PayChain's own ecosystem, so the
// same account-notification webhook that credits the destination merchant
// (ncba_inbound, handleNcbaAccountNotification) already IS independent
// proof of delivery. Cross-matching against that real credit lets this
// sweep auto-resolve those specific payouts instead of always needing a
// manual admin check — see models/Transaction.js#paybillAccountReference's
// doc comment for why the match is precise (destination account number +
// exact amount), not just a coincidental amount/timing guess. Payments to
// a genuine third-party till/paybill/bank (anything NOT this constant)
// can never be auto-resolved this way — PayChain has no independent
// visibility into a third party's own ledger, so those still need a human
// to check (NCBA's portal, or directly with the recipient).
const MATCH_WINDOW_MS = 5 * 60 * 1000;

// NCBA Open Banking's async rails (Mobile B2W, Lipa na M-Pesa, KPLC/NCWSC
// bill payments) are documented as resolving "via a later callback" to
// /webhooks/ncba-openbanking-callback — but in practice that callback has
// been observed to never arrive for real Mobile B2W payouts, leaving the
// Transaction 'pending' forever with the merchant's balance already
// debited and nothing ever delivered to the recipient. PesaLink/RTGS
// aren't in this list — they resolve synchronously in the submit response
// and never reach 'pending' in the first place.
const ASYNC_RAIL_TYPES = ['ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc'];

// Generous relative to how fast these rails normally resolve when the
// callback does arrive (seconds to low minutes) — this only exists to
// catch the case where no callback is ever coming.
const STUCK_AFTER_MS = 20 * 60 * 1000;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// Finds Open Banking async-rail Transactions still 'pending' long after
// submission and flags each one for manual review — it does NOT auto-refund
// them. Auto-refunding on a bare timeout used to be this sweep's job (via
// resolvePendingOpenBankingTransaction({succeeded:false})), but that's only
// safe if silence reliably means "never landed." It doesn't: NCBA's
// TransactionStatusQuery endpoint — the only way to actually ask NCBA
// "did this land?" — is confirmed broken in production (see
// scripts/probe-ncba-transaction-status-query.js and
// scripts/probe-ncba-endpoint-matrix.js), and NCBA's own callback has
// separately been observed to just never arrive for real payouts that DID
// land. Auto-refunding under those conditions risks paying the merchant
// back for a transfer that actually went through — a real shortfall in the
// pooled account that wouldn't surface until the next manual bank
// reconciliation. So instead this only marks the Transaction with
// pendingReason:'stuck_timeout_needs_manual_review' and logs loudly; an
// admin resolves it by hand after checking NCBA's portal directly (the same
// manual process already used for pool-balance reconciliation), via
// resolvePendingOpenBankingTransaction — status stays 'pending' and the
// merchant's ledger balance is untouched until then.
//
// Safe to run repeatedly and concurrently with real callbacks arriving —
// the atomic {status:'pending'} filter on the flagging update means a
// genuine late callback (which flips status away from 'pending') and this
// sweep can never both act on the same transaction; whichever gets there
// first wins.
export async function reconcileStuckOpenBankingPayouts() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await Transaction.find({
    type: { $in: ASYNC_RAIL_TYPES },
    status: 'pending',
    pendingReason: { $ne: 'stuck_timeout_needs_manual_review' },
    createdAt: { $lt: cutoff },
  }).select('reference type createdAt kesAmount amount recipient paybillAccountReference');

  if (stuck.length === 0) return;

  logEvent('error', 'ncba_openbanking_reconciliation_found_stuck', {
    count: stuck.length,
    references: stuck.map((t) => t.reference),
    message: 'These payouts are past the stuck-payout window with no callback. NOT auto-refunding — NCBA status-check is broken, so we cannot confirm they failed. Check NCBA\'s portal and resolve manually.',
  });

  for (const tx of stuck) {
    try {
      // Only for a Lipa na M-Pesa payout into PayChain's OWN shared paybill
      // — see this file's top doc comment for why that specific case is
      // safe to auto-resolve without a human.
      if (tx.type === 'ncba_lipa_na_mpesa' && tx.recipient?.id === NCBA_STK_BUSINESS_NUMBER && tx.paybillAccountReference) {
        const amount = tx.kesAmount ?? tx.amount;
        const candidates = await Transaction.find({
          type: 'ncba_inbound',
          status: 'completed',
          accountNumber: tx.paybillAccountReference,
          kesAmount: amount,
          createdAt: { $gte: tx.createdAt, $lte: new Date(tx.createdAt.getTime() + MATCH_WINDOW_MS) },
        }).select('_id reference').lean();

        // Require an unambiguous single match — if more than one inbound
        // credit fits, this isn't safe to guess between, so it falls
        // through to the manual-review flag below instead.
        if (candidates.length === 1) {
          await resolvePendingOpenBankingTransaction({ reference: tx.reference, succeeded: true });
          logEvent('info', 'ncba_openbanking_reconciliation_auto_resolved_internal_match', {
            reference: tx.reference, matchedInboundReference: candidates[0].reference, amount,
            message: 'Auto-resolved as succeeded — cross-matched against a real ncba_inbound credit for the same amount at the destination account, no manual check needed.',
          });
          continue;
        }
      }

      const flagged = await Transaction.findOneAndUpdate(
        { _id: tx._id, status: 'pending' },
        { $set: { pendingReason: 'stuck_timeout_needs_manual_review' } },
        { returnDocument: 'after' }
      );
      if (flagged) {
        logEvent('error', 'ncba_openbanking_reconciliation_flagged_for_manual_review', { reference: tx.reference, type: tx.type });
      }
    } catch (err) {
      logEvent('error', 'ncba_openbanking_reconciliation_error', { reference: tx.reference, error: err.message });
    }
  }
}
