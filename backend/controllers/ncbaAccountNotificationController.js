import Merchant from '../models/Merchant.js';
import { createNotification } from './notificationController.js';
import { sendSMS } from '../utils/sms.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { parseSoapXmlSafely, findFirstTagValue, XmlSecurityError } from '../utils/xmlSecurity.js';
import {
  extractMerchantCode,
  validateTransAmount,
  validateTransId,
  NcbaAccountNotificationError,
} from '../utils/ncbaAccountNotificationValidators.js';
import { isReconcilableTxnType } from '../config/ncbaAccountNotificationCodes.js';
import { verifyNcbaHashVal } from '../utils/ncbaHashVal.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';
import { buildNcbaOkResult, buildNcbaFailResult } from '../utils/ncbaSoapResponses.js';
import { creditNcbaCollection, DuplicateCollectionError } from '../services/ncbaLedgerService.js';
import { NcbaTariffBoundsError } from '../config/ncbaTariffCard.js';
import { getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';

const respondOk = (res, detail) => res.status(200).type('application/xml').send(buildNcbaOkResult(detail));
const respondFail = (res, detail) => res.status(200).type('application/xml').send(buildNcbaFailResult(detail));

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// @desc    NCBA Account-Level Notification Push — fires on every debit/credit
//          on PayChain's whole NCBA corporate account (SOAP XML). Only a
//          small allowlist of transaction types represent an actual customer
//          payment into a merchant's virtual account
//          (config/ncbaAccountNotificationCodes.js) — everything else, and
//          every debit (TransAmount < 0), is acknowledged and ignored.
// @route   POST /v1/webhooks/ncba-account-notification
//          POST /api/v1/webhooks/ncba-account-notification (legacy-compatible mount)
// @access  Public (NCBA host-to-host). Authenticated per NCBA's guide: the
//          <User>/<Password> tags embedded in the XML body are echoed back
//          verbatim on every call (values PayChain supplies during
//          onboarding), and <HashVal> is a SHA-256 integrity hash over the
//          other fields plus a shared secret key — see utils/ncbaHashVal.js.
//          There is no HTTP-header-based auth for this endpoint; NCBA's
//          optional OAuth2 flow (them calling a token endpoint *we'd* expose)
//          is explicitly not required and is not implemented here.
export const handleNcbaAccountNotification = async (req, res) => {
  const rawXml = req.body;
  let transId = 'UNKNOWN';

  try {
    let parsed;
    try {
      parsed = parseSoapXmlSafely(rawXml);
    } catch (err) {
      const message = err instanceof XmlSecurityError ? err.message : 'Malformed XML payload';
      logEvent('warn', 'ncba_account_notification_xml_rejected', { message });
      return respondFail(res, message);
    }

    const rawUser = findFirstTagValue(parsed, 'User');
    const rawPassword = findFirstTagValue(parsed, 'Password');
    const rawHashVal = findFirstTagValue(parsed, 'HashVal');
    const rawTransType = findFirstTagValue(parsed, 'TransType');
    const rawTransId = findFirstTagValue(parsed, 'TransID');
    const rawTransTime = findFirstTagValue(parsed, 'TransTime');
    const rawTransAmount = findFirstTagValue(parsed, 'TransAmount');
    const rawAccountNr = findFirstTagValue(parsed, 'AccountNr');
    const rawNarrative = findFirstTagValue(parsed, 'Narrative');
    const rawPhoneNr = findFirstTagValue(parsed, 'PhoneNr');
    const rawCustomerName = findFirstTagValue(parsed, 'CustomerName');
    const rawStatus = findFirstTagValue(parsed, 'Status');

    transId = validateTransId(rawTransId);

    const expectedUser = process.env.NCBA_ACCOUNT_NOTIFICATION_USERNAME;
    const expectedPassword = process.env.NCBA_ACCOUNT_NOTIFICATION_PASSWORD;
    const expectedSecretKey = process.env.NCBA_ACCOUNT_NOTIFICATION_SECRET_KEY;

    if (!expectedUser || !expectedPassword || !expectedSecretKey) {
      logEvent('error', 'ncba_account_notification_misconfigured', {
        transId,
        message: 'NCBA_ACCOUNT_NOTIFICATION_USERNAME / _PASSWORD / _SECRET_KEY not fully set',
      });
      return respondFail(res, 'Endpoint not configured');
    }

    const credentialsOk =
      timingSafeStringEqual(rawUser, expectedUser) &
      timingSafeStringEqual(rawPassword, expectedPassword);

    if (!credentialsOk) {
      logEvent('warn', 'ncba_account_notification_auth_failed', { transId });
      return respondFail(res, 'Invalid credentials');
    }

    const hashOk = verifyNcbaHashVal(rawHashVal, expectedSecretKey, {
      transType: rawTransType,
      transId: rawTransId,
      transTime: rawTransTime,
      transAmount: rawTransAmount,
      accountNr: rawAccountNr,
      narrative: rawNarrative,
      phoneNr: rawPhoneNr,
      customerName: rawCustomerName,
      status: rawStatus,
    });

    if (!hashOk) {
      logEvent('warn', 'ncba_account_notification_hash_mismatch', { transId, txnType: rawTransType });
      return respondFail(res, 'HashVal verification failed');
    }

    const transAmount = validateTransAmount(rawTransAmount);

    // NCBA's guide: TransAmount "can be a negative(debit) or positive
    // (credit) value" — direction lives in the sign, not the type code. A
    // debit (PayChain paying out) is never a merchant collection.
    if (transAmount < 0) {
      logEvent('info', 'ncba_account_notification_debit_ignored', { transId, txnType: rawTransType });
      return respondOk(res);
    }

    if (!isReconcilableTxnType(rawTransType)) {
      logEvent('info', 'ncba_account_notification_ignored', { transId, txnType: rawTransType });
      return respondOk(res);
    }

    const merchantCode = extractMerchantCode({ narrative: rawNarrative, phoneNr: rawPhoneNr, customerName: rawCustomerName, transId });

    if (!merchantCode) {
      // This IS a reconcilable credit type — failing to attribute it to a
      // merchant is a real gap that needs a human to look at the payload,
      // not a routine rejection. Logged at 'error' deliberately.
      logEvent('error', 'ncba_account_notification_unattributed', {
        transId, txnType: rawTransType, narrative: rawNarrative, phoneNr: rawPhoneNr, customerName: rawCustomerName, transAmount,
      });
      return respondFail(res, 'Could not attribute this credit to a merchant');
    }

    const merchant = await Merchant.findOne({ ncbaMerchantCode: merchantCode });
    if (!merchant) {
      logEvent('warn', 'ncba_account_notification_unknown_merchant', { transId, merchantCode });
      return respondFail(res, 'Unknown merchant');
    }

    if (merchant.status !== 'active') {
      logEvent('warn', 'ncba_account_notification_merchant_inactive', { transId, merchantId: merchant._id.toString(), status: merchant.status });
      return respondFail(res, `Merchant account is ${merchant.status}`);
    }

    let ledgerResult;
    try {
      ledgerResult = await creditNcbaCollection({
        merchant,
        grossAmount: transAmount,
        bankRef: transId,
        customerPhone: rawPhoneNr || null,
      });
    } catch (err) {
      if (err instanceof DuplicateCollectionError) {
        logEvent('info', 'ncba_account_notification_duplicate_acked', { transId, merchantId: merchant._id.toString() });
        return respondOk(res, 'Duplicate Notification');
      }
      throw err;
    }

    logEvent('info', 'ncba_account_notification_credited', {
      transId,
      txnType: rawTransType,
      merchantId: merchant._id.toString(),
      merchantCode,
      grossAmount: transAmount,
      paychainFee: ledgerResult.paychainFee,
      safaricomFee: ledgerResult.safaricomFee,
      netAmount: ledgerResult.netAmount,
      newBalance: ledgerResult.merchant.kesBalance,
    });

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${transAmount.toLocaleString()} via NCBA. Ref: ${transId}.`,
    }).catch((e) => logEvent('error', 'ncba_account_notification_notification_failed', { transId, error: e.message }));

    // Non-blocking customer + merchant SMS — sendSMS never throws (see
    // utils/sms.js), fired-and-forgotten so a slow or down SMS provider can
    // never delay the bank's ACK or hold the request open; a delivery
    // failure here only ever produces a log line. rawTransTime is NCBA's
    // own authoritative transaction timestamp (YYMMDDhhmm) — same
    // convention as the M-Pesa messages, which use Safaricom's TransTime
    // rather than the server's receive time.
    const { date, time } = formatTransactionDateTime(rawTransTime);
    const accountRef = getNcbaVirtualAccountNumber(merchantCode) || merchantCode;

    // rawPhoneNr is best-effort per NCBA's own guide (may be blank, or
    // occupied with something other than a phone number) — sendSMS/
    // toE164Kenyan fail closed and silently on anything not phone-shaped,
    // so attempting this is safe even when the field is unreliable.
    if (rawPhoneNr) {
      sendSMS(
        rawPhoneNr,
        `${transId} Confirmed. KES ${transAmount.toLocaleString()} paid to ${merchant.businessName} for account ${accountRef} on ${date} at ${time}. Thank you for your payment.`
      ).then((result) => {
        if (!result.success) logEvent('error', 'ncba_account_notification_customer_sms_failed', { transId, error: result.error });
      });
    }

    if (merchant.phone) {
      sendSMS(
        merchant.phone,
        `${transId} Payment Received. KES ${transAmount.toLocaleString()} received via NCBA on ${date} at ${time}. New balance: KES ${ledgerResult.merchant.kesBalance.toLocaleString()}.`
      ).then((result) => {
        if (!result.success) {
          logEvent('error', 'ncba_account_notification_sms_failed', { transId, merchantId: merchant._id.toString(), error: result.error });
        }
      });
    }

    return respondOk(res);
  } catch (err) {
    if (err instanceof NcbaAccountNotificationError) {
      logEvent('warn', 'ncba_account_notification_rejected', { transId, code: err.code, message: err.message });
      return respondFail(res, err.message);
    }

    if (err instanceof NcbaTariffBoundsError) {
      logEvent('warn', 'ncba_account_notification_rejected', { transId, code: 'AMOUNT_OUT_OF_BOUNDS', message: err.message });
      return respondFail(res, err.message);
    }

    logEvent('error', 'ncba_account_notification_internal_error', { transId, error: err.message, stack: err.stack });
    return respondFail(res, 'Internal processing failure');
  }
};
