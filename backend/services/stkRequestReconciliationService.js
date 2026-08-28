// Safety net for STK Push requests whose in-process poll loop
// (pollAndResolveNcbaStkPush, mpesaController.js) never got to finish.
// That loop is a plain fire-and-forget setTimeout chain living entirely in
// this process's memory — it has no persistence and no resumption. If the
// server restarts/redeploys while a poll is mid-flight (a real, frequent
// occurrence on Render), the STKRequest it was tracking is simply
// abandoned: still 'pending' in the database forever, since nothing else
// was ever watching it.
//
// This matters more than a cosmetic loose end — initiateSTKPush refuses to
// start a NEW push for a merchant while they have ANY 'pending' STKRequest
// (see its own doc comment: "only one STK Push in flight per merchant at a
// time"), with no staleness exception. A single orphaned pending record
// therefore permanently locks that merchant out of STK entirely — exactly
// what happened to Bridging The Gap (merchantId 6a8f4da9228671cacc436228):
// two STKRequests from 2026-08-27 08:19-08:20 UTC never resolved, and every
// STK attempt since has been rejected with "You already have a payment
// prompt waiting for a response."
//
// Mirrors services/ncbaOpenBankingReconciliationService.js's shape:
// resolveStkOutcome(succeeded:false) is exactly what the poll loop's own
// timeout branch already calls, so a request this sweep catches is closed
// out identically to one the poll loop would have closed out itself —
// same resultDesc, same no-op on the ledger (a 'failed' STK resolution
// never touches balance, only a 'success' one does).
import STKRequest from '../models/STKRequest.js';
import { resolveStkOutcome } from '../controllers/mpesaController.js';

// Comfortably past NCBA_STK_POLL_MAX_ATTEMPTS's own ~2-minute window
// (mpesaController.js) — this sweep is a backstop for when that window's
// own resolution never ran, not a replacement for it, so it should never
// fire before the poll loop would have had its own honest chance to finish.
const STUCK_AFTER_MS = 5 * 60 * 1000;

export async function reconcileStuckStkRequests() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await STKRequest.find({
    channel: 'stk',
    status: 'pending',
    createdAt: { $lt: cutoff },
  }).lean();

  for (const doc of stuck) {
    try {
      await resolveStkOutcome(doc, {
        succeeded: false,
        receipt: doc.checkoutRequestId,
        resultDesc: 'Timed out waiting for customer response',
      });
      console.log(`STK reconciliation: closed out orphaned pending request ${doc.checkoutRequestId} (merchant ${doc.merchantId})`);
    } catch (err) {
      console.error(`STK reconciliation: failed to resolve ${doc.checkoutRequestId}:`, err?.message || err);
    }
  }
}
