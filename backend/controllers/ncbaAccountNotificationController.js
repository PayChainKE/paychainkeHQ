import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import MissedNcbaCollectionCandidate from '../models/MissedNcbaCollectionCandidate.js';
import { createNotification } from './notificationController.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
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
import { buildPaymentReceivedSms, buildPaybillPaymentReceiptSms } from '../utils/paymentSmsTemplates.js';
import { toTitleCase } from '../utils/smsSanitizer.js';
import NcbaDebitNotificationSample from '../models/NcbaDebitNotificationSample.js';
import NcbaPhoneExtractionMiss from '../models/NcbaPhoneExtractionMiss.js';

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
      // Temporary full-field capture (2026-08-28) — this feed is the only
      // one confirmed to reliably arrive for a Lipa na M-Pesa payout
      // (NCBA's dedicated settlement callback to handlePesaLinkCallback has
      // never been observed arriving, and TransactionStatusQuery is
      // confirmed broken — see probe-ncba-transaction-status-query.js).
      // Logging every raw field here, not just transId/txnType, to check
      // whether Narrative/AccountNr/CustomerName ever echoes back our own
      // reqTransactionReferenceNo/reqChnlId — if it does, this debit feed
      // could resolve stuck Lipa na M-Pesa/Mobile B2W payouts (and fire
      // their SMS) instead of waiting on the callback or status query that
      // don't work. Revert to the plain transId/txnType log once this is
      // resolved one way or the other.
      logEvent('info', 'ncba_account_notification_debit_ignored', {
        transId, txnType: rawTransType,
        rawNarrative, rawAccountNr, rawCustomerName, rawPhoneNr, rawTransAmount,
      });
      NcbaDebitNotificationSample.create({
        transId, txnType: rawTransType, rawTransAmount, rawNarrative, rawAccountNr, rawCustomerName, rawPhoneNr,
      }).catch((e) => logEvent('error', 'ncba_debit_notification_sample_log_failed', { transId, error: e.message }));
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

    // Hoisted up from where this used to be computed (right before the SMS
    // sends, far below) so the QR-resolution branch below can also use it —
    // every input it depends on (parsedCustomer, rawPhoneNr, rawNarrative)
    // is already available at this point. See the full explanation on its
    // original computation further down, near the SMS sends.
    const validPayerPhone = [parsedCustomer.phone, rawPhoneNr, extractMsisdnFromText(rawNarrative)]
      .find((candidate) => candidate && toE164Kenyan(candidate)) || null;

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
      // A QR scan never captures the payer's phone up front (unlike STK,
      // where PayChain pushed the prompt to a known number) — so
      // pendingQrRequest.phone is null at creation, and resolveStkOutcome's
      // customer-receipt branch (gated on stkReq.phone) has never had a
      // number to send to. This is the same webhook payload the generic
      // credit path below already mines a payer phone out of — attaching it
      // here, before resolving, lets resolveStkOutcome's existing
      // buildCustomerPaidSms logic fire for QR payments too, the same way
      // it already does for STK.
      if (validPayerPhone && !pendingQrRequest.phone) {
        await STKRequest.updateOne({ _id: pendingQrRequest._id }, { $set: { phone: validPayerPhone } });
        pendingQrRequest.phone = validPayerPhone;
      }
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

    // validPayerPhone was already computed above (before the ledger write,
    // so the QR-resolution branch could use it too). Three sources, in
    // order of reliability: the parsed MSISDN from CustomerName, then
    // PhoneNr (known-unreliable — NCBA has sent the Account Number in this
    // field instead of a phone), then a last-resort search of the free-text
    // Narrative field (extractMsisdnFromText) in case NCBA echoed the
    // payer's number there instead. Each candidate is checked for VALIDITY
    // in order, not just truthiness — a plain `||` chain would short-circuit
    // on PhoneNr the moment it's merely present (which it almost always is,
    // just often wrong), so the Narrative fallback would never get a chance
    // to run even when it has a real number and PhoneNr doesn't. Reused
    // below for both the customer receipt and the merchant's "from" line, so
    // neither ever shows something that isn't actually a phone number. When
    // none of the three sources yield anything valid, that's a genuine
    // data-availability gap on NCBA's side, not a bug — this merchant did
    // get paid, we just have no phone to confirm it to.
    // NCBA's CustomerName arrives in ALL CAPS ("JACOB BRANDON OMUTITI") —
    // toTitleCase renders it as "Jacob Brandon Omutiti" for the merchant's
    // SMS. Display-only: parsedCustomer.name itself (used above for
    // attribution/logging) stays untouched.
    const customerDisplayName = parsedCustomer.name ? toTitleCase(parsedCustomer.name) : 'a customer';

    // Staggered (not simultaneous) — confirmed live that firing both SMS
    // back-to-back gets the first dispatched in under a second but leaves
    // the second queued by Africa's Talking for minutes, every time (see
    // sendStaggeredSms's own doc comment). Detached (not awaited) so this
    // never delays this webhook's response to NCBA.
    const sends = [];
    if (validPayerPhone) {
      sends.push({
        to: validPayerPhone,
        message: buildPaybillPaymentReceiptSms({
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
      // Same fields as the log line above, mirrored into the DB — a live
      // 100% skip rate on this webhook (confirmed 2026-08-28: 25/25 real
      // collections over the prior 30 days) means this needs to be
      // queryable after the fact, not just visible in Render's live log
      // tail at the exact moment a payment lands.
      NcbaPhoneExtractionMiss.create({
        transId, merchantId: merchant._id, rawTransType, rawPhoneNr, rawCustomerName, rawNarrative,
      }).catch((e) => logEvent('error', 'ncba_phone_extraction_miss_log_failed', { transId, error: e.message }));
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

// @desc    Manually credit a real NCBA collection that never reached this
//          webhook — confirmed 2026-08-31 (Delamere Dairy Farm, KES 3,000
//          from Everlyn Owino Onyango, M-Pesa ref UHVCT58LFU): the money
//          landed on NCBA's own statement but this webhook never fired for
//          it, so the merchant was never credited and had no way to know.
//          Routes through the exact same ledger path handleNcbaAccountNotification
//          uses above (creditNcbaCollection — atomic session transaction,
//          auto fee-stamping, unique-reference dedup) plus the same
//          cross-feed/STK dedup guards, so this can never double-credit a
//          collection that actually did arrive through a normal path. Not a
//          general-purpose "adjust a balance" tool — bankRef becomes the
//          Transaction's reference and must be the real M-Pesa/NCBA
//          reference off the bank statement, so this stays traceable back
//          to a real, independently-verifiable bank event.
// @route   POST /admin/ncba-collections/manual-credit
// @access  Private (admin, requireMutator + sensitiveActionLimiter — a
//          direct, real-money ledger credit)
export const adminManualCreditNcbaCollection = async (req, res) => {
  try {
    const { merchantId, grossAmount, bankRef, customerName, date, time } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ error: 'A valid merchantId is required.' });
    }
    const amount = Number(grossAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'grossAmount must be a positive number.' });
    }
    const ref = String(bankRef || '').trim();
    if (!ref) {
      return res.status(400).json({ error: 'bankRef (the real M-Pesa/NCBA reference from the bank statement) is required.' });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const viaStk = await wasAlreadySettledByStkPush(merchant, amount);
    const viaOtherFeed = await wasAlreadyCreditedByOtherNcbaFeed(merchant, amount, ref);
    if (viaStk || viaOtherFeed) {
      return res.status(409).json({ error: 'This looks like it was already credited through another path (STK or a separate NCBA feed) — check the merchant\'s transaction history before crediting again.' });
    }

    let ledgerResult;
    try {
      ledgerResult = await creditNcbaCollection({
        merchant,
        grossAmount: amount,
        bankRef: ref,
        customerName: customerName ? String(customerName).trim() : null,
      });
    } catch (err) {
      if (err instanceof DuplicateCollectionError) {
        return res.status(409).json({ error: `Reference "${ref}" was already used for a transaction — this collection may already be credited.` });
      }
      throw err;
    }

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${ledgerResult.netAmount.toLocaleString()} via your PayChain Virtual Account. Ref: ${ref}.`,
    }).catch((e) => logEvent('error', 'ncba_manual_credit_notification_failed', { ref, error: e.message }));

    // date/time are the admin's own plain "YYYY-MM-DD"/"HH:mm" typed
    // values off the bank statement, treated as literal Nairobi wall-clock
    // (matching how every other NCBA/M-Pesa timestamp in this codebase is
    // handled — see transactionDateFormat.js's header comment) — NOT run
    // through a Date object, so this can't drift with server timezone.
    // Converted into NCBA's own YYMMDDhhmm wire format so it reuses that
    // same formatter other credits build their SMS from, rather than a
    // second date-formatting implementation.
    let smsDateTime;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '') && /^\d{2}:\d{2}$/.test(time || '')) {
      const ncbaFormat = `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}${time.slice(0, 2)}${time.slice(3, 5)}`;
      smsDateTime = formatTransactionDateTime(ncbaFormat);
    } else {
      smsDateTime = formatTransactionDateTime(null); // falls back to current Nairobi time
    }

    if (merchant.phone) {
      const sms = buildPaymentReceivedSms({
        ref,
        amount: ledgerResult.netAmount,
        payerName: customerName || null,
        payerPhone: null,
        date: smsDateTime.date,
        time: smsDateTime.time,
        balance: ledgerResult.merchant.kesBalance,
      });
      sendStaggeredSms([{ to: merchant.phone, message: sms.message }]).then((results) => {
        const result = results[0];
        if (result.success) logEvent('info', 'ncba_manual_credit_sms_sent', { ref, merchantId: merchant._id.toString(), messageId: result.messageId });
        else logEvent('error', 'ncba_manual_credit_sms_failed', { ref, merchantId: merchant._id.toString(), error: result.error });
      });
    }

    logAudit({
      action: 'admin.ncba_collection.manual_credit', category: 'wallet', severity: 'critical',
      message: `Manually credited a missed NCBA collection for ${merchant.businessName} — confirmed on NCBA's real statement (ref ${ref}) but this webhook never fired for it.`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { bankRef: ref, grossAmount: amount, netAmount: ledgerResult.netAmount, customerName: customerName || null, transactionId: ledgerResult.transaction._id.toString() },
    });

    // If this credit was raised by the reconciliation sweep, close out the
    // matching candidate so it stops showing as pending — matched by
    // reference, not just "any pending candidate for this merchant", so
    // crediting one candidate never accidentally closes a different one.
    MissedNcbaCollectionCandidate.findOneAndUpdate(
      { statementReference: ref, status: 'pending' },
      { $set: { status: 'credited', resolvedBy: req.admin._id, resolvedAt: new Date() } }
    ).catch((e) => logEvent('error', 'ncba_manual_credit_candidate_close_failed', { ref, error: e.message }));

    res.json({
      success: true,
      data: {
        transactionId: ledgerResult.transaction._id,
        reference: ledgerResult.transaction.reference,
        netAmount: ledgerResult.netAmount,
        newBalance: ledgerResult.merchant.kesBalance,
      },
    });
  } catch (err) {
    if (err instanceof NcbaTariffBoundsError) {
      return res.status(400).json({ error: err.message });
    }
    logEvent('error', 'ncba_manual_credit_error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to credit this collection.' });
  }
};

// @desc    List pending "missed collection" candidates —
//          services/ncbaCollectionReconciliationService.js's hourly sweep
//          flags a real NCBA statement credit here when it's confidently
//          attributed to a merchant but has no matching Transaction. Each
//          one is a real-money suggestion for adminManualCreditNcbaCollection
//          above to act on, never auto-applied.
// @route   GET /admin/ncba-collections/missed
// @access  Private (admin)
export const adminListMissedNcbaCollections = async (req, res) => {
  try {
    const candidates = await MissedNcbaCollectionCandidate.find({ status: 'pending' })
      .sort('-createdAt')
      .limit(200)
      .populate('matchedMerchantId', 'businessName phone ncbaMerchantCode');
    res.json({ success: true, data: candidates });
  } catch (err) {
    logEvent('error', 'admin_list_missed_ncba_collections_error', { error: err.message });
    res.status(500).json({ error: 'Failed to list missed collections' });
  }
};

// @desc    Dismiss a missed-collection candidate without crediting it — for
//          a false match, or one that turns out to already be accounted
//          for under a reference the sweep didn't recognize. Does not
//          touch any balance.
// @route   POST /admin/ncba-collections/missed/:id/dismiss
// @access  Private (admin, requireMutator)
export const adminDismissMissedNcbaCollection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const note = String(req.body?.note || '').trim() || null;
    const candidate = await MissedNcbaCollectionCandidate.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'dismissed', resolvedBy: req.admin._id, resolvedAt: new Date(), resolutionNote: note } },
      { returnDocument: 'after' }
    );
    if (!candidate) return res.status(404).json({ error: 'Candidate not found or already resolved.' });

    logAudit({
      action: 'admin.ncba_collection.candidate_dismissed', category: 'wallet', severity: 'warning',
      message: `Dismissed missed-collection candidate ${candidate.statementReference} without crediting${note ? `: ${note}` : ''}`,
      actor: adminActor(req.admin), req,
      metadata: { statementReference: candidate.statementReference, amount: candidate.amount, note },
    });
    res.json({ success: true });
  } catch (err) {
    logEvent('error', 'admin_dismiss_missed_ncba_collection_error', { error: err.message });
    res.status(500).json({ error: 'Failed to dismiss this candidate' });
  }
};
