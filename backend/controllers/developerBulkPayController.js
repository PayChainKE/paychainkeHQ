import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import DeveloperPayment from '../models/DeveloperPayment.js';
import Merchant from '../models/Merchant.js';
import {
  executeNcbaBankPayout,
  executeNcbaMobileMoneyPayout,
  executeNcbaLipaNaMpesaPayout,
  InsufficientFundsError,
} from './ncbaOpenBankingController.js';
import { NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { parsePayoutDestination, PayoutDestinationError } from './developerPaymentController.js';
import { claimClientIdempotencyKey, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { assertApiPayoutPinNotLocked, recordFailedApiPayoutPinAttempt, resetApiPayoutPinAttempts, ApiPayoutPinLockedError } from '../utils/apiPayoutPinLockout.js';
import { logAudit } from '../utils/auditLog.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';

const MAX_BATCH_SIZE = 200;
const SIMULATED_SETTLE_MS = 4000;

// Send one payout to many destinations in one call: employee payroll (net
// of real PAYE/NSSF/SHIF, same calculator bulkPayController.js's dashboard
// Bulk Pay uses), or contract/vendor settlements, to any mix of mobile
// money, Paybill, Till, or bank destinations — reusing the exact same
// per-destination execution functions and apiPayoutPin/cap gate already
// proven by POST /payments/payout, just applied once per row instead of
// once per request. KPLC/water utility bill payments are not yet supported
// via this endpoint — the dashboard's Bulk Pay is still the only way to pay
// those today.
async function sumLiveApiPayoutsLast24h(merchantId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await DeveloperPayment.aggregate([
    { $match: { merchantId, mode: 'live', kind: 'payout', status: 'success', createdAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

function simulateBatchRowSettlement(paymentId) {
  setTimeout(async () => {
    try {
      const updated = await DeveloperPayment.findOneAndUpdate(
        { _id: paymentId, status: 'pending' },
        { $set: { status: 'success' } },
        { returnDocument: 'after' }
      );
      if (updated) {
        dispatchDeveloperEvent(updated.developerId, 'payment.payout.succeeded', { payment: publicDeveloperPayment(updated) });
      }
    } catch (err) {
      console.error('simulateBatchRowSettlement: failed to settle', paymentId, err?.message || err);
    }
  }, SIMULATED_SETTLE_MS);
}

// Validates + prices every row up front (no money moves yet) — a batch that
// fails validation on row 40 of 50 should never leave the first 39 already
// paid. Throws PayoutDestinationError / RangeError-style plain Error with a
// row index prefix for anything invalid.
function priceRows(rawPayments) {
  return rawPayments.map((row, i) => {
    const numericAmount = Number(row?.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new PayoutDestinationError(`payments[${i}]: a positive amount is required.`);
    }
    const destination = parsePayoutDestination(row);
    const payeeType = row?.payeeType === 'employee' ? 'employee' : 'contract';

    // No PAYE/NSSF/SHIF withholding for employeeType — PayChain has no live
    // KRA/NSSF/SHIF remittance integration, so employees (like every other
    // payee type) are paid the full caller-supplied amount.
    return {
      destination, payeeType, narration: row?.narration || null,
      grossAmount: null, netAmount: numericAmount, taxDeductions: null,
    };
  });
}

// @desc    Pay many destinations in one call — employee payroll and/or
//          contract/vendor settlements. Live mode requires apiPayoutEnabled,
//          a matching apiPayoutPin (checked once for the whole batch), and
//          both caps respected against the batch's total real (net) spend.
//          Test mode is fully simulated. One row failing doesn't stop the
//          rest — check each row's own status in the response.
// @route   POST /api/v1/developer/bulk-payments
// @access  Public (API key)
export const createDeveloperBulkPayment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required.', code: 'IDEMPOTENCY_KEY_REQUIRED' });

    const developer = req.developer;
    const merchantId = developer.linkedMerchant?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: 'No merchant account linked. Complete /api/developer/link-merchant first.', code: 'NO_LINKED_MERCHANT' });
    }

    const { payments, apiPayoutPin } = req.body || {};
    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ error: 'payments must be a non-empty array.' });
    }
    if (payments.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ error: `A batch can contain at most ${MAX_BATCH_SIZE} payments.` });
    }

    let priced;
    try {
      priced = priceRows(payments);
    } catch (e) {
      if (e instanceof PayoutDestinationError) return res.status(400).json({ error: e.message });
      throw e;
    }

    const mode = req.apiKey.mode;
    let merchant = null;
    const batchTotal = priced.reduce((sum, r) => sum + r.netAmount, 0);

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
      const overCap = priced.findIndex((r) => r.netAmount > (caps.perTransactionKes || 0));
      if (overCap !== -1) {
        return res.status(403).json({ error: `payments[${overCap}]: amount exceeds the per-transaction cap of KES ${caps.perTransactionKes}.`, code: 'PER_TRANSACTION_CAP_EXCEEDED' });
      }
      const spentLast24h = await sumLiveApiPayoutsLast24h(merchantId);
      if (spentLast24h + batchTotal > (caps.dailyKes || 0)) {
        return res.status(403).json({ error: `This batch's total (KES ${batchTotal.toLocaleString()}) would exceed the daily cap of KES ${caps.dailyKes}.`, code: 'DAILY_CAP_EXCEEDED' });
      }
    }

    try {
      await claimClientIdempotencyKey(developer._id, idempotencyKey);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) {
        const existing = await DeveloperPayment.find({ developerId: developer._id, idempotencyKey }).sort('createdAt');
        if (existing.length) {
          return res.status(200).json({ success: true, batchId: existing[0].batchId, payments: existing.map(publicDeveloperPayment), replayed: true });
        }
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }

    const batchId = crypto.randomBytes(8).toString('hex');

    const created = await DeveloperPayment.create(
      priced.map((r) => ({
        developerId: developer._id,
        apiKeyId: req.apiKey._id,
        merchantId,
        mode,
        kind: 'payout',
        amount: r.netAmount,
        status: 'pending',
        idempotencyKey,
        counterparty: r.destination.counterparty,
        batchId,
        payeeType: r.payeeType,
        grossAmount: r.grossAmount,
        taxDeductions: r.taxDeductions,
      }))
    );

    if (mode === 'test') {
      created.forEach((p) => simulateBatchRowSettlement(p._id));
      return res.status(201).json({ success: true, batchId, payments: created.map(publicDeveloperPayment) });
    }

    let succeeded = 0, failed = 0, pending = 0;
    for (let i = 0; i < created.length; i++) {
      const payment = created[i];
      const { destination, narration } = priced[i];
      const isAsyncRail = destination.type !== 'bank';
      try {
        let transaction;
        if (destination.type === 'bank') {
          ({ transaction } = await executeNcbaBankPayout({
            merchantId, bankCode: destination.counterparty.bankCode, accountNumber: destination.counterparty.accountNumber,
            accountName: destination.counterparty.accountName, amount: payment.amount, narration: narration || 'Developer API bulk payout',
          }));
        } else if (destination.type === 'mobile_money') {
          ({ transaction } = await executeNcbaMobileMoneyPayout({
            merchantId, phone: destination.counterparty.phone, network: destination.counterparty.network,
            beneficiaryName: destination.counterparty.accountName,
            amount: payment.amount, narration: narration || 'Developer API bulk payout',
          }));
        } else {
          ({ transaction } = await executeNcbaLipaNaMpesaPayout({
            merchantId,
            paymentType: destination.type === 'paybill' ? 'paybill' : 'till',
            payBillTillNo: destination.type === 'paybill' ? destination.counterparty.paybillNumber : destination.counterparty.tillNumber,
            accountReference: destination.counterparty.accountReference,
            amount: payment.amount, narration: narration || 'Developer API bulk payout',
          }));
        }

        if (isAsyncRail) {
          payment.linkedPayoutReference = transaction.reference;
          await payment.save();
          pending += 1;
          // Left 'pending' — resolves + fires payment.payout.* later via
          // ncbaOpenBankingController.js's resolvePendingOpenBankingTransaction,
          // the same generic resolver every async developer payout uses.
        } else {
          payment.status = 'success';
          payment.linkedTransactionId = transaction._id;
          await payment.save();
          dispatchDeveloperEvent(developer._id, 'payment.payout.succeeded', { payment: publicDeveloperPayment(payment) });
          succeeded += 1;
        }
      } catch (err) {
        payment.status = 'failed';
        payment.failureReason = err instanceof InsufficientFundsError || err instanceof NcbaOpenBankingValidationError
          ? err.message
          : 'Payout failed.';
        await payment.save();
        dispatchDeveloperEvent(developer._id, 'payment.payout.failed', { payment: publicDeveloperPayment(payment) });
        failed += 1;
      }
    }

    logAudit({
      action: 'developer.bulk_payment.executed', category: 'security', severity: 'critical',
      message: `Live API bulk payment batch of ${created.length} rows (KES ${batchTotal}) for merchant ${String(merchantId)} — ${succeeded} succeeded, ${pending} pending, ${failed} failed`,
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      metadata: { merchantId: String(merchantId), batchId, total: created.length, succeeded, pending, failed, apiKeyId: String(req.apiKey._id) },
    });

    dispatchDeveloperEvent(developer._id, 'bulk_payment.completed', {
      batchId, total: created.length, succeeded, pending, failed,
    });

    res.status(201).json({ success: true, batchId, payments: created.map(publicDeveloperPayment) });
  } catch (error) {
    console.error('Developer Bulk Payment Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Fetch every row from a batch created via POST /bulk-payments.
// @route   GET /api/v1/developer/bulk-payments/:batchId
// @access  Public (API key)
export const getDeveloperBulkPaymentBatch = async (req, res) => {
  try {
    const payments = await DeveloperPayment.find({ developerId: req.developer._id, batchId: req.params.batchId }).sort('createdAt');
    if (!payments.length) return res.status(404).json({ error: 'Batch not found.' });
    res.json({ success: true, batchId: req.params.batchId, payments: payments.map(publicDeveloperPayment) });
  } catch (error) {
    console.error('Get Developer Bulk Payment Batch Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
