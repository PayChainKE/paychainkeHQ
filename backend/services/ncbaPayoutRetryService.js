import Transaction from '../models/Transaction.js';
import { submitMobileB2wPayment, submitLipaNaMpesaPayment, NcbaOpenBankingRequestError } from './ncbaOpenBankingService.js';
import { resolvePendingOpenBankingTransaction } from '../controllers/ncbaOpenBankingController.js';

// A B2C/B2B payout that NCBA rejected with a clear "Insufficient Funds For
// Transaction" is a definitive, synchronous no — nothing moved, unlike the
// genuinely ambiguous case where NCBA's response can't be confidently read
// as success or failure (that one is never auto-retried; see
// mpesaController.js's initiateB2C/initiateB2B). So instead of just sitting
// 'pending' for up to 20 minutes and then getting refunded by
// ncbaOpenBankingReconciliationService.js's stuck-payout sweep, this
// actively resubmits the exact same request every time it runs — safe to
// do because a definitive rejection guarantees no duplicate payout risk —
// on the chance the pooled account (1010837186) has picked up more real
// liquidity from other merchants' collections in the meantime. A merchant
// only ever sees the eventual outcome (their transaction flips to
// Completed, or — if it's still short after every retry — Failed and
// refunded exactly like today), never the retries themselves.

// Stops retrying with a safety margin before
// ncbaOpenBankingReconciliationService.js's own STUCK_AFTER_MS (20 min)
// would finalize the same transaction as failed+refunded — this service
// backs off first rather than racing that sweep for the last word.
const MAX_RETRY_AGE_MS = 18 * 60 * 1000;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function retryOne(tx) {
  // Atomic claim — bumping retryCount/lastRetryAt only succeeds if this
  // transaction is still exactly where we found it. Guards against two
  // overlapping sweep runs (or a sweep racing a real late callback that
  // resolves it first) both resubmitting the same payout.
  const claimed = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: 'pending', pendingReason: 'insufficient_funds' },
    { $set: { lastRetryAt: new Date() }, $inc: { retryCount: 1 } },
    { returnDocument: 'after' }
  );
  if (!claimed) return;

  const payload = claimed.retryPayload || {};
  try {
    if (payload.rail === 'ncba_mobile_b2w') {
      await submitMobileB2wPayment({
        transactionId: claimed.reference,
        beneficiaryName: payload.beneficiaryName,
        amount: claimed.amount,
        recipientNumber: payload.recipientNumber,
        narration: payload.narration,
      });
    } else if (payload.rail === 'ncba_lipa_na_mpesa') {
      await submitLipaNaMpesaPayment({
        transactionId: claimed.reference,
        paymentType: payload.paymentType,
        payBillTillNo: payload.payBillTillNo,
        amount: claimed.amount,
        accountReference: payload.accountReference,
        recipientName: payload.recipientName,
        notifyMobileNumber: payload.notifyMobileNumber,
        narration: payload.narration,
      });
    } else {
      logEvent('warn', 'ncba_payout_retry_missing_payload', { reference: claimed.reference, rail: payload.rail || null });
      return;
    }

    // Resolved via the exact same path a real success callback would take
    // — flips status, sends the "payout sent" SMS/notification, everything
    // consistent with a first-attempt success.
    await resolvePendingOpenBankingTransaction({ reference: claimed.reference, succeeded: true });
    logEvent('info', 'ncba_payout_retry_succeeded', { reference: claimed.reference, attempt: claimed.retryCount });
  } catch (err) {
    if (err instanceof NcbaOpenBankingRequestError && err.isInsufficientFunds) {
      // Still short — leave it pending for the next cycle (or for
      // reconcileStuckOpenBankingPayouts to finally give up and refund
      // once MAX_RETRY_AGE_MS/STUCK_AFTER_MS passes).
      logEvent('info', 'ncba_payout_retry_still_insufficient', { reference: claimed.reference, attempt: claimed.retryCount });
    } else {
      // A different rejection this time (not a liquidity issue) — that's
      // a real, definitive failure signal, no reason to wait out the rest
      // of the reconciliation window for it.
      logEvent('warn', 'ncba_payout_retry_failed_other_reason', { reference: claimed.reference, error: err.message });
      await resolvePendingOpenBankingTransaction({ reference: claimed.reference, succeeded: false });
    }
  }
}

export async function retryInsufficientFundsPayouts() {
  const ageLimit = new Date(Date.now() - MAX_RETRY_AGE_MS);
  const candidates = await Transaction.find({
    status: 'pending',
    pendingReason: 'insufficient_funds',
    createdAt: { $gt: ageLimit },
  }).select('reference amount retryPayload retryCount');

  if (candidates.length === 0) return;

  logEvent('info', 'ncba_payout_retry_sweep_started', { count: candidates.length });
  for (const tx of candidates) {
    try {
      await retryOne(tx);
    } catch (err) {
      logEvent('error', 'ncba_payout_retry_sweep_error', { reference: tx.reference, error: err.message });
    }
  }
}
