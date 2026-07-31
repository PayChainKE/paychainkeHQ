import Merchant from '../models/Merchant.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS, buildStrictSms } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { parseSoapXmlSafely, findFirstTagValue, XmlSecurityError } from '../utils/xmlSecurity.js';
import {
  extractMerchantCode,
  parseNcbaCustomerField,
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
import { getNcbaVirtualAccountNumber, formatAccountNumberDisplay } from '../utils/ncbaValidators.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { toE164Kenyan } from '../utils/notificationService.js';

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

    // Checked and logged separately (still never logging the actual
    // received/expected values) so a live mismatch during an NCBA test can
    // be diagnosed from Render logs alone — "which field is wrong" beats a
    // single generic "auth_failed" when someone's on a call trying to
    // figure out why a test transaction didn't land.
    const userOk = timingSafeStringEqual(rawUser, expectedUser);
    const passwordOk = timingSafeStringEqual(rawPassword, expectedPassword);

    if (!userOk || !passwordOk) {
      logEvent('warn', 'ncba_account_notification_auth_failed', {
        transId,
        userMatched: userOk,
        passwordMatched: passwordOk,
        receivedUserLength: String(rawUser ?? '').length,
        expectedUserLength: expectedUser.length,
        receivedPasswordLength: String(rawPassword ?? '').length,
        expectedPasswordLength: expectedPassword.length,
      });
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
      // Field lengths only (never the secret key, the fields themselves,
      // or the hash values) — enough to spot "NCBA sent this field empty/
      // differently formatted than expected" without logging anything
      // sensitive.
      logEvent('warn', 'ncba_account_notification_hash_mismatch', {
        transId,
        txnType: rawTransType,
        receivedHashValLength: String(rawHashVal ?? '').length,
        fieldLengths: {
          transType: String(rawTransType ?? '').length,
          transId: String(rawTransId ?? '').length,
          transTime: String(rawTransTime ?? '').length,
          transAmount: String(rawTransAmount ?? '').length,
          accountNr: String(rawAccountNr ?? '').length,
          narrative: String(rawNarrative ?? '').length,
          phoneNr: String(rawPhoneNr ?? '').length,
          customerName: String(rawCustomerName ?? '').length,
          status: String(rawStatus ?? '').length,
        },
      });
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

    const merchantCode = extractMerchantCode({ narrative: rawNarrative, customerName: rawCustomerName, transId });

    if (!merchantCode) {
      // Before NCBA has assigned PayChain's institution prefix, virtual
      // accounts don't exist yet on their end — every notification they
      // send during this phase necessarily has no merchant reference to
      // extract, by construction, not by error. Confirmed live with
      // NCBA's integration team on 2026-07-28: right now they're only
      // testing that the notification itself arrives, authenticates, and
      // is acknowledged — not per-merchant routing, which can't be tested
      // until virtual accounts exist. Acknowledge as OK (never credits a
      // merchant either way — merchantCode is still null) so their UAT
      // shows success; still logged for visibility. The moment
      // NCBA_INSTITUTION_PREFIX is set (real go-live), this reverts to a
      // hard failure automatically, since attribution should always be
      // possible from then on and a miss would be a genuine problem.
      const virtualAccountsLive = /^\d{4}$/.test(process.env.NCBA_INSTITUTION_PREFIX || '');
      logEvent(virtualAccountsLive ? 'error' : 'warn', 'ncba_account_notification_unattributed', {
        transId, txnType: rawTransType, narrative: rawNarrative, phoneNr: rawPhoneNr, customerName: rawCustomerName, transAmount,
        virtualAccountsLive,
      });
      if (!virtualAccountsLive) {
        return respondOk(res, 'Notification received — virtual accounts not yet provisioned');
      }
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

    // CustomerName has proven more reliable than PhoneNr for actually
    // reaching the payer — observed live, PhoneNr has carried the Account
    // Number instead of a phone number, while CustomerName consistently
    // carries "NAME MSISDN <channel code>" (see parseNcbaCustomerField).
    // Parsed here (before the ledger write) so the real payer name reaches
    // the Transaction record itself, not just the merchant's SMS below.
    const parsedCustomer = parseNcbaCustomerField(rawCustomerName);

    let ledgerResult;
    try {
      ledgerResult = await creditNcbaCollection({
        merchant,
        grossAmount: transAmount,
        bankRef: transId,
        customerPhone: formatPhoneDisplay(rawPhoneNr) || null,
        customerName: parsedCustomer.name || null,
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
    const accountRef = formatAccountNumberDisplay(getNcbaVirtualAccountNumber(merchantCode) || merchantCode);

    // parsedCustomer was already computed above (before the ledger write).
    // Prefer the parsed MSISDN; fall back to PhoneNr only if CustomerName
    // didn't yield one.
    const customerPhone = parsedCustomer.phone || rawPhoneNr;
    const customerDisplayName = parsedCustomer.name || 'a customer';

    // rawPhoneNr is a known-unreliable fallback (see comment above — NCBA
    // has sent the Account Number in this field instead of an MSISDN), so
    // validate it actually looks like a Kenyan mobile number before
    // attempting delivery. Otherwise this always failed with a scary
    // "error"-level log for a data-availability gap on NCBA's side, not a
    // real bug — this merchant did get paid, we just have no phone to
    // confirm it to.
    if (customerPhone && toE164Kenyan(customerPhone)) {
      // businessName is the only unbounded field here.
      safeSendSMS({
        to: customerPhone,
        message: buildStrictSms(
          ({ ref, amt, name, acct, date, time }) =>
            `${ref} Confirmed. KES ${amt} paid to ${name} for account ${acct} on ${date} at ${time}. Thank you for your payment.`,
          {
            fixed: { ref: transId, amt: transAmount.toLocaleString(), acct: accountRef, date, time },
            truncatable: [{ key: 'name', value: merchant.businessName, minLength: 10 }],
          }
        ).message,
      }).then((result) => {
        if (!result.success) logEvent('error', 'ncba_account_notification_customer_sms_failed', { transId, error: result.error });
      });
    } else if (customerPhone) {
      logEvent('info', 'ncba_account_notification_customer_sms_skipped_no_phone', { transId, merchantId: merchant._id.toString() });
    }

    if (merchant.phone) {
      safeSendSMS({
        to: merchant.phone,
        // customerDisplayName is the only unbounded field here (comes from
        // NCBA's free-text CustomerName) — customerPhone is a bounded,
        // regex-matched MSISDN or empty, safe as fixed.
        message: buildStrictSms(
          ({ ref, amt, name, phone, date, time, balance }) =>
            `${ref} Payment Received. KES ${amt} from ${name}${phone ? ` (${phone})` : ''} via M-PESA on ${date} at ${time}. New balance: KES ${balance}.`,
          {
            fixed: { ref: transId, amt: transAmount.toLocaleString(), phone: formatPhoneDisplay(customerPhone) || '', date, time, balance: ledgerResult.merchant.kesBalance.toLocaleString() },
            truncatable: [{ key: 'name', value: customerDisplayName, minLength: 10 }],
          }
        ).message,
      }).then((result) => {
        // Logged on both outcomes — previously only failures were logged,
        // which made "SMS silently succeeded" and "SMS was never attempted
        // because merchant.phone was empty" indistinguishable from Render
        // logs alone (both produced zero output).
        if (result.success) {
          logEvent('info', 'ncba_account_notification_sms_sent', { transId, merchantId: merchant._id.toString(), phone: formatPhoneDisplay(merchant.phone) || merchant.phone, messageId: result.messageId });
        } else {
          logEvent('error', 'ncba_account_notification_sms_failed', { transId, merchantId: merchant._id.toString(), error: result.error });
        }
      });
    } else {
      logEvent('warn', 'ncba_account_notification_sms_skipped_no_phone', { transId, merchantId: merchant._id.toString() });
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
