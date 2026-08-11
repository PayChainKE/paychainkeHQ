import bcrypt from 'bcryptjs';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import {
  validatePesaLinkAccount,
  submitPesaLinkTransfer,
  submitEftTransfer,
  NcbaOpenBankingValidationError,
} from '../services/ncbaOpenBankingService.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { buildPayoutSentSms, buildPayoutFailedSms } from '../utils/paymentSmsTemplates.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { KENYAN_BANK_CODES } from '../config/kenyanBankCodes.js';
import { getB2cTariff } from '../config/mpesaB2cTariffCard.js';
import { PAYCHAIN_TXN_RATE } from '../config/revenueRateCard.js';

export class InsufficientFundsError extends Error {
  constructor(merchantId, requested, available) {
    super(`Merchant ${merchantId} has insufficient balance: requested ${requested}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Validates the destination and submits a bank transfer via either of
 * NCBA's two local-bank rails. Pure submit-only helper — does NOT touch
 * Merchant balance or create a Transaction record, so it's safe to call
 * from contexts that already manage their own balance reservation
 * (bulkPayController.authorizeBatch's Bank branch reserves the whole
 * batch's total upfront, one level above this per-row call).
 *
 * @param {'pesalink'|'eft'} [rail='pesalink'] - 'pesalink' settles
 *        immediately, 24/7/365; 'eft' settles next business day (T+1),
 *        Mon-Fri only. Per the UAT Guide both share the same request/
 *        response shape and KES 50-999,999 bounds — only settlement timing
 *        differs.
 *
 * The account-validation call (validatePesaLinkAccount) is reused for both
 * rails: NCBA's UAT Guide documents only one "Request for Account Number
 * Validation" endpoint, positioned ahead of the PesaLink section but
 * generic over bankCode/accountNumber — there is no separate EFT-specific
 * validation call documented, and skipping validation entirely for EFT
 * would leave that rail with no typo protection at all.
 *
 * Per NCBA's UAT Guide, both rails resolve synchronously — if this resolves
 * at all, the transfer succeeded (submitPesaLinkTransfer/submitEftTransfer
 * throw on a non-'000' resultCode, unlike M-Pesa's B2C/bulk-pay rails,
 * which only ever report "accepted" here and confirm completion later via
 * a callback).
 *
 * Throws NcbaOpenBankingValidationError on bad input or a failed
 * destination-account validation, or NcbaOpenBankingRequestError on a
 * synchronous rejection from NCBA.
 */
export async function submitNcbaBankTransfer({ businessName, bankCode, accountNumber, accountName, amount, narration, rail = 'pesalink' }) {
  const numericAmount = Number(amount);
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (rail !== 'pesalink' && rail !== 'eft') {
    throw new NcbaOpenBankingValidationError('rail must be either "pesalink" or "eft"');
  }

  // Fail fast on a bad destination account before touching balance.
  await validatePesaLinkAccount({
    bankCode,
    accountNumber,
    debitAccount: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER,
  });

  const transactionId = `NCBA-${rail === 'eft' ? 'EFT' : 'PL'}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const submit = rail === 'eft' ? submitEftTransfer : submitPesaLinkTransfer;
  const hostResponse = await submit({
    transactionId,
    beneficiaryAccountNumber: accountNumber,
    beneficiaryBankCode: bankCode,
    beneficiaryName: accountName || 'PayChain Payout',
    amount: numericAmount,
    narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
  });

  return { transactionId, hostResponse, rail };
}

/**
 * Atomically reserves a merchant's balance and submits a PesaLink transfer
 * in one call — used by handleBankPayout below (single, merchant-initiated
 * withdrawals) where balance hasn't been reserved by anything else yet.
 *
 * Throws NcbaOpenBankingValidationError, InsufficientFundsError, or
 * whatever ncbaOpenBankingService throws on a submission failure (after
 * refunding the reservation).
 */
export async function executeNcbaBankPayout({ merchantId, bankCode, accountNumber, accountName, amount, narration, rail = 'pesalink' }) {
  const numericAmount = Number(amount);

  // Fail fast on a bad destination account before touching balance —
  // submitNcbaBankTransfer would validate again below, but checking here
  // too avoids reserving funds for input that's already known-invalid.
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (rail !== 'pesalink' && rail !== 'eft') {
    throw new NcbaOpenBankingValidationError('rail must be either "pesalink" or "eft"');
  }

  // Atomically reserve funds — the $gte guard means this either fully
  // succeeds (balance was sufficient) or matches zero documents (it
  // wasn't), so no read-then-write gap for a concurrent request to race
  // through. Mirrors services/ncbaBulkPaymentService.js's reservation
  // pattern.
  const reservedMerchant = await Merchant.findOneAndUpdate(
    { _id: merchantId, kesBalance: { $gte: numericAmount } },
    { $inc: { kesBalance: -numericAmount } },
    { returnDocument: 'after' }
  );

  if (!reservedMerchant) {
    const merchant = await Merchant.findById(merchantId);
    throw new InsufficientFundsError(merchantId, numericAmount, merchant?.kesBalance ?? 0);
  }

  let transactionId, hostResponse;
  try {
    ({ transactionId, hostResponse } = await submitNcbaBankTransfer({
      businessName: reservedMerchant.businessName, bankCode, accountNumber, accountName, amount: numericAmount, narration, rail,
    }));
  } catch (err) {
    // Submission never reached (or was rejected outright by) NCBA — refund
    // the reservation in full since nothing was disbursed.
    await Merchant.findByIdAndUpdate(merchantId, { $inc: { kesBalance: numericAmount } });
    throw err;
  }

  const transaction = await Transaction.create({
    merchantId,
    accountNumber: reservedMerchant.paybillAccount || 'WALLET_FUND',
    // Already fee-mapped to the ncba_disbursement_fee revenue stream (see
    // config/revenueRateCard.js) — unlike 'withdrawal', which earns nothing.
    type: 'ncba_outbound',
    amount: numericAmount,
    kesAmount: numericAmount,
    currency: 'KES',
    // 'completed', not 'pending' — PesaLink resolves synchronously (see
    // submitNcbaBankTransfer); by this point NCBA has already confirmed
    // the transfer succeeded, or an error was thrown and caught above.
    status: 'completed',
    reference: transactionId,
    sender: { name: reservedMerchant.businessName, id: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER || 'PAYCHAIN_NCBA_ACCOUNT' },
    recipient: { name: accountName || 'Bank Account', id: accountNumber },
    settlementRail: rail,
  });

  return { transaction, hostResponse, merchant: reservedMerchant };
}

// @desc    List NCBA-recognized bank clearing codes, for the merchant
//          dashboard's bank-destination picker.
// @route   GET /openbanking/bank-codes (mounted at /api/v1 and /v1)
// @access  Private (merchant)
export const getBankCodes = (req, res) => {
  res.json({ bankCodes: KENYAN_BANK_CODES });
};

// @desc    Merchant-initiated single withdrawal to a bank account via NCBA
//          PesaLink (immediate) or EFT (next business day)
// @route   POST /openbanking/bank-payout (mounted at /api/v1 and /v1)
// @access  Private (merchant)
export const handleBankPayout = async (req, res) => {
  const merchantId = req.merchant._id;
  const { bankCode, accountNumber, accountName, amount, narration, pin, rail: requestedRail } = req.body;
  const rail = requestedRail === 'eft' ? 'eft' : 'pesalink';

  try {
    if (!pin || String(pin).length !== 4) {
      return res.status(400).json({ error: 'A valid 4-digit payment PIN is required.' });
    }
    if (requestedRail && requestedRail !== 'pesalink' && requestedRail !== 'eft') {
      return res.status(400).json({ error: 'rail must be either "pesalink" or "eft".' });
    }

    // PIN checked inline, within this same request that executes the
    // transfer — deliberately not the decoupled verify-payment-pin
    // pre-flight pattern the frontend uses elsewhere, which nothing
    // server-side actually enforces.
    const merchant = await Merchant.findById(merchantId).select('+appPin');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    if (!merchant.appPin) {
      return res.status(400).json({ error: 'Please set up your payment PIN first.', pinNotSet: true });
    }

    try {
      await assertPinNotLocked(merchantId);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const pinMatches = await bcrypt.compare(String(pin), merchant.appPin);
    if (!pinMatches) {
      await recordFailedPinAttempt(merchantId);
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }
    await resetPinAttempts(merchantId);

    const { transaction, hostResponse, merchant: updatedMerchant } = await executeNcbaBankPayout({
      merchantId, bankCode, accountNumber, accountName, amount, narration, rail,
    });

    createNotification({
      merchantId,
      kind: 'payment',
      title: 'Bank payout completed',
      message: rail === 'eft'
        ? `KES ${Number(amount).toLocaleString()} was sent to your bank account via EFT. It settles by the next business day.`
        : `KES ${Number(amount).toLocaleString()} was sent to your bank account via PesaLink.`,
    }).catch((e) => logEvent('error', 'ncba_openbanking_payout_notification_failed', { transactionId: transaction.reference, error: e.message }));

    if (updatedMerchant.phone) {
      const { date, time } = formatTransactionDateTime();
      const { message } = buildPayoutSentSms({
        ref: transaction.reference,
        label: rail === 'eft' ? 'Bank Payout (EFT)' : 'Bank Payout',
        amount: Number(amount),
        recipientName: accountName || 'your bank account',
        date,
        time,
        balance: updatedMerchant.kesBalance,
      });
      safeSendSMS({
        to: updatedMerchant.phone,
        message,
      }).then((result) => {
        if (!result.success) logEvent('error', 'ncba_openbanking_payout_sms_failed', { transactionId: transaction.reference, error: result.error });
      });
    }

    res.status(200).json({
      success: true,
      message: rail === 'eft'
        ? 'Bank transfer submitted via NCBA EFT. It settles by the next business day.'
        : 'Bank transfer completed via NCBA PesaLink.',
      transaction,
      newBalance: updatedMerchant.kesBalance,
      hostResponse,
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer.' });
    }
    if (err instanceof NcbaOpenBankingValidationError) {
      return res.status(400).json({ error: err.message });
    }
    logEvent('error', 'ncba_openbanking_payout_error', { merchantId: merchantId.toString(), error: err.message, stack: err.stack });
    res.status(502).json({ error: 'Failed to process bank payout. Please try again.' });
  }
};

// @desc    NCBA Open Banking per-transaction result callback — distinct
//          from the account-level SOAP notification webhook
//          (ncbaAccountNotificationController.js).
//
//          This IS the settlement path for bulk payouts: services/
//          ncbaBulkPaymentService.js's BILLPAY/utility rows are created
//          'pending' and only ever resolved here (PesaLink/EFT single
//          payouts resolve synchronously in handleBankPayout above and
//          never reach this handler in 'pending' state). Route-level auth
//          (verifyNcbaBasicAuth in ncbaRoutes.js) is what stops anyone who
//          can read/guess a payment reference from POSTing a fake
//          FAILED status here to trigger a refund of a real payout.
// @route   POST /webhooks/ncba-openbanking-callback (mounted at /api/v1 and /v1)
// @access  NCBA host-to-host only (HTTP Basic Auth via verifyNcbaBasicAuth)
export const handlePesaLinkCallback = async (req, res) => {
  // Ack immediately — same "banks retry on non-200/slow response"
  // convention as the account-notification webhook.
  res.status(200).json({ resultCode: '0', resultDescription: 'Accepted' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawReference = body.TransactionID || body.transactionId || body.reference;
  // Reject anything that isn't a plain string before it ever reaches a Mongo
  // query filter below — a body-derived object here (e.g. an
  // {"$ne": null}-shaped value) would otherwise be interpreted as a query
  // operator instead of an equality match, matching an arbitrary pending
  // transaction rather than the one this callback is actually about. Route
  // auth (verifyNcbaBasicAuth) is the primary control here, but this is
  // cheap defense-in-depth against a leaked/misused credential.
  if (typeof rawReference !== 'string' || !rawReference) {
    logEvent('warn', 'ncba_openbanking_callback_missing_reference', { body });
    return;
  }
  const reference = rawReference;

  try {
    const succeeded = ['SUCCESS', 'COMPLETED', '0'].includes(String(body.Status || body.status || '').toUpperCase());

    // Atomic claim on the pending->resolved transition — a plain
    // `if (transaction.status === 'pending')` read followed by a separate
    // `.save()` is a TOCTOU race: two redeliveries of the same callback
    // (NCBA retries, like every other bank webhook) could both read
    // 'pending' before either write, double-refunding a failed payout. The
    // status:'pending' filter here is what makes only one caller ever win.
    const transaction = await Transaction.findOneAndUpdate(
      { reference, status: 'pending' },
      { $set: { status: succeeded ? 'completed' : 'failed' } },
      { returnDocument: 'after' }
    );
    if (!transaction) {
      logEvent('info', 'ncba_openbanking_callback_no_pending_match', { reference });
      return;
    }

    let merchantForSms = null;
    if (!succeeded) {
      // The payout never landed — return the funds to the merchant's balance.
      // For ncba_mobile_b2w/ncba_lipa_na_mpesa specifically, PayChain's own
      // fee was ALSO deducted alongside the payout amount at initiation
      // (mpesaController.js's initiateB2C/initiateB2B) — refunding only
      // transaction.amount here would permanently cost the merchant that
      // fee even though the transfer never went through.
      let refundAmount = transaction.amount;
      if (transaction.type === 'ncba_mobile_b2w') {
        const { totalFee } = getB2cTariff(transaction.amount);
        refundAmount += totalFee;
      } else if (transaction.type === 'ncba_lipa_na_mpesa') {
        refundAmount += Math.round(transaction.amount * PAYCHAIN_TXN_RATE * 100) / 100;
      }
      merchantForSms = await Merchant.findByIdAndUpdate(
        transaction.merchantId,
        { $inc: { kesBalance: refundAmount } },
        { returnDocument: 'after' }
      );
    } else {
      merchantForSms = await Merchant.findById(transaction.merchantId).select('phone');
    }

    // This webhook now resolves bank-account payouts (PesaLink/EFT), Mobile
    // B2W (M-Pesa/Airtel number) payouts, and Lipa na M-Pesa (Paybill/Till)
    // payouts — "Bank payout" wording would be wrong for the latter two.
    const isBankPayout = !['ncba_mobile_b2w', 'ncba_lipa_na_mpesa'].includes(transaction.type);
    const payoutLabel = isBankPayout ? 'Bank payout' : 'Payout';

    createNotification({
      merchantId: transaction.merchantId,
      kind: 'payment',
      title: succeeded ? `${payoutLabel} completed` : `${payoutLabel} failed`,
      message: succeeded
        ? `KES ${transaction.amount.toLocaleString()} was successfully sent to ${transaction.recipient?.name || 'the recipient'}.`
        : `KES ${transaction.amount.toLocaleString()} ${payoutLabel.toLowerCase()} to ${transaction.recipient?.name || 'the recipient'} failed and was refunded to your balance.`,
    }).catch((e) => logEvent('error', 'ncba_openbanking_callback_notification_failed', { reference, error: e.message }));

    if (merchantForSms?.phone) {
      const { date, time } = formatTransactionDateTime();
      const recipientName = transaction.recipient?.name || 'the recipient';
      const { message } = succeeded
        ? buildPayoutSentSms({ ref: reference, label: payoutLabel, amount: transaction.amount, recipientName, date, time })
        : buildPayoutFailedSms({ ref: reference, label: payoutLabel, amount: transaction.amount, recipientName, date, time, balance: merchantForSms.kesBalance || 0 });
      safeSendSMS({ to: merchantForSms.phone, message }).then((r) => {
        if (!r.success) logEvent('error', 'ncba_openbanking_callback_sms_failed', { reference, error: r.error });
      });
    }

    // Update the matching row inside a bulk-pay batch, if this reference belongs to one.
    // Atomic per-row claim (positional $ filtered on the row's own
    // 'pending' status) plus a compare-and-swap on the aggregate status —
    // same reasoning as the Transaction update above.
    const batch = await PayoutBatch.findOneAndUpdate(
      { 'transactions.receiptNumber': reference, 'transactions.status': 'pending' },
      { $set: { 'transactions.$.status': succeeded ? 'completed' : 'failed' } },
      { returnDocument: 'after' }
    );
    if (batch) {
      const previousBatchStatus = batch.status;
      const statuses = batch.transactions.map((t) => t.status);
      let newBatchStatus = previousBatchStatus;
      if (statuses.every((s) => s === 'completed')) newBatchStatus = 'Processed';
      else if (statuses.some((s) => s === 'pending')) newBatchStatus = 'Pending';
      else if (statuses.some((s) => s === 'failed')) newBatchStatus = 'Partial';
      if (newBatchStatus !== previousBatchStatus) {
        await PayoutBatch.updateOne({ _id: batch._id, status: previousBatchStatus }, { $set: { status: newBatchStatus } });
      }

      // Every row just settled (batch left 'Pending' for the first time) —
      // send the one summary SMS for the whole batch here, not one per row.
      const justResolved = previousBatchStatus === 'Pending' && newBatchStatus !== 'Pending';
      if (justResolved) {
        const batchMerchant = await Merchant.findById(batch.merchantId).select('phone');
        if (batchMerchant?.phone) {
          const succeededCount = statuses.filter((s) => s === 'completed').length;
          const failedCount = statuses.filter((s) => s === 'failed').length;
          const { date: batchDate, time: batchTime } = formatTransactionDateTime();
          const batchMessage = `${batch.batchReference} Bulk Payout ${newBatchStatus} on ${batchDate} at ${batchTime}. ${succeededCount} of ${batch.transactions.length} payout(s) completed (KES ${batch.totalNetAmount.toLocaleString()} total)${failedCount > 0 ? `; ${failedCount} failed and refunded` : ''}.`;
          safeSendSMS({ to: batchMerchant.phone, message: batchMessage }).then((r) => {
            if (!r.success) logEvent('error', 'ncba_openbanking_batch_sms_failed', { batchId: batch._id.toString(), error: r.error });
          });
        }
      }
    }

    logEvent('info', 'ncba_openbanking_callback_processed', { reference, succeeded });
  } catch (err) {
    logEvent('error', 'ncba_openbanking_callback_error', { reference, error: err.message, stack: err.stack });
  }
};
