import bcrypt from 'bcryptjs';
import DeveloperPayment from '../models/DeveloperPayment.js';
import Merchant from '../models/Merchant.js';
import STKRequest from '../models/STKRequest.js';
import { initiateAndTrackNcbaStk } from './mpesaController.js';
import { executeNcbaBankPayout, InsufficientFundsError } from './ncbaOpenBankingController.js';
import { NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';
import { getCheckoutTotal } from '../utils/pricingEngine.js';
import { claimClientIdempotencyKey, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { assertApiPayoutPinNotLocked, recordFailedApiPayoutPinAttempt, resetApiPayoutPinAttempts, ApiPayoutPinLockedError } from '../utils/apiPayoutPinLockout.js';
import { logAudit } from '../utils/auditLog.js';

// How long a simulated (test-mode) payment stays 'pending' before flipping
// to 'success' — long enough to let a developer's integration exercise its
// own "poll for pending" code path at least once, short enough not to make
// them wait around. Purely an in-process setTimeout: a simulated payment
// created moments before a server restart could stay pending indefinitely,
// which is an acceptable trade-off for a zero-stakes test-mode convenience
// feature, not something worth a persistent job queue for.
const SIMULATED_SETTLE_MS = 4000;

// Bounds how much a merchant's linked developer(s) can move out via live
// API payouts. A rolling 24h window rather than a calendar-day reset —
// equally effective at bounding blast radius, and avoids any ambiguity
// over which timezone "midnight" means on a server that may not run in EAT.
async function sumLiveApiPayoutsLast24h(merchantId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await DeveloperPayment.aggregate([
    { $match: { merchantId, mode: 'live', kind: 'payout', status: 'success', createdAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

function publicPayment(payment) {
  return {
    id: payment._id,
    mode: payment.mode,
    kind: payment.kind,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    failureReason: payment.failureReason,
    reference: payment.reference,
    counterparty: payment.counterparty,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function simulateSettlement(paymentId) {
  setTimeout(async () => {
    try {
      await DeveloperPayment.updateOne({ _id: paymentId, status: 'pending' }, { $set: { status: 'success' } });
    } catch (err) {
      console.error('simulateSettlement: failed to settle', paymentId, err?.message || err);
    }
  }, SIMULATED_SETTLE_MS);
}

// Resolves an Idempotency-Key replay by returning the original payment
// instead of erroring — the expected behavior for a real API integration
// retrying a request, as opposed to claimPayoutSubmission's internal
// double-click case, which is fine to just reject.
async function findReplayedPayment(developerId, idempotencyKey) {
  return DeveloperPayment.findOne({ developerId, idempotencyKey });
}

// @desc    Collect a payment (STK push) into the linked merchant's wallet.
//          Test-mode keys are fully simulated — no rail call, no balance
//          change.
// @route   POST /api/v1/developer/payments/collect
// @access  Public (API key)
export const collectPayment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required.', code: 'IDEMPOTENCY_KEY_REQUIRED' });

    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const { amount, reference } = req.body || {};
    const intAmount = Math.ceil(Number(amount));
    if (!Number.isFinite(intAmount) || intAmount <= 0) {
      return res.status(400).json({ error: 'A positive amount is required.' });
    }

    let phone;
    try {
      phone = validatePhoneNumber(req.body?.phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
      throw e;
    }

    try {
      await claimClientIdempotencyKey(developer._id, idempotencyKey);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) {
        const existing = await findReplayedPayment(developer._id, idempotencyKey);
        if (existing) return res.status(200).json({ success: true, payment: publicPayment(existing), replayed: true });
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }

    const mode = req.apiKey.mode;
    const payment = await DeveloperPayment.create({
      developerId: developer._id,
      apiKeyId: req.apiKey._id,
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
      simulateSettlement(payment._id);
      return res.status(201).json({ success: true, payment: publicPayment(payment) });
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
    } catch (err) {
      payment.status = 'failed';
      payment.failureReason = err.message;
      await payment.save();
    }

    res.status(201).json({ success: true, payment: publicPayment(payment) });
  } catch (error) {
    console.error('Developer Collect Payment Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Pay out (bank transfer) from the linked merchant's wallet.
//          Live mode requires apiPayoutEnabled, a matching apiPayoutPin,
//          and both caps to be respected. Test mode is fully simulated and
//          ignores all of the above.
// @route   POST /api/v1/developer/payments/payout
// @access  Public (API key)
export const payoutPayment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required.', code: 'IDEMPOTENCY_KEY_REQUIRED' });

    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const { bankCode, accountNumber, accountName, narration, apiPayoutPin } = req.body || {};
    const numericAmount = Number(req.body?.amount);
    if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'bankCode, accountNumber and a positive amount are required.' });
    }

    const mode = req.apiKey.mode;
    let merchant = null;

    if (mode === 'live') {
      merchant = await Merchant.findById(merchantId).select('+apiPayoutPin');
      if (!merchant?.apiPayoutEnabled || !merchant.apiPayoutPin) {
        return res.status(403).json({ error: 'API payouts are not enabled for this merchant account.', code: 'API_PAYOUT_NOT_ENABLED' });
      }

      try {
        await assertApiPayoutPinNotLocked(merchantId);
      } catch (e) {
        if (e instanceof ApiPayoutPinLockedError) return res.status(429).json({ error: e.message });
        throw e;
      }

      if (!apiPayoutPin || !(await bcrypt.compare(String(apiPayoutPin), merchant.apiPayoutPin))) {
        await recordFailedApiPayoutPinAttempt(merchantId);
        return res.status(401).json({ error: 'Invalid API payout PIN.' });
      }
      await resetApiPayoutPinAttempts(merchantId);

      const caps = merchant.apiPayoutCaps || {};
      if (numericAmount > (caps.perTransactionKes || 0)) {
        return res.status(403).json({ error: `Amount exceeds the per-transaction cap of KES ${caps.perTransactionKes}.`, code: 'PER_TRANSACTION_CAP_EXCEEDED' });
      }
      const spentLast24h = await sumLiveApiPayoutsLast24h(merchantId);
      if (spentLast24h + numericAmount > (caps.dailyKes || 0)) {
        return res.status(403).json({ error: `Amount would exceed the daily cap of KES ${caps.dailyKes}.`, code: 'DAILY_CAP_EXCEEDED' });
      }
    }

    try {
      await claimClientIdempotencyKey(developer._id, idempotencyKey);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) {
        const existing = await findReplayedPayment(developer._id, idempotencyKey);
        if (existing) return res.status(200).json({ success: true, payment: publicPayment(existing), replayed: true });
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }

    const payment = await DeveloperPayment.create({
      developerId: developer._id,
      apiKeyId: req.apiKey._id,
      merchantId,
      mode,
      kind: 'payout',
      amount: numericAmount,
      status: 'pending',
      idempotencyKey,
      counterparty: { bankCode, accountNumber, accountName: accountName || null },
    });

    if (mode === 'test') {
      simulateSettlement(payment._id);
      return res.status(201).json({ success: true, payment: publicPayment(payment) });
    }

    try {
      const { transaction } = await executeNcbaBankPayout({
        merchantId, bankCode, accountNumber, accountName, amount: numericAmount, narration: narration || 'Developer API payout',
      });
      payment.status = 'success';
      payment.linkedTransactionId = transaction._id;
      await payment.save();

      logAudit({
        action: 'developer.payment.payout_executed', category: 'security', severity: 'critical',
        message: `Live API payout of KES ${numericAmount} executed for merchant ${String(merchantId)}`,
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
        metadata: { merchantId: String(merchantId), amount: numericAmount, apiKeyId: String(req.apiKey._id) },
      });
    } catch (err) {
      payment.status = 'failed';
      payment.failureReason = err instanceof InsufficientFundsError || err instanceof NcbaOpenBankingValidationError
        ? err.message
        : 'Payout failed.';
      await payment.save();
      return res.status(402).json({ error: payment.failureReason, payment: publicPayment(payment) });
    }

    res.status(201).json({ success: true, payment: publicPayment(payment) });
  } catch (error) {
    console.error('Developer Payout Payment Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Check the status of a payment created via this API.
// @route   GET /api/v1/developer/payments/:id
// @access  Public (API key)
export const getPaymentStatus = async (req, res) => {
  try {
    const payment = await DeveloperPayment.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    // Live collects settle asynchronously off NCBA's own resolution — sync
    // from the linked STKRequest on read rather than needing a webhook/poller.
    if (payment.mode === 'live' && payment.kind === 'collect' && payment.status === 'pending' && payment.linkedStkCheckoutId) {
      const stkReq = await STKRequest.findOne({ checkoutRequestId: payment.linkedStkCheckoutId });
      if (stkReq && stkReq.status !== 'pending') {
        payment.status = stkReq.status === 'success' ? 'success' : 'failed';
        if (stkReq.status === 'failed') payment.failureReason = stkReq.resultDesc || 'Collection failed.';
        await payment.save();
      }
    }

    res.json({ success: true, payment: publicPayment(payment) });
  } catch (error) {
    console.error('Get Developer Payment Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
