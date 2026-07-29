import bcrypt from 'bcryptjs';
import Merchant from '../models/Merchant.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS, buildStrictSms } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import {
  validateMerchantCode,
  validateCollectionAmount,
  validatePhoneNumber,
  validateTransactionReference,
  getNcbaVirtualAccountNumber,
  formatAccountNumberDisplay,
  NcbaValidationError,
} from '../utils/ncbaValidators.js';
import { creditNcbaCollection, DuplicateCollectionError } from '../services/ncbaLedgerService.js';
import { NcbaTariffBoundsError } from '../config/ncbaTariffCard.js';
import {
  initiateBulkPayment,
  InsufficientFundsError,
  NcbaPayoutValidationError,
} from '../services/ncbaBulkPaymentService.js';

// NCBA's own integration guide requires HTTP 200 on every call — a non-200
// or connection-level failure is what triggers *their* host to retry the
// push through their own reconciliation queue. Pass/fail is communicated
// via resultCode in the JSON body instead, mirroring how mpesaController.js
// acks Safaricom's webhooks.
const respond = (res, { transactionReference, success, code, message }) =>
  res.status(200).json({
    transactionReference,
    resultCode: success ? '0' : (code || '1'),
    resultDescription: message || (success ? 'Accepted' : 'Rejected'),
  });

const accept = (res, transactionReference) => respond(res, { transactionReference, success: true });
const reject = (res, transactionReference, code, message) => respond(res, { transactionReference, success: false, code, message });

// One-line JSON per event — Vercel's log dashboard (and any log drain wired
// up behind it) can filter/query on `event`/`level` instead of grepping
// free-text strings. `console.error` for anything a human should be paged
// on, `console.warn` for expected-but-notable rejections, `console.log` for
// the success path.
function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// @desc    Inbound NCBA Virtual Account real-time reconciliation push
// @route   POST /v1/webhooks/ncba-reconciliation (api.paychain.co.ke)
//          POST /api/v1/webhooks/ncba-reconciliation (legacy-compatible mount)
// @access  Public (NCBA host-to-host, gated by verifyNcbaBasicAuth — see routes/ncbaRoutes.js)
export const handleNcbaReconciliationWebhook = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  let transactionReference = 'UNKNOWN';

  try {
    transactionReference = validateTransactionReference(body.transactionReference);
    const grossAmount = validateCollectionAmount(body.amount);
    const merchantCode = validateMerchantCode(body.merchantCode);

    // NCBA's reconciliation push doesn't guarantee a payer MSISDN — accept
    // one if present (still validated), otherwise proceed without it.
    const customerPhone = body.phoneNumber != null ? validatePhoneNumber(body.phoneNumber) : null;

    const merchant = await Merchant.findOne({ ncbaMerchantCode: merchantCode });
    if (!merchant) {
      logEvent('warn', 'ncba_reconciliation_unknown_merchant', { transactionReference, merchantCode });
      return reject(res, transactionReference, 'UNKNOWN_MERCHANT', 'No active merchant matches this Virtual Account');
    }

    if (merchant.status !== 'active') {
      logEvent('warn', 'ncba_reconciliation_merchant_inactive', { transactionReference, merchantId: merchant._id.toString(), status: merchant.status });
      return reject(res, transactionReference, 'MERCHANT_INACTIVE', `Merchant account is ${merchant.status}`);
    }

    let ledgerResult;
    try {
      ledgerResult = await creditNcbaCollection({ merchant, grossAmount, bankRef: transactionReference, customerPhone });
    } catch (err) {
      if (err instanceof DuplicateCollectionError) {
        logEvent('info', 'ncba_reconciliation_duplicate_acked', { transactionReference, merchantId: merchant._id.toString() });
        return accept(res, transactionReference);
      }
      throw err;
    }

    logEvent('info', 'ncba_reconciliation_credited', {
      transactionReference,
      merchantId: merchant._id.toString(),
      merchantCode,
      grossAmount,
      paychainFee: ledgerResult.paychainFee,
      safaricomFee: ledgerResult.safaricomFee,
      netAmount: ledgerResult.netAmount,
      newBalance: ledgerResult.merchant.kesBalance,
    });

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${grossAmount.toLocaleString()} via NCBA Virtual Account. Ref: ${transactionReference}.`,
    }).catch((e) => logEvent('error', 'ncba_reconciliation_notification_failed', { transactionReference, error: e.message }));

    // Non-blocking customer + merchant SMS — sendSMS never throws (see
    // utils/sms.js), fired-and-forgotten so a slow/down SMS provider can
    // never delay this webhook's ack to NCBA. This webhook's JSON payload
    // carries no transaction-time field of its own — "now" is accurate
    // here since NCBA's push arrives in near-real-time relative to the
    // actual transaction. Account reference mirrors M-Pesa's own "for
    // account X" convention: the full 12-digit virtual account number once
    // NCBA_INSTITUTION_PREFIX is configured, else the bare 8-digit
    // merchant code as a fallback.
    const { date, time } = formatTransactionDateTime();
    const accountRef = formatAccountNumberDisplay(getNcbaVirtualAccountNumber(merchantCode) || merchantCode);

    if (customerPhone) {
      // businessName is the only unbounded field — reference, amount,
      // account ref, date and time are always fixed-format.
      safeSendSMS({
        to: customerPhone,
        message: buildStrictSms(
          ({ ref, amt, name, acct, date, time }) =>
            `${ref} Confirmed. KES ${amt} paid to ${name} for account ${acct} on ${date} at ${time}. Thank you for your payment.`,
          {
            fixed: { ref: transactionReference, amt: grossAmount.toLocaleString(), acct: accountRef, date, time },
            truncatable: [{ key: 'name', value: merchant.businessName, minLength: 10 }],
          }
        ).message,
      }).then((result) => {
        if (!result.success) logEvent('error', 'ncba_reconciliation_customer_sms_failed', { transactionReference, error: result.error });
      });
    }

    if (merchant.phone) {
      safeSendSMS({
        to: merchant.phone,
        message: `${transactionReference} Payment Received. KES ${grossAmount.toLocaleString()} received via NCBA on ${date} at ${time}. New balance: KES ${ledgerResult.merchant.kesBalance.toLocaleString()}.`,
      }).then((result) => {
        if (!result.success) logEvent('error', 'ncba_reconciliation_sms_failed', { transactionReference, merchantId: merchant._id.toString(), error: result.error });
      });
    }

    return accept(res, transactionReference);
  } catch (err) {
    if (err instanceof NcbaValidationError) {
      logEvent('warn', 'ncba_reconciliation_rejected', { transactionReference, code: err.code, message: err.message });
      return reject(res, transactionReference, err.code, err.message);
    }

    if (err instanceof NcbaTariffBoundsError) {
      logEvent('warn', 'ncba_reconciliation_rejected', { transactionReference, code: 'AMOUNT_OUT_OF_BOUNDS', message: err.message });
      return reject(res, transactionReference, 'AMOUNT_OUT_OF_BOUNDS', err.message);
    }

    logEvent('error', 'ncba_reconciliation_internal_error', { transactionReference, error: err.message, stack: err.stack });
    return reject(res, transactionReference, 'INTERNAL_ERROR', 'Internal processing failure');
  }
};

// @desc    Initiate an NCBA bulk disbursement (suppliers + utility payouts)
// @route   POST /api/v1/bulk-payments
// @access  Private (merchant)
export const handleInitiateBulkPayment = async (req, res) => {
  try {
    const { payoutItems, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'Payment PIN is required.' });
    }
    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    if (!merchant.appPin) {
      return res.status(400).json({ error: 'Please set up your payment PIN first.' });
    }
    try {
      await assertPinNotLocked(req.merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }
    const pinMatches = await bcrypt.compare(String(pin), merchant.appPin);
    if (!pinMatches) {
      await recordFailedPinAttempt(req.merchant._id);
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
    await resetPinAttempts(req.merchant._id);

    const result = await initiateBulkPayment(req.merchant._id, payoutItems);

    if (result.merchant.phone) {
      const { date, time } = formatTransactionDateTime();
      safeSendSMS({
        to: result.merchant.phone,
        message: `${result.batch.batchReference} NCBA Bulk Payout Submitted. KES ${result.totalAmount.toLocaleString()} to ${payoutItems.length} recipient${payoutItems.length === 1 ? '' : 's'} on ${date} at ${time}. New balance: KES ${result.merchant.kesBalance.toLocaleString()}.`,
      }).then((r) => {
        if (!r.success) console.error(`NCBA bulk payment SMS failed for merchant ${req.merchant._id}:`, r.error);
      });
    }

    res.status(200).json({
      message: 'NCBA bulk payment batch submitted successfully.',
      batch: result.batch,
      hostResponse: result.hostResponse,
    });
  } catch (err) {
    if (err instanceof NcbaPayoutValidationError || err instanceof InsufficientFundsError) {
      return res.status(400).json({ error: err.message });
    }

    console.error('❌ NCBA bulk payment error:', err);
    res.status(500).json({ error: 'Failed to initiate NCBA bulk payment' });
  }
};
