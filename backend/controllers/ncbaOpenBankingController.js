import bcrypt from 'bcryptjs';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import {
  validatePesaLinkAccount,
  submitPesaLinkTransfer,
  submitEftTransfer,
  submitRtgsTransfer,
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
 * Validates the destination and submits a bank transfer via any of NCBA's
 * three local/cross-border bank rails. Pure submit-only helper — does NOT
 * touch Merchant balance or create a Transaction record, so it's safe to
 * call from contexts that already manage their own balance reservation
 * (bulkPayController.authorizeBatch's Bank branch reserves the whole
 * batch's total upfront, one level above this per-row call).
 *
 * @param {'pesalink'|'eft'|'rtgs'} [rail='pesalink'] - 'pesalink' settles
 *        immediately, 24/7/365, Kenya/KES only; 'eft' settles next business
 *        day (T+1), Mon-Fri only, Kenya/KES only; 'rtgs' settles T+3 hours
 *        same business day, supports KE/UG/TZ/RW beneficiaries in seven
 *        currencies, and has no maximum amount cap (only pesalink/eft are
 *        bounded at KES 999,999).
 * @param {string} [beneficiaryCountry] - required for rail:'rtgs' (KE/UG/TZ/RW)
 * @param {string} [beneficiaryAddress] - used for rail:'rtgs' only
 * @param {string} [creditCurrency] - used for rail:'rtgs' only, defaults 'KES'
 * @param {string} [debitCurrency] - used for rail:'rtgs' only, defaults 'KES'
 * @param {string} [purposeCode] - used for rail:'rtgs' only; NCBA's Purpose
 *        of Payment code list is "to be shared during onboarding" per the
 *        UAT Guide, so this falls back to their own sample value ('MSC')
 *        when not provided — see submitRtgsTransfer.
 *
 * The account-validation call (validatePesaLinkAccount) is reused for
 * pesalink/eft: NCBA's UAT Guide documents only one "Request for Account
 * Number Validation" endpoint, positioned ahead of the PesaLink section but
 * generic over bankCode/accountNumber — there is no separate EFT-specific
 * validation call documented, and skipping validation entirely for EFT
 * would leave that rail with no typo protection at all. RTGS has no
 * documented validation endpoint at all (its BeneficiaryBankBIC is a real
 * SWIFT code, not a CBK clearing code validatePesaLinkAccount understands),
 * so rail:'rtgs' skips this pre-flight check entirely — submission is the
 * only available correctness check for that rail today.
 *
 * Per NCBA's UAT Guide, all three rails resolve synchronously — if this
 * resolves at all, the transfer succeeded (submitPesaLinkTransfer/
 * submitEftTransfer/submitRtgsTransfer throw on a non-'000' resultCode,
 * unlike M-Pesa's B2C/bulk-pay rails, which only ever report "accepted"
 * here and confirm completion later via a callback).
 *
 * Throws NcbaOpenBankingValidationError on bad input or a failed
 * destination-account validation, or NcbaOpenBankingRequestError on a
 * synchronous rejection from NCBA.
 */
export async function submitNcbaBankTransfer({
  businessName, bankCode, accountNumber, accountName, amount, narration,
  rail = 'pesalink', beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
}) {
  const numericAmount = Number(amount);
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (!['pesalink', 'eft', 'rtgs'].includes(rail)) {
    throw new NcbaOpenBankingValidationError('rail must be "pesalink", "eft" or "rtgs"');
  }
  if (rail === 'rtgs' && !beneficiaryCountry) {
    throw new NcbaOpenBankingValidationError('beneficiaryCountry is required for an RTGS transfer');
  }
  // Merchant balance is held and debited purely in KES (Merchant.kesBalance)
  // — RTGS itself supports settling in USD/GBP/EUR/TZS/UGX/RWF, but nothing
  // in this codebase converts a non-KES CreditAmount back into how much KES
  // to actually deduct from the merchant's wallet. Allowing a non-KES
  // currency through here would silently debit the wrong amount (e.g.
  // deduct "500" KES from the wallet for a transfer that actually sent 500
  // USD). Locked to KES-only until real FX conversion is built for this
  // rail specifically.
  if (rail === 'rtgs' && ((creditCurrency && creditCurrency !== 'KES') || (debitCurrency && debitCurrency !== 'KES'))) {
    throw new NcbaOpenBankingValidationError('Multi-currency RTGS transfers are not yet supported — creditCurrency and debitCurrency must be KES until FX conversion is added.');
  }

  // Fail fast on a bad destination account before touching balance — not
  // possible for RTGS, which has no documented validation endpoint (see
  // doc comment above).
  if (rail !== 'rtgs') {
    await validatePesaLinkAccount({
      bankCode,
      accountNumber,
      debitAccount: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER,
    });
  }

  const railPrefix = { pesalink: 'PL', eft: 'EFT', rtgs: 'RTGS' }[rail];
  const transactionId = `NCBA-${railPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  let hostResponse;
  if (rail === 'rtgs') {
    hostResponse = await submitRtgsTransfer({
      transactionId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryBankBic: bankCode,
      beneficiaryName: accountName || 'PayChain Payout',
      beneficiaryCountry,
      beneficiaryAddress,
      amount: numericAmount,
      creditCurrency,
      debitCurrency,
      narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
      purposeCode,
    });
  } else {
    const submit = rail === 'eft' ? submitEftTransfer : submitPesaLinkTransfer;
    hostResponse = await submit({
      transactionId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryBankCode: bankCode,
      beneficiaryName: accountName || 'PayChain Payout',
      amount: numericAmount,
      narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
    });
  }

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
export async function executeNcbaBankPayout({
  merchantId, bankCode, accountNumber, accountName, amount, narration,
  rail = 'pesalink', beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
}) {
  const numericAmount = Number(amount);

  // Fail fast on a bad destination account before touching balance —
  // submitNcbaBankTransfer would validate again below, but checking here
  // too avoids reserving funds for input that's already known-invalid.
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (!['pesalink', 'eft', 'rtgs'].includes(rail)) {
    throw new NcbaOpenBankingValidationError('rail must be "pesalink", "eft" or "rtgs"');
  }
  if (rail === 'rtgs' && !beneficiaryCountry) {
    throw new NcbaOpenBankingValidationError('beneficiaryCountry is required for an RTGS transfer');
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
      beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
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
//          PesaLink (immediate), EFT (next business day), or RTGS
//          (cross-border/multi-currency, KES-only for now — see
//          submitNcbaBankTransfer's doc comment)
// @route   POST /openbanking/bank-payout (mounted at /api/v1 and /v1)
// @access  Private (merchant)
export const handleBankPayout = async (req, res) => {
  const merchantId = req.merchant._id;
  const {
    bankCode, accountNumber, accountName, amount, narration, pin, rail: requestedRail,
    beneficiaryCountry, beneficiaryAddress, purposeCode,
  } = req.body;
  const rail = ['eft', 'rtgs'].includes(requestedRail) ? requestedRail : 'pesalink';

  try {
    if (!pin || String(pin).length !== 4) {
      return res.status(400).json({ error: 'A valid 4-digit payment PIN is required.' });
    }
    if (requestedRail && !['pesalink', 'eft', 'rtgs'].includes(requestedRail)) {
      return res.status(400).json({ error: 'rail must be "pesalink", "eft" or "rtgs".' });
    }
    if (rail === 'rtgs' && !beneficiaryCountry) {
      return res.status(400).json({ error: 'beneficiaryCountry is required for an RTGS transfer.' });
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
      beneficiaryCountry, beneficiaryAddress, purposeCode,
    });

    const RAIL_NOTIFICATION_MESSAGE = {
      eft: `KES ${Number(amount).toLocaleString()} was sent to your bank account via EFT. It settles by the next business day.`,
      rtgs: `KES ${Number(amount).toLocaleString()} was sent to your bank account via RTGS. It settles within a few hours.`,
      pesalink: `KES ${Number(amount).toLocaleString()} was sent to your bank account via PesaLink.`,
    };
    createNotification({
      merchantId,
      kind: 'payment',
      title: 'Bank payout completed',
      message: RAIL_NOTIFICATION_MESSAGE[rail],
    }).catch((e) => logEvent('error', 'ncba_openbanking_payout_notification_failed', { transactionId: transaction.reference, error: e.message }));

    if (updatedMerchant.phone) {
      const { date, time } = formatTransactionDateTime();
      const RAIL_SMS_LABEL = { eft: 'Bank Payout (EFT)', rtgs: 'Bank Payout (RTGS)', pesalink: 'Bank Payout' };
      const { message } = buildPayoutSentSms({
        ref: transaction.reference,
        label: RAIL_SMS_LABEL[rail],
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

    const RAIL_RESPONSE_MESSAGE = {
      eft: 'Bank transfer submitted via NCBA EFT. It settles by the next business day.',
      rtgs: 'Bank transfer submitted via NCBA RTGS. It settles within a few hours.',
      pesalink: 'Bank transfer completed via NCBA PesaLink.',
    };
    res.status(200).json({
      success: true,
      message: RAIL_RESPONSE_MESSAGE[rail],
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
    // B2W (M-Pesa/Airtel number) payouts, Lipa na M-Pesa (Paybill/Till)
    // payouts, KPLC bill payments, and NCWSC (Nairobi Water) bill payments
    // — "Bank payout" wording would be wrong for all but the first. Note
    // bulk-pay's Bank-routed rows (PesaLink synchronous branch in
    // bulkPayController.js) never reach this webhook in 'pending' state, so
    // in practice every 'ncba_outbound' row that does land here is a real
    // bank payout, not a mislabeled one.
    const NON_BANK_TYPE_LABELS = { ncba_kplc: 'KPLC bill payment', ncba_kplc_prepaid: 'KPLC prepaid token purchase', ncba_ncwsc: 'NCWSC bill payment' };
    const isBankPayout = !['ncba_mobile_b2w', 'ncba_lipa_na_mpesa', ...Object.keys(NON_BANK_TYPE_LABELS)].includes(transaction.type);
    const payoutLabel = isBankPayout ? 'Bank payout' : (NON_BANK_TYPE_LABELS[transaction.type] || 'Payout');

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
