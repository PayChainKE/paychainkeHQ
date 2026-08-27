import Merchant from '../models/Merchant.js';
import { createNotification } from './notificationController.js';
import { sendStaggeredSms } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { parseSoapXmlSafely, findFirstTagValue, XmlSecurityError } from '../utils/xmlSecurity.js';
import {
  extractMerchantCode,
  parseNcbaCustomerField,
  extractMsisdnFromText,
  validateTransAmount,
  validateTransId,
  NcbaAccountNotificationError,
} from '../utils/ncbaAccountNotificationValidators.js';
import { isReconcilableTxnType, isGenericTransferType } from '../config/ncbaAccountNotificationCodes.js';
import { verifyNcbaHashVal } from '../utils/ncbaHashVal.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';
import { buildNcbaOkResult, buildNcbaFailResult } from '../utils/ncbaSoapResponses.js';
import { creditNcbaCollection, DuplicateCollectionError, wasAlreadySettledByStkPush, findFalselyFailedStkRequest, wasAlreadyCreditedByOtherNcbaFeed } from '../services/ncbaLedgerService.js';
import { resolveStkOutcome } from './mpesaController.js';
import STKRequest from '../models/STKRequest.js';
import { NcbaTariffBoundsError } from '../config/ncbaTariffCard.js';
import { getNcbaVirtualAccountNumber, formatAccountNumberDisplay } from '../utils/ncbaValidators.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { buildPaymentReceivedSms, buildCustomerPaidSms } from '../utils/paymentSmsTemplates.js';

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

    const merchantCodeMatch = extractMerchantCode({ narrative: rawNarrative, customerName: rawCustomerName, transId });
    const merchantCode = merchantCodeMatch?.code ?? null;

    // A generic transfer type (PesaLink/Internal Transfer — see
    // isGenericTransferType's doc comment) covers ANY inbound transfer to
    // the pooled account, not just customer Virtual Account collections.
    // Auto-crediting one off a merchant code that only matched because some
    // unrelated 8-digit substring (a date, an invoice number, a truncated
    // phone number) happened to coincide with a real merchant's code would
    // misattribute someone else's money. Require the strong, structurally-
    // anchored match here; a weak match is parked for manual review instead
    // of silently trusted, the same way an unattributed credit already is
    // below.
    if (merchantCode && !merchantCodeMatch.strong && isGenericTransferType(rawTransType)) {
      logEvent('error', 'ncba_account_notification_weak_attribution_on_generic_type', {
        transId, txnType: rawTransType, merchantCode, narrative: rawNarrative, customerName: rawCustomerName, transAmount,
      });
      return respondFail(res, 'Could not confidently attribute this credit to a merchant — needs manual review');
    }

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

    // See wasAlreadySettledByStkPush's doc comment — this same money may
    // have already been credited via the app-aware NCBA STK Push poll
    // resolution (mpesaController.js's resolveStkOutcome), which applies a
    // completely different (correct) fee split for Payment Link/Invoice/
    // wallet-top-up flows than the generic credit below would.
    if (await wasAlreadySettledByStkPush(merchant, transAmount)) {
      logEvent('info', 'ncba_account_notification_already_settled_via_stk', { transId, merchantId: merchant._id.toString(), transAmount });
      return respondOk(res, 'Already settled via STK Push');
    }

    // See findFalselyFailedStkRequest's doc comment (services/ncbaLedgerService.js)
    // — NCBA's STK query endpoint can report a transient FAILED for a
    // payment that was still in flight; once the poll loop gives up, this
    // webhook is the only remaining signal that it actually succeeded.
    // Corrects the STKRequest itself (so the admin STK monitor reads
    // accurately) and settles through the same app-aware split STK/QR use,
    // instead of falling through to the generic credit below.
    const falselyFailedStk = await findFalselyFailedStkRequest(merchant, transAmount);
    if (falselyFailedStk) {
      await resolveStkOutcome(falselyFailedStk, {
        succeeded: true,
        receipt: transId,
        resultDesc: 'Corrected: NCBA account notification confirmed this payment actually succeeded',
        transTime: rawTransTime,
        allowFailedRetry: true,
      });
      logEvent('info', 'ncba_account_notification_corrected_false_stk_failure', { transId, merchantId: merchant._id.toString(), transAmount, stkRequestId: falselyFailedStk._id.toString() });
      return respondOk(res, 'Settled via STK Push (corrected from false failure)');
    }

    // Dynamic QR Code collections have no NCBA transaction ID to poll
    // against (unlike STK), so unlike wasAlreadySettledByStkPush above —
    // which only catches an *already-resolved* STK request racing this
    // webhook — a QR request is resolved right here, on first sight of the
    // matching payment. Settles through the same dual-sided-checkout split
    // STK uses (resolveStkOutcome), rather than falling through to the
    // generic full-amount credit below, which doesn't know part of this
    // money is PayChain's own surcharge, not the merchant's.
    const pendingQrRequest = await STKRequest.findOne({
      merchantId: merchant._id,
      channel: 'qr',
      status: 'pending',
      amount: transAmount,
    });
    if (pendingQrRequest) {
      await resolveStkOutcome(pendingQrRequest, {
        succeeded: true,
        receipt: transId,
        resultDesc: 'Paid via NCBA Dynamic QR Code',
        transTime: rawTransTime,
      });
      logEvent('info', 'ncba_account_notification_resolved_via_qr', { transId, merchantId: merchant._id.toString(), transAmount });
      return respondOk(res, 'Settled via QR code');
    }

    // See wasAlreadyCreditedByOtherNcbaFeed's doc comment
    // (services/ncbaLedgerService.js) — catches the same real collection
    // arriving on ncbaController.js's separate reconciliation feed under a
    // different reference before this one does.
    if (await wasAlreadyCreditedByOtherNcbaFeed(merchant, transAmount, transId)) {
      logEvent('info', 'ncba_account_notification_already_settled_via_other_feed', { transId, merchantId: merchant._id.toString(), transAmount });
      return respondOk(res, 'Already settled via reconciliation feed');
    }

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

    // Merchant-facing copy (notification + SMS below) shows netAmount, not
    // transAmount — transAmount is the gross figure NCBA reported, which
    // includes PayChain's fee and isn't what actually landed in kesBalance
    // (see creditNcbaCollection's $inc: { kesBalance: netAmount }). The
    // customer's own receipt further down correctly keeps transAmount,
    // since that's genuinely what they paid.
    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${ledgerResult.netAmount.toLocaleString()} via your PayChain Virtual Account. Ref: ${transId}.`,
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
    // Three sources, in order of reliability: the parsed MSISDN from
    // CustomerName, then PhoneNr (known-unreliable — NCBA has sent the
    // Account Number in this field instead of a phone), then a last-resort
    // search of the free-text Narrative field (extractMsisdnFromText) in
    // case NCBA echoed the payer's number there instead. Each candidate is
    // checked for VALIDITY in order, not just truthiness — a plain `||`
    // chain would short-circuit on PhoneNr the moment it's merely present
    // (which it almost always is, just often wrong), so the Narrative
    // fallback would never get a chance to run even when it has a real
    // number and PhoneNr doesn't. Reused below for both the customer
    // receipt and the merchant's "from" line, so neither ever shows
    // something that isn't actually a phone number. When none of the three
    // sources yield anything valid, that's a genuine data-availability gap
    // on NCBA's side, not a bug — this merchant did get paid, we just have
    // no phone to confirm it to.
    const validPayerPhone = [parsedCustomer.phone, rawPhoneNr, extractMsisdnFromText(rawNarrative)]
      .find((candidate) => candidate && toE164Kenyan(candidate)) || null;
    const customerDisplayName = parsedCustomer.name || 'a customer';

    // Staggered (not simultaneous) — confirmed live that firing both SMS
    // back-to-back gets the first dispatched in under a second but leaves
    // the second queued by Africa's Talking for minutes, every time (see
    // sendStaggeredSms's own doc comment). Detached (not awaited) so this
    // never delays this webhook's response to NCBA.
    const sends = [];
    if (validPayerPhone) {
      sends.push({
        to: validPayerPhone,
        message: buildCustomerPaidSms({
          ref: transId,
          amount: transAmount,
          businessName: merchant.businessName,
          accountRef,
          date,
          time,
        }).message,
      });
    } else {
      // Raw field values included (same convention as the 'unattributed'
      // log above) so a skip can actually be diagnosed after the fact —
      // previously this only recorded transId/merchantId, which confirmed
      // *that* all three candidates failed but never *why* (empty field?
      // garbage data? a format we don't parse yet?).
      logEvent('info', 'ncba_account_notification_customer_sms_skipped_no_phone', {
        transId,
        merchantId: merchant._id.toString(),
        rawPhoneNr,
        rawCustomerName,
        rawNarrative,
      });
    }

    if (merchant.phone) {
      // validPayerPhone already resolved and validated above — reused here
      // as-is, not recomputed.
      sends.push({
        to: merchant.phone,
        message: buildPaymentReceivedSms({
          ref: transId,
          amount: ledgerResult.netAmount,
          payerName: customerDisplayName,
          payerPhone: validPayerPhone,
          date,
          time,
          balance: ledgerResult.merchant.kesBalance,
        }).message,
      });
    } else {
      logEvent('warn', 'ncba_account_notification_sms_skipped_no_phone', { transId, merchantId: merchant._id.toString() });
    }

    sendStaggeredSms(sends).then((results) => {
      let idx = 0;
      if (validPayerPhone) {
        const result = results[idx++];
        if (!result.success) logEvent('error', 'ncba_account_notification_customer_sms_failed', { transId, error: result.error });
      }
      if (merchant.phone) {
        const result = results[idx++];
        // Logged on both outcomes — previously only failures were logged,
        // which made "SMS silently succeeded" and "SMS was never attempted
        // because merchant.phone was empty" indistinguishable from Render
        // logs alone (both produced zero output).
        if (result.success) {
          logEvent('info', 'ncba_account_notification_sms_sent', { transId, merchantId: merchant._id.toString(), phone: formatPhoneDisplay(merchant.phone) || merchant.phone, messageId: result.messageId });
        } else {
          logEvent('error', 'ncba_account_notification_sms_failed', { transId, merchantId: merchant._id.toString(), error: result.error });
        }
      }
    });

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
