import DeveloperPayment from '../models/DeveloperPayment.js';
import STKRequest from '../models/STKRequest.js';
import { initiateAndTrackNcbaStk } from '../controllers/mpesaController.js';
import { validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';
import { getCheckoutTotal } from '../utils/pricingEngine.js';
import { claimClientIdempotencyKey } from '../utils/idempotencyGuard.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from './webhookDeliveryService.js';

// How long a simulated (test-mode) payment stays 'pending' before flipping
// to 'success' — long enough to let an integration exercise its own "poll
// for pending" code path at least once, short enough not to make anyone
// wait around. Purely an in-process setTimeout: a simulated payment created
// moments before a server restart could stay pending indefinitely, which is
// an acceptable trade-off for a zero-stakes test-mode convenience feature,
// not something worth a persistent job queue for.
const SIMULATED_SETTLE_MS = 4000;

export class CollectValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CollectValidationError';
    this.code = code;
  }
}

export function simulateCollectSettlement(payment) {
  setTimeout(async () => {
    try {
      const updated = await DeveloperPayment.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'success' } },
        { returnDocument: 'after' }
      );
      if (updated) {
        dispatchDeveloperEvent(updated.developerId, `payment.${updated.kind}.succeeded`, { payment: publicDeveloperPayment(updated) });
      }
    } catch (err) {
      console.error('simulateCollectSettlement: failed to settle', payment._id, err?.message || err);
    }
  }, SIMULATED_SETTLE_MS);
}

// Resolves an Idempotency-Key replay by returning the original payment
// instead of erroring — the expected behavior for a real API integration
// retrying a request, as opposed to an internal double-click case, which is
// fine to just reject.
export async function findReplayedPayment(developerId, idempotencyKey) {
  return DeveloperPayment.findOne({ developerId, idempotencyKey });
}

// Creates and initiates a "collect" DeveloperPayment (STK push) — the one
// place this logic lives, shared by the API-key-authenticated
// POST /payments/collect endpoint and the public hosted-checkout "pay"
// endpoint. Both ultimately need the exact same simulate/initiate/webhook
// pipeline; keeping it in one function is what stops those two callers from
// ever drifting out of sync with each other.
//
// Throws CollectValidationError for bad input, or DuplicateSubmissionError
// (from claimClientIdempotencyKey) for a replayed idempotency key — callers
// are expected to catch both.
export async function initiateCollectPayment({ developerId, apiKeyId, merchantId, mode, amount, phone: rawPhone, reference, idempotencyKey }) {
  const intAmount = Math.ceil(Number(amount));
  if (!Number.isFinite(intAmount) || intAmount <= 0) {
    throw new CollectValidationError('A positive amount is required.', 'INVALID_AMOUNT');
  }

  let phone;
  try {
    phone = validatePhoneNumber(rawPhone);
  } catch (e) {
    if (e instanceof NcbaValidationError) throw new CollectValidationError('Enter a valid Kenyan phone number.', 'INVALID_PHONE');
    throw e;
  }

  await claimClientIdempotencyKey(developerId, idempotencyKey);

  const payment = await DeveloperPayment.create({
    developerId,
    apiKeyId,
    merchantId,
    mode,
    kind: 'collect',
    amount: intAmount,
    status: 'pending',
    reference: reference || null,
    idempotencyKey,
    counterparty: { phone },
  });

  if (mode === 'test') {
    simulateCollectSettlement(payment);
    return payment;
  }

  try {
    const checkoutTotal = getCheckoutTotal(intAmount);
    const checkoutRequestId = await initiateAndTrackNcbaStk({
      merchantId,
      phone,
      checkoutTotal,
      extra: { baseAmount: intAmount, kind: 'request_money' },
    });
    payment.linkedStkCheckoutId = checkoutRequestId;
    await payment.save();
    // Success is resolved asynchronously off NCBA's own STK poll — see
    // resolveStkOutcome in mpesaController.js, which syncs this payment
    // (matched by linkedStkCheckoutId) and fires the webhook once
    // Safaricom actually confirms the prompt.
  } catch (err) {
    payment.status = 'failed';
    payment.failureReason = err.message;
    await payment.save();
    dispatchDeveloperEvent(developerId, 'payment.collect.failed', { payment: publicDeveloperPayment(payment) });
  }

  return payment;
}

// Belt-and-braces sync-on-read for a live collect stuck 'pending': the real
// resolution normally already landed via resolveStkOutcome (mpesaController.js)
// syncing this same payment and firing its webhook — this just covers a
// caller (GET /payments/:id, the checkout status poll) reading before that
// lands. Shared so both call sites can never check this differently. No-ops
// (and is safe to call) for anything that isn't a pending live collect.
export async function syncLiveCollectFromStkRequest(payment) {
  if (payment.mode !== 'live' || payment.kind !== 'collect' || payment.status !== 'pending' || !payment.linkedStkCheckoutId) {
    return payment;
  }

  const stkReq = await STKRequest.findOne({ checkoutRequestId: payment.linkedStkCheckoutId });
  if (stkReq && stkReq.status !== 'pending') {
    payment.status = stkReq.status === 'success' ? 'success' : 'failed';
    if (stkReq.status === 'failed') payment.failureReason = stkReq.resultDesc || 'Collection failed.';
    await payment.save();
  }
  return payment;
}
