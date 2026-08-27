import bcrypt from 'bcryptjs';
import DeveloperPayment from '../models/DeveloperPayment.js';
import Merchant from '../models/Merchant.js';
import {
  executeNcbaBankPayout,
  executeNcbaMobileMoneyPayout,
  executeNcbaLipaNaMpesaPayout,
  InsufficientFundsError,
  NcbaPostSubmissionRecordError,
} from './ncbaOpenBankingController.js';
import { NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { claimClientIdempotencyKey, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { assertApiPayoutPinNotLocked, recordFailedApiPayoutPinAttempt, resetApiPayoutPinAttempts, ApiPayoutPinLockedError } from '../utils/apiPayoutPinLockout.js';
import { logAudit } from '../utils/auditLog.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';
import {
  initiateCollectPayment,
  findReplayedPayment,
  syncLiveCollectFromStkRequest,
  CollectValidationError,
} from '../services/developerCollectService.js';

// How long a simulated (test-mode) payout stays 'pending' before flipping
// to 'success' — see developerCollectService.js's identical constant for
// collects; payouts don't share that helper (no STK push involved) so this
// one is kept local.
const SIMULATED_SETTLE_MS = 4000;

// Bounds how much a merchant's linked developer(s) can move out via live
// API payouts. A rolling 24h window rather than a calendar-day reset —
// equally effective at bounding blast radius, and avoids any ambiguity
// over which timezone "midnight" means on a server that may not run in EAT.
//
// Includes 'pending' alongside 'success' — async payout rails (mobile
// money/paybill/till) sit 'pending' until a later webhook resolves them, so
// counting only 'success' meant several payouts fired in parallel, each
// individually under perTransactionKes, could collectively blow through
// dailyKes before any of them settled (none was ever double-counted once
// resolved — 'pending' rows transition in place to 'success', they aren't
// duplicated). This still isn't a fully atomic reservation (two requests
// racing this exact read before either's row is written could still both
// pass), but it closes the real exploitable gap: a payout sitting pending
// for the settlement window no longer vanishes from the running total.
async function sumLiveApiPayoutsLast24h(merchantId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await DeveloperPayment.aggregate([
    { $match: { merchantId, mode: 'live', kind: 'payout', status: { $in: ['success', 'pending'] }, createdAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

const publicPayment = publicDeveloperPayment;

// Payout's own settlement simulator — payouts don't go through
// developerCollectService (no STK push / phone involved), so this stays
// local rather than sharing collect's simulateCollectSettlement.
function simulatePayoutSettlement(payment) {
  setTimeout(async () => {
    try {
      const updated = await DeveloperPayment.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'success' } },
        { returnDocument: 'after' }
      );
      if (updated) {
        dispatchDeveloperEvent(updated.developerId, `payment.${updated.kind}.succeeded`, { payment: publicPayment(updated) });
      }
    } catch (err) {
      console.error('simulatePayoutSettlement: failed to settle', payment._id, err?.message || err);
    }
  }, SIMULATED_SETTLE_MS);
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

    const { amount, phone, reference } = req.body || {};

    let payment;
    try {
      payment = await initiateCollectPayment({
        developerId: developer._id,
        apiKeyId: req.apiKey._id,
        merchantId,
        mode: req.apiKey.mode,
        amount,
        phone,
        reference,
        idempotencyKey,
      });
    } catch (e) {
      if (e instanceof CollectValidationError) return res.status(400).json({ error: e.message });
      if (e instanceof DuplicateSubmissionError) {
        const existing = await findReplayedPayment(developer._id, idempotencyKey);
        if (existing) return res.status(200).json({ success: true, payment: publicPayment(existing), replayed: true });
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }

    res.status(201).json({ success: true, payment: publicPayment(payment) });
  } catch (error) {
    console.error('Developer Collect Payment Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Every payout destination the Developer API accepts, and which single
// field (or field pair) identifies it — mirrors the same rails the internal
// Payee model (merchant dashboard "Send Money") already exposes, just flat
// instead of a saved-payee object. Exactly one must be provided per request;
// this is deliberately a validation error, not a silent "first one wins",
// since a caller who accidentally sends both a phone and a bankCode almost
// certainly made a mistake worth surfacing rather than guessing past.
export class PayoutDestinationError extends Error {}

export function parsePayoutDestination(body) {
  const { bankCode, accountNumber, accountName, phone, mobileNetwork, paybillNumber, tillNumber, accountReference } = body || {};

  const provided = [];
  if (bankCode || accountNumber) provided.push('bank');
  if (phone) provided.push('mobile_money');
  if (paybillNumber) provided.push('paybill');
  if (tillNumber) provided.push('till');

  if (provided.length === 0) {
    throw new PayoutDestinationError('Provide exactly one payout destination: bankCode + accountNumber, phone, paybillNumber + accountReference, or tillNumber.');
  }
  if (provided.length > 1) {
    throw new PayoutDestinationError(`More than one payout destination was provided (${provided.join(', ')}) — send exactly one.`);
  }

  const type = provided[0];
  if (type === 'bank') {
    if (!bankCode || !accountNumber) throw new PayoutDestinationError('bankCode and accountNumber are both required for a bank payout.');
    return { type, counterparty: { bankCode, accountNumber, accountName: accountName || null } };
  }
  if (type === 'mobile_money') {
    return { type, counterparty: { phone, network: mobileNetwork === 'airtel' ? 'airtel' : 'safaricom', accountName: accountName || null } };
  }
  if (type === 'paybill') {
    if (!accountReference) throw new PayoutDestinationError('accountReference is required for a paybill payout.');
    return { type, counterparty: { paybillNumber, accountReference } };
  }
  return { type: 'till', counterparty: { tillNumber } };
}

// @desc    Pay out from the linked merchant's wallet — to a bank account,
//          an M-Pesa/Airtel Money number, a Paybill, or a Till (Buy Goods).
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

    const { narration, apiPayoutPin } = req.body || {};
    const numericAmount = Number(req.body?.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'A positive amount is required.' });
    }

    let destination;
    try {
      destination = parsePayoutDestination(req.body);
    } catch (e) {
      if (e instanceof PayoutDestinationError) return res.status(400).json({ error: e.message });
      throw e;
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
      counterparty: destination.counterparty,
    });

    if (mode === 'test') {
      simulatePayoutSettlement(payment);
      return res.status(201).json({ success: true, payment: publicPayment(payment) });
    }

    // Bank resolves synchronously (NCBA confirms PesaLink/RTGS before
    // returning); mobile money, paybill, and till only confirm receipt —
    // the actual outcome lands later via resolvePendingOpenBankingTransaction
    // (ncbaOpenBankingController.js), matched by linkedPayoutReference, the
    // same way a live collect's outcome lands via resolveStkOutcome.
    const isAsyncRail = destination.type !== 'bank';

    try {
      let transaction;
      if (destination.type === 'bank') {
        ({ transaction } = await executeNcbaBankPayout({
          merchantId, bankCode: destination.counterparty.bankCode, accountNumber: destination.counterparty.accountNumber,
          accountName: destination.counterparty.accountName, amount: numericAmount, narration: narration || 'Developer API payout',
        }));
      } else if (destination.type === 'mobile_money') {
        ({ transaction } = await executeNcbaMobileMoneyPayout({
          merchantId, phone: destination.counterparty.phone, network: destination.counterparty.network,
          beneficiaryName: destination.counterparty.accountName,
          amount: numericAmount, narration: narration || 'Developer API payout',
        }));
      } else {
        ({ transaction } = await executeNcbaLipaNaMpesaPayout({
          merchantId,
          paymentType: destination.type === 'paybill' ? 'paybill' : 'till',
          payBillTillNo: destination.type === 'paybill' ? destination.counterparty.paybillNumber : destination.counterparty.tillNumber,
          accountReference: destination.counterparty.accountReference,
          amount: numericAmount, narration: narration || 'Developer API payout',
        }));
      }

      if (isAsyncRail) {
        payment.linkedPayoutReference = transaction.reference;
        await payment.save();
        // Left 'pending' — no webhook yet. Fires from the async resolver above.
      } else {
        payment.status = 'success';
        payment.linkedTransactionId = transaction._id;
        await payment.save();
        dispatchDeveloperEvent(developer._id, 'payment.payout.succeeded', { payment: publicPayment(payment) });
      }

      logAudit({
        action: 'developer.payment.payout_executed', category: 'security', severity: 'critical',
        message: `Live API payout of KES ${numericAmount} ${isAsyncRail ? 'submitted' : 'executed'} for merchant ${String(merchantId)}`,
        req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
        metadata: { merchantId: String(merchantId), amount: numericAmount, apiKeyId: String(req.apiKey._id), destinationType: destination.type },
      });
    } catch (err) {
      if (err instanceof NcbaPostSubmissionRecordError) {
        // NCBA already confirmed/accepted this transfer — do NOT mark the
        // payment 'failed' (an API consumer treating 'failed' as safe to
        // retry would cause a real, second payout). Leave it 'pending' and
        // link the reference so it can be reconciled the same way any other
        // async payout resolves.
        payment.linkedPayoutReference = err.reference;
        await payment.save();
        console.error('Developer Payout Payment — confirmed by NCBA but recording failed:', err.message, err.reference);
        return res.status(202).json({
          success: true,
          payment: publicPayment(payment),
          message: 'Payout was submitted to NCBA; we hit an error recording it. Do not retry — check status shortly.',
        });
      }
      payment.status = 'failed';
      payment.failureReason = err instanceof InsufficientFundsError || err instanceof NcbaOpenBankingValidationError
        ? err.message
        : 'Payout failed.';
      await payment.save();
      dispatchDeveloperEvent(developer._id, 'payment.payout.failed', { payment: publicPayment(payment) });
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

    await syncLiveCollectFromStkRequest(payment);

    res.json({ success: true, payment: publicPayment(payment) });
  } catch (error) {
    console.error('Get Developer Payment Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
