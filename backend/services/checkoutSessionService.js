import DeveloperPayment from '../models/DeveloperPayment.js';
import { syncLiveCollectFromStkRequest } from './developerCollectService.js';

export function isCheckoutSessionExpired(session) {
  return session.status === 'pending' && session.expiresAt.getTime() < Date.now();
}

// Reconciles a checkout session against its linked payment attempt — shared
// by the developer-facing GET /checkout/:id (API key) and the public
// checkout page's status poll, so a session never reads differently
// depending on which caller asks. Only does anything while status is
// 'processing' (an attempt is genuinely in flight); a session already at
// 'success' or freshly reset to 'pending' after a failure has nothing left
// to reconcile until the next attempt.
//
// Returns { failureReason } — the most recent attempt's failure reason, if
// this call is the one that just observed the failure (null otherwise, so
// callers don't need to separately track "did this call just change
// anything").
export async function syncCheckoutSessionStatus(session) {
  if (session.status !== 'processing' || !session.linkedDeveloperPaymentId) {
    return { failureReason: null };
  }

  const payment = await DeveloperPayment.findById(session.linkedDeveloperPaymentId);
  if (!payment) return { failureReason: null };

  await syncLiveCollectFromStkRequest(payment);

  if (payment.status === 'success') {
    session.status = 'success';
    await session.save();
    return { failureReason: null };
  }

  if (payment.status === 'failed') {
    // Back to 'pending', not 'expired' or stuck 'processing' — the customer
    // (or developer, via the API) should be able to try again with a
    // corrected phone number for as long as the session itself hasn't
    // expired.
    session.status = 'pending';
    await session.save();
    return { failureReason: payment.failureReason };
  }

  return { failureReason: null };
}
