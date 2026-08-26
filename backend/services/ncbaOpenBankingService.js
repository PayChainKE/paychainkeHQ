import axios from 'axios';

// ── NCBA Open Banking configuration ────────────────────────────────────────
// Same "never derive from NODE_ENV" rule as ncbaBulkPaymentService.js /
// mpesaController.js — hosting platforms set NODE_ENV=production even on
// staging, which would otherwise silently point a demo deploy at NCBA's
// live rail.
//
// The SANDBOX URL below is confirmed against NCBA's own "Open Banking UAT
// Guide" doc (matches the credentials text file). The guide is explicitly
// scoped to UAT only ("...before eventual migration to prod") and never
// once states a live/production base URL anywhere in it, nor does any
// other doc in API documents/ — 'https://api.ncbagroup.com' below was
// never actually confirmed by NCBA; it doesn't even resolve via DNS
// (verified live: curl gets "Couldn't resolve host"), which is exactly
// why NCBA_OPENBANKING_ENVIRONMENT=live produces "Failed to obtain an
// Open Banking access token" — the request never reaches NCBA at all, let
// alone gets rejected. NCBA_OPENBANKING_BASE_URL is therefore a hard
// requirement once live, not an optional override with a safe guess to
// fall back to — see the throw below.
const ncbaOpenBankingEnv = (process.env.NCBA_OPENBANKING_ENVIRONMENT || 'sandbox').toLowerCase();
const isLiveEnv = ncbaOpenBankingEnv === 'live';
if (isLiveEnv && !process.env.NCBA_OPENBANKING_BASE_URL) {
  console.error(JSON.stringify({
    level: 'error',
    event: 'ncba_openbanking_live_base_url_missing',
    message: 'NCBA_OPENBANKING_ENVIRONMENT=live but NCBA_OPENBANKING_BASE_URL is unset — confirm the real live base URL with NCBA and set it; there is no safe default to fall back to.',
  }));
}
const ncbaOpenBankingBaseUrl = isLiveEnv
  ? process.env.NCBA_OPENBANKING_BASE_URL
  : (process.env.NCBA_OPENBANKING_SANDBOX_BASE_URL || 'https://openbankingtest.api.ncbagroup.com/test/apigateway');

const ncbaOpenBankingUserId         = process.env.NCBA_OPENBANKING_USER_ID;
const ncbaOpenBankingPassword       = process.env.NCBA_OPENBANKING_PASSWORD;
const ncbaOpenBankingSubscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const ncbaOpenBankingAccountNumber  = process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER;
// "Customer number – first 6 digits of the sender account number or any
// other assigned customer number as guided by NCBA" (UAT Guide). Required
// on PesaLink payment payloads, separate from the account number itself.
const ncbaOpenBankingSenderCif      = process.env.NCBA_OPENBANKING_SENDER_CIF;

// Per the UAT Guide's Payment Rules for PesaLink: "Minimum payments of
// KES. 50 ... and a maximum of KES. 999,999".
const MIN_TRANSFER_AMOUNT = 50;
const MAX_TRANSFER_AMOUNT = 999999;

// Per NCBA (Rose, email 2026-08-26) for MobileMoneyTransfer/Mobile B2W:
// "Process Bank to Wallet Payments to recipient's Mpesa numbers for amounts
// between KES. 50.00 – KES. 250,000.00 Per transaction."
const MOBILE_B2W_MIN_AMOUNT = 50;
const MOBILE_B2W_MAX_AMOUNT = 250000;

// Real network calls to NCBA (test or live) only happen when this is
// explicitly 'true' — everything else simulates, so the payout flow is
// fully exercisable offline before NCBA finishes IP whitelisting.
const liveCallsEnabled = process.env.NCBA_OPENBANKING_LIVE_ENABLED === 'true';

export class NcbaOpenBankingAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaOpenBankingAuthError';
  }
}

export class NcbaOpenBankingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaOpenBankingValidationError';
  }
}

export class NcbaOpenBankingRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaOpenBankingRequestError';
  }
}

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// err.message has been observed empty on Render for some network-level
// failures (e.g. an aggregate connection error) — a bare `err.message` gave
// zero signal when that happened (logged as ""). Always include status/
// code/name alongside it so a failure is diagnosable from the log alone.
function unwrapAxiosError(err) {
  const detail = {
    message: err.message || undefined,
    code: err.code,
    name: err.name,
    status: err.response?.status,
    statusText: err.response?.statusText,
    data: err.response?.data,
  };
  Object.keys(detail).forEach((k) => detail[k] === undefined && delete detail[k]);
  return JSON.stringify(detail);
}

// Module-scope token cache — NCBA's Auth/generate-token flow has no
// precedent elsewhere in this codebase (M-Pesa's `generateToken` re-fetches
// per-request as Express middleware, which isn't suitable here since Open
// Banking calls originate from a service module, not a route chain).
// NCBA's response doesn't document an expires_in field, so this uses a
// conservative fixed TTL and also force-refreshes reactively on a 401.
const TOKEN_TTL_MS = 15 * 60 * 1000;
let cachedToken = null;
let cachedTokenType = null;
let tokenExpiresAt = 0;

async function fetchNewToken() {
  if (!ncbaOpenBankingUserId || !ncbaOpenBankingPassword || !ncbaOpenBankingSubscriptionKey) {
    throw new NcbaOpenBankingAuthError('Open Banking is not fully configured. Please contact support.');
  }
  if (!ncbaOpenBankingBaseUrl) {
    // Distinct from the generic catch-all below on purpose — this fires
    // instantly, before any network call, so it's never confused with a
    // real NCBA-side rejection in the logs (see the module-load check above
    // for why there's no safe default to fall back to here).
    throw new NcbaOpenBankingAuthError('Open Banking live base URL is not configured. Please contact support.');
  }

  try {
    const response = await axios.post(
      `${ncbaOpenBankingBaseUrl}/api/v1/Auth/generate-token`,
      { userID: ncbaOpenBankingUserId, password: ncbaOpenBankingPassword },
      {
        headers: {
          'Ocp-Apim-Subscription-Key': ncbaOpenBankingSubscriptionKey,
          'Content-Type': 'application/json',
          // NCBA's gateway has been observed blocking axios's default
          // "axios/x.x.x" User-Agent with a generic WAF "Security Notice"
          // even from an already-whitelisted IP — a descriptive UA is a
          // common requirement for enterprise API gateways that reject
          // unidentified/library-default clients outright.
          'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
        },
        timeout: 15000,
      }
    );

    const { accessToken, tokenType } = response.data || {};
    if (!accessToken || !tokenType) {
      throw new NcbaOpenBankingAuthError('Open Banking token response was invalid.');
    }

    cachedToken = accessToken;
    cachedTokenType = tokenType;
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    logEvent('info', 'ncba_openbanking_token_refreshed', {});
    return { accessToken, tokenType };
  } catch (err) {
    if (err instanceof NcbaOpenBankingAuthError) throw err;
    // Full upstream error detail goes to the server log only — never bake a
    // raw upstream response body into a message that reaches the client.
    logEvent('error', 'ncba_openbanking_token_fetch_failed', { error: unwrapAxiosError(err) });
    throw new NcbaOpenBankingAuthError('Failed to obtain an Open Banking access token.');
  }
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return { accessToken: cachedToken, tokenType: cachedTokenType };
  }
  return fetchNewToken();
}

/**
 * Generic authenticated POST to NCBA's Open Banking REST API. Retries once
 * on a 401 with a forced token refresh (the token may have expired earlier
 * than our conservative local TTL assumes).
 */
async function ncbaOpenBankingPost(path, body, { retrying = false } = {}) {
  // Every real call funnels through here and ends up needing PayChain's own
  // NCBA account number (as SenderAccountNumber/DebitAccountNumber, or as
  // the debitAccount fallback). Unlike ncbaBulkPaymentService.js's
  // equivalent check, this used to be missing here — a blank value would
  // silently ride along as `undefined` in the request body instead of
  // failing clearly before ever reaching NCBA.
  if (!ncbaOpenBankingAccountNumber) {
    throw new NcbaOpenBankingAuthError('Open Banking is not fully configured. Please contact support.');
  }

  const { accessToken, tokenType } = await getAccessToken();

  try {
    const response = await axios.post(`${ncbaOpenBankingBaseUrl}${path}`, body, {
      headers: {
        Authorization: `${tokenType} ${accessToken}`,
        'Ocp-Apim-Subscription-Key': ncbaOpenBankingSubscriptionKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
      },
      // Widened from 20s after a live Mobile B2W payout timed out waiting on
      // NCBA's ack — no evidence it was actually slow vs. genuinely dropped,
      // but 20s was cutting it close for a gateway that's already known to
      // be slow/silent under load (see the reconciliation sweep in
      // ncbaOpenBankingReconciliationService.js for the async-callback side
      // of that same flakiness).
      timeout: 45000,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401 && !retrying) {
      await getAccessToken({ forceRefresh: true });
      return ncbaOpenBankingPost(path, body, { retrying: true });
    }
    // Full upstream error detail goes to the server log only — never bake a
    // raw upstream response body into a message that reaches the client.
    logEvent('error', 'ncba_openbanking_request_failed', { path, error: unwrapAxiosError(err) });
    throw new NcbaOpenBankingRequestError('Open Banking request failed. Please try again.');
  }
}

function simulate(event, payload) {
  logEvent('info', event, { simulated: true, ...payload });
  return { simulated: true };
}

function assertTransferAmountInBounds(amount) {
  const numeric = Number(amount);
  if (numeric < MIN_TRANSFER_AMOUNT || numeric > MAX_TRANSFER_AMOUNT) {
    throw new NcbaOpenBankingValidationError(
      `Amount must be between KES ${MIN_TRANSFER_AMOUNT} and KES ${MAX_TRANSFER_AMOUNT.toLocaleString()} (PesaLink limits)`
    );
  }
}

/**
 * Looks up which bank(s) a phone number is registered to on PesaLink —
 * lets a sender pay "to a phone number" without already knowing the
 * recipient's bank/account number, by resolving PesaLink's own registered
 * default bank for that number. Endpoint confirmed from NCBA's "Open
 * Banking V2 - Callback Enabled" Postman collection (not shown as a path
 * in the UAT Guide's own text, only its request/response JSON was — same
 * situation as every other validate call in this file).
 *
 * Response carries a `bankList` of every bank the number is registered
 * with (each with its own `sortCode`, usable directly as a PesaLink
 * BeneficiaryBankBIC), with `def: true` marking the one PesaLink treats as
 * the default. Not yet wired into any payout flow in this codebase — added
 * so it's available the next time a "pay by phone number" bank-transfer
 * flow is built, without needing to re-derive the request/response shape.
 *
 * @param {object} params
 * @param {string} params.phoneNumber - 254XXXXXXXXX
 * @param {string} [params.debitAccount] - defaults to PayChain's own NCBA account
 * @returns {{ destName: string, banks: Array<{ bankName: string, sortCode: string, isDefault: boolean, lookupBankName: string }> }}
 */
export async function validatePesaLinkMobileNumber({ phoneNumber, debitAccount }) {
  if (!phoneNumber) {
    throw new NcbaOpenBankingValidationError('phoneNumber is required to validate a PesaLink-registered mobile number');
  }

  if (!liveCallsEnabled) {
    const result = simulate('ncba_openbanking_pesalink_validate_phone_sandbox', { phoneNumber });
    return { destName: 'Simulated PesaLink Customer', banks: [{ bankName: 'NCBABANK', sortCode: '07000', isDefault: true, lookupBankName: 'Simulated PesaLink Customer' }], ...result };
  }

  const result = await ncbaOpenBankingPost('/api/v1/PesalinkValidation/validate-phone', {
    phoneNumber,
    debitAccount: debitAccount || ncbaOpenBankingAccountNumber,
  });

  const bankRows = result?.bankList?.bank;
  if (!result?.destName || !Array.isArray(bankRows) || bankRows.length === 0) {
    throw new NcbaOpenBankingValidationError('Could not find a PesaLink-registered bank for this mobile number');
  }

  return {
    destName: result.destName,
    banks: bankRows.map((b) => ({
      bankName: b.bankName,
      sortCode: b.sortCode,
      isDefault: !!b.def,
      lookupBankName: b.lookupBankName,
    })),
  };
}

/**
 * Submits a real-time PesaLink transfer.
 *
 * Per NCBA's UAT Guide, PesaLink payments do NOT accept a callbackUrl —
 * unlike the bill-pay/wallet endpoints (KPLC, water, KRA, mobile wallets),
 * these resolve synchronously: the response's resultCode/statusDescription
 * IS the final result, not just an "accepted" acknowledgement. This throws
 * NcbaOpenBankingRequestError on a non-'000' resultCode so callers' existing
 * catch-and-refund logic handles a synchronous rejection correctly.
 */
export async function submitPesaLinkTransfer({
  transactionId,
  beneficiaryAccountNumber,
  beneficiaryBankCode,
  beneficiaryName,
  amount,
  narration,
  senderCountry = 'Kenya',
}) {
  if (!transactionId || !beneficiaryAccountNumber || !beneficiaryBankCode || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, beneficiaryAccountNumber, beneficiaryBankCode and amount are required for a PesaLink transfer');
  }
  assertTransferAmountInBounds(amount);

  const payload = {
    BeneficiaryAccountNumber: beneficiaryAccountNumber,
    BeneficiaryBankBIC: beneficiaryBankCode,
    BeneficiaryName: beneficiaryName,
    Amount: Number(amount).toFixed(2),
    Currency: 'KES',
    Narration: narration || 'PayChain Payout',
    SenderAccountNumber: ncbaOpenBankingAccountNumber,
    SenderCIF: ncbaOpenBankingSenderCif,
    SenderCountry: senderCountry,
    TransactionID: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_pesalink_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/PesaLinkTransaction/pesaLinktransaction', payload);
  if (result?.resultCode !== '000') {
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'This PesaLink transfer was rejected');
  }
  return result;
}

/**
 * Submits an Internal Funds Transfer — NCBA's own "Transfers to NCBA
 * Accounts" rail, for when the destination account is itself at NCBA
 * (BeneficiaryBankBIC '07000'). Confirmed endpoint from NCBA's "Open
 * Banking V2 - Callback Enabled" Postman collection (not given as a path
 * in the UAT Guide's own text, only its request/response JSON was — same
 * situation as several other calls in this file).
 *
 * This must NOT go through submitPesaLinkTransfer —
 * PesaLink is the interbank switch, and NCBA's own account-to-account
 * transfers routed through it come back with a hard decline (observed
 * live: StatusCode/reason "RC01" on a real, correct NCBA account number).
 * IFT is the documented same-bank rail and resolves synchronously like
 * PesaLink (resultCode/statusDescription IS the final result).
 */
export async function submitInternalNcbaTransfer({
  transactionId,
  beneficiaryAccountNumber,
  beneficiaryAccountName,
  amount,
  narration,
  country = 'Kenya',
}) {
  if (!transactionId || !beneficiaryAccountNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, beneficiaryAccountNumber and amount are required for an internal NCBA transfer');
  }
  assertTransferAmountInBounds(amount);

  const payload = {
    Country: country,
    TransactionID: transactionId,
    BeneficiaryAccountName: beneficiaryAccountName || 'PayChain Payout',
    DebitAccountNumber: ncbaOpenBankingAccountNumber,
    CreditAccountNumber: beneficiaryAccountNumber,
    Currency: 'KES',
    Amount: Number(amount).toFixed(2),
    Narration: narration || 'PayChain Payout',
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_ift_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/IFTTransaction/ifttransaction', payload);
  if (result?.resultCode !== '000') {
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'This transfer to NCBA account was rejected');
  }
  return result;
}

// NCBA's own sample requests (both the plain and IMT RTGS Postman examples)
// use "MSC" as PurposeCode — the UAT Guide itself says the full code list
// is "to be shared during onboarding", so this is the one confirmed-valid
// value available until that list arrives. Used only as a fallback default
// — always pass a real purposeCode once NCBA supplies the actual list.
const RTGS_DEFAULT_PURPOSE_CODE = 'MSC';

/**
 * Submits an RTGS transfer — NCBA's cross-border/multi-currency local bank
 * rail, distinct from PesaLink in three ways: BeneficiaryBankBIC here
 * is a real SWIFT BIC (not a "00"-prefixed CBK clearing code), it supports
 * KE/UG/TZ/RW beneficiaries in KES/USD/GBP/EUR/TZS/UGX/RWF (not KES-only,
 * Kenya-only), and it has no minimum-amount-bounded maximum (per the UAT
 * Guide: "Minimum payments of KES 50 ... with no maximum CAP" — so, unlike
 * PesaLink, assertTransferAmountInBounds is NOT applied here). No RTGS-
 * specific account-validation endpoint is documented anywhere in the UAT
 * Guide or Postman collection (unlike PesaLink/LNM/KPLC/NCWSC, which each
 * have one) — this is submit-only, no pre-flight validation call.
 *
 * Per the UAT Guide, RTGS resolves synchronously (T+3 hours is the bank's
 * own settlement window, not this API call — the resultCode IS the final
 * submission result, matching PesaLink's response shape, not the
 * "accepted into processing" shape of the async rails).
 *
 * @param {object} params
 * @param {string} params.transactionId
 * @param {string} params.beneficiaryAccountNumber
 * @param {string} params.beneficiaryBankBic - real SWIFT BIC, not a CBK clearing code
 * @param {string} params.beneficiaryName
 * @param {string} params.beneficiaryCountry - KE/UG/TZ/RW
 * @param {string} [params.beneficiaryAddress]
 * @param {number} params.amount
 * @param {string} [params.creditCurrency='KES'] - KES/USD/GBP/EUR/TZS/UGX/RWF
 * @param {string} [params.debitCurrency='KES']
 * @param {string} [params.narration]
 * @param {string} [params.purposeCode] - defaults to RTGS_DEFAULT_PURPOSE_CODE
 * @param {string} [params.senderCountry='KE']
 */
export async function submitRtgsTransfer({
  transactionId,
  beneficiaryAccountNumber,
  beneficiaryBankBic,
  beneficiaryName,
  beneficiaryCountry,
  beneficiaryAddress,
  amount,
  creditCurrency = 'KES',
  debitCurrency = 'KES',
  narration,
  purposeCode,
  senderCountry = 'KE',
}) {
  if (!transactionId || !beneficiaryAccountNumber || !beneficiaryBankBic || !beneficiaryCountry || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, beneficiaryAccountNumber, beneficiaryBankBic, beneficiaryCountry and amount are required for an RTGS transfer');
  }
  if (Number(amount) < MIN_TRANSFER_AMOUNT) {
    throw new NcbaOpenBankingValidationError(`Amount must be at least KES ${MIN_TRANSFER_AMOUNT} (RTGS minimum) — RTGS has no maximum cap`);
  }

  const payload = {
    BeneficiaryAccountNumber: beneficiaryAccountNumber,
    BeneficiaryBankBIC: beneficiaryBankBic,
    BeneficiaryCountry: beneficiaryCountry,
    BeneficiaryName: beneficiaryName,
    BeneficiaryAddress: beneficiaryAddress || '',
    CreditAmount: Math.round(Number(amount)).toFixed(2),
    DebitCurrency: debitCurrency,
    CreditCurrency: creditCurrency,
    Narration: narration || 'PayChain Payout',
    SenderAccountNumber: ncbaOpenBankingAccountNumber,
    SenderCIF: ncbaOpenBankingSenderCif,
    SenderCountry: senderCountry,
    PurposeCode: purposeCode || RTGS_DEFAULT_PURPOSE_CODE,
    TransactionID: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_rtgs_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/RTGSPayment/RTGSPayment', payload);
  if (result?.resultCode !== '000') {
    // RTGS has no documented pre-flight validation endpoint (see this
    // function's own doc comment / submitNcbaBankTransfer's), so this
    // rejection is the *only* point a bad beneficiary detail, a currency/
    // country the deployment doesn't support, or a genuine credential/shape
    // issue would ever surface — same "log the raw response so a rejection
    // is diagnosable" reasoning as the LNM and Hakikisha validators above.
    logEvent('warn', 'ncba_openbanking_rtgs_submit_rejected', { transactionId, beneficiaryCountry, creditCurrency, response: result });
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'This RTGS transfer was rejected');
  }
  return result;
}

/**
 * Validates a KPLC (Kenya Power) postpaid account before a bill payment —
 * "This is a validation service to check the account/meter number validity
 * and confirm balance due" per the UAT Guide. Returns a validationId that
 * must be echoed back if reused elsewhere — submitKplcPayment itself no
 * longer requires it (see that function's own comment). Endpoint
 * confirmed from NCBA's "Open Banking V2 - Callback Enabled" Postman
 * collection (not shown as a path in the UAT Guide's own text, only its
 * request/response JSON was — same situation as the other validate calls
 * in this file).
 *
 * @param {object} params
 * @param {string} params.meterNumber - numeric KPLC meter number
 * @param {string} params.msisdn - phone number under the bill, 254XXXXXXXXX
 */
export async function validateKplcAccount({ meterNumber, msisdn }) {
  if (!meterNumber || !msisdn) {
    throw new NcbaOpenBankingValidationError('meterNumber and msisdn are required to validate a KPLC account');
  }

  if (!liveCallsEnabled) {
    const result = simulate('ncba_openbanking_kplc_validate_sandbox', { meterNumber, msisdn });
    return { validationId: `SIM-VALID-${Date.now()}`, meterNumber, customerName: 'Simulated KPLC Customer', serviceName: 'Kplc Postpaid', balance: 0, ...result };
  }

  const result = await ncbaOpenBankingPost('/api/v1/KPLCValidation/kplcvalidation', { meterNumber, msisdn });
  if (!result?.succeeded || !result?.validationId) {
    throw new NcbaOpenBankingValidationError(result?.message || 'Could not verify this KPLC meter number');
  }

  return {
    validationId: result.validationId,
    meterNumber: result.meterNumber || meterNumber,
    customerName: result.customerName || null,
    serviceName: result.serviceName || null,
    balance: typeof result.balance === 'number' ? result.balance : null,
  };
}

/**
 * Submits a KPLC postpaid bill payment — NCBA's Open Banking KPLC rail,
 * distinct from (and more specific than) the generic BILLPAY payload used
 * by services/ncbaBulkPaymentService.js's Host-to-Host bulk channel. Per
 * the UAT Guide's own Payment Rules ("Payments processed with generated
 * validation ID only"), a fresh validationId from validateKplcAccount is
 * required on every payment — callers should validate immediately before
 * submitting, not reuse an old validationId (same pattern already used for
 * Mobile B2W/Lipa na M-Pesa in bulkPayController.js).
 *
 * Response shape (`data.id`/`data.bankRef`/`succeeded`) matches NCBA's
 * other "accepted into processing" rails (Mobile B2W, Lipa na M-Pesa) —
 * `succeeded: true` only means NCBA accepted the instruction, not that the
 * bill is paid yet. Callers should record the resulting Transaction as
 * 'pending' and let the generic handlePesaLinkCallback
 * (ncbaOpenBankingController.js) resolve it later, keyed by reqChnlId.
 *
 * @param {object} params
 * @param {string} params.transactionId - PayChain's own reference; becomes
 *        both channelRef/reqChnlId here and Transaction.reference at the
 *        call site.
 * @param {string} params.validationId - from validateKplcAccount
 * @param {string} params.customerName - meter holder name
 * @param {string} params.meterNumber
 * @param {string} params.msisdn - mobile number for notifications
 * @param {number} params.amount
 * @param {string} [params.narration]
 * @param {string} [params.debitAccount] - defaults to PayChain's own NCBA account
 */
export async function submitKplcPayment({
  transactionId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, meterNumber and amount are required for a KPLC payment');
  }

  // No pre-payment meter validation — KPLCValidation is one of the NCBA
  // validation endpoints that's been blocking real payouts platform-wide,
  // so this goes straight to submission; validationId is left blank.
  const payload = {
    validationId: '',
    customerName: customerName || 'PayChain Merchant',
    meterNumber,
    msisdn: msisdn || '',
    channelRef: transactionId,
    amount: String(amount),
    callbackUrl: '',
    reason: narration || 'KPLC PAYMENT',
    accountNumber: debitAccount || ncbaOpenBankingAccountNumber,
    reqChnlId: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_kplc_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/KPLCPayment/kplcpayment', payload);
  if (!result?.succeeded) {
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'This KPLC payment was rejected');
  }
  return result;
}

/**
 * Validates a KPLC PREPAID meter — a genuinely different NCBA product from
 * validateKplcAccount above (which is postpaid-only): same request/response
 * shape, but resolves to a different account type ("Kplc Prepaid" vs "Kplc
 * Postpaid" in serviceName) and the amount paid on the follow-up purchase
 * is a token amount, not a bill balance. Kept as a distinct pair of
 * functions (not a `type` flag on the postpaid ones) since NCBA itself
 * treats them as separate endpoints/products.
 *
 * @param {object} params
 * @param {string} params.meterNumber
 * @param {string} params.msisdn - mobile number to receive the token, 254XXXXXXXXX
 */
export async function validateKplcPrepaidAccount({ meterNumber, msisdn }) {
  if (!meterNumber || !msisdn) {
    throw new NcbaOpenBankingValidationError('meterNumber and msisdn are required to validate a KPLC prepaid account');
  }

  if (!liveCallsEnabled) {
    const result = simulate('ncba_openbanking_kplc_prepaid_validate_sandbox', { meterNumber, msisdn });
    return { validationId: `SIM-VALID-${Date.now()}`, meterNumber, customerName: 'Simulated KPLC Prepaid Customer', serviceName: 'Kplc Prepaid', balance: 0, ...result };
  }

  const result = await ncbaOpenBankingPost('/api/v1/KPLCPrepaidValidation/kplcPrepaidValidation', { meterNumber, msisdn });
  if (!result?.succeeded || !result?.validationId) {
    throw new NcbaOpenBankingValidationError(result?.message || 'Could not verify this KPLC prepaid meter number');
  }

  return {
    validationId: result.validationId,
    meterNumber: result.meterNumber || meterNumber,
    customerName: result.customerName || null,
    serviceName: result.serviceName || null,
    balance: typeof result.balance === 'number' ? result.balance : null,
  };
}

/**
 * Purchases a KPLC prepaid token — sends the token to msisdn via SMS from
 * KPLC's side (not something PayChain generates or displays), same
 * "accepted into processing" async shape as submitKplcPayment. `amount`
 * here is the token purchase amount, not a bill balance being paid down.
 *
 * @param {object} params
 * @param {string} params.transactionId - becomes channelRef/reqChnlId and Transaction.reference
 * @param {string} params.validationId - from validateKplcPrepaidAccount
 * @param {string} params.customerName
 * @param {string} params.meterNumber
 * @param {string} params.msisdn - mobile number to receive the token
 * @param {number} params.amount - token purchase amount
 * @param {string} [params.narration]
 * @param {string} [params.debitAccount] - defaults to PayChain's own NCBA account
 */
export async function submitKplcPrepaidPayment({
  transactionId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, meterNumber and amount are required for a KPLC prepaid token purchase');
  }

  // See submitKplcPayment's comment above — same situation.
  const payload = {
    validationId: '',
    customerName: customerName || 'PayChain Merchant',
    meterNumber,
    msisdn: msisdn || '',
    channelRef: transactionId,
    amount: String(amount),
    reason: narration || 'KPLC PAYMENT',
    accountNumber: debitAccount || ncbaOpenBankingAccountNumber,
    callbackUrl: '',
    reqChnlId: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_kplc_prepaid_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/KPLCPrepaidTransaction/kplcPrepaidTransaction', payload);
  if (!result?.succeeded) {
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'This KPLC prepaid token purchase was rejected');
  }
  return result;
}

/**
 * Validates a Nairobi City Water & Sewerage Company (NCWSC) account before a
 * bill payment — same validate-then-pay shape as validateKplcAccount, just
 * a different biller. Endpoints confirmed from NCBA's "Open Banking V2 -
 * Callback Enabled" Postman collection, which spells the biller "NSWC"/
 * "NWSC" in its own path segments (inconsistent with the "NCWSC" name NCBA
 * uses in prose) — kept exactly as documented since that's what NCBA's
 * gateway actually routes on.
 *
 * @param {object} params
 * @param {string} params.meterNumber - numeric NCWSC meter number
 * @param {string} params.msisdn - phone number under the bill, 254XXXXXXXXX
 */
export async function validateNcwscAccount({ meterNumber, msisdn }) {
  if (!meterNumber || !msisdn) {
    throw new NcbaOpenBankingValidationError('meterNumber and msisdn are required to validate an NCWSC account');
  }

  if (!liveCallsEnabled) {
    const result = simulate('ncba_openbanking_ncwsc_validate_sandbox', { meterNumber, msisdn });
    return { validationId: `SIM-VALID-${Date.now()}`, meterNumber, customerName: 'Simulated NCWSC Customer', serviceName: 'Nairobi Water', balance: 0, ...result };
  }

  const result = await ncbaOpenBankingPost('/api/v1/NSWCValidation/nairobiwatervalidation', { meterNumber, msisdn });
  if (!result?.succeeded || !result?.validationId) {
    throw new NcbaOpenBankingValidationError(result?.message || 'Could not verify this NCWSC meter number');
  }

  return {
    validationId: result.validationId,
    meterNumber: result.meterNumber || meterNumber,
    customerName: result.customerName || null,
    serviceName: result.serviceName || null,
    balance: typeof result.balance === 'number' ? result.balance : null,
  };
}

/**
 * Submits a Nairobi Water (NCWSC) bill payment — NCBA's Open Banking NWSC
 * rail. Same "accepted into processing, confirmed later via callback"
 * shape as submitKplcPayment — see that function's doc comment. A fresh
 * validationId from validateNcwscAccount is required on every payment,
 * same reasoning as KPLC.
 *
 * NCBA's own saved Postman example for this endpoint doesn't include a
 * reqChnlId field (only channelRef) — included here anyway for
 * consistency with every other async NCBA rail in this file, since an
 * extra unrecognized field costs nothing and every other rail's actual
 * callback resolution (already proven working for Mobile B2W/Lipa na
 * M-Pesa/KPLC) keys off whatever reference handlePesaLinkCallback
 * receives, not a specific request-payload field name.
 *
 * @param {object} params
 * @param {string} params.transactionId - PayChain's own reference; becomes
 *        channelRef/reqChnlId here and Transaction.reference at the call site.
 * @param {string} params.validationId - from validateNcwscAccount
 * @param {string} params.customerName - meter holder name
 * @param {string} params.meterNumber
 * @param {string} params.msisdn - mobile number for notifications
 * @param {number} params.amount
 * @param {string} [params.narration]
 * @param {string} [params.debitAccount] - defaults to PayChain's own NCBA account
 */
export async function submitNcwscPayment({
  transactionId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, meterNumber and amount are required for an NCWSC payment');
  }

  // Same NCBA validation-not-ready situation as KPLC above — no
  // pre-payment meter validation here either.
  const payload = {
    validationId: '',
    customerName: customerName || 'PayChain Merchant',
    meterNumber,
    msisdn: msisdn || '',
    channelRef: transactionId,
    amount: String(amount),
    callbackUrl: '',
    reason: narration || 'NW PAYMENT REQUEST',
    accountNumber: debitAccount || ncbaOpenBankingAccountNumber,
    reqChnlId: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_ncwsc_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/NWSCPayment/NWSCPayment', payload);
  if (!result?.succeeded) {
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'This NCWSC payment was rejected');
  }
  return result;
}

/**
 * Submits a Lipa na M-Pesa payout to a third-party Paybill or Till number —
 * NCBA's direct replacement for Daraja B2B (BusinessPayBill/
 * BusinessBuyGoods). Response shape (hdrRefNo/hdrTranId/resErrorCode/
 * UnitId) matches NCBA's other "accepted into processing" rails (e.g. M-Pesa
 * Float Purchase, explicitly documented as a 24-hour service) rather than
 * PesaLink's synchronous resultCode shape, and the payload carries no
 * callbackUrl field to opt out of that — so this is treated as ASYNCHRONOUS,
 * same as submitMobileB2wPayment/BILLPAY: an immediate resErrorCode: '000'
 * only means NCBA accepted the instruction, not that it settled. Callers
 * should record the resulting Transaction as 'pending' and let the generic
 * handlePesaLinkCallback (ncbaOpenBankingController.js) resolve it later,
 * keyed by reqChnlId.
 *
 * @param {object} params
 * @param {string} params.transactionId - PayChain's own reference; becomes
 *        reqChnlId here and Transaction.reference at the call site.
 * @param {'Paybill'|'Till'} params.paymentType
 * @param {string} params.payBillTillNo
 * @param {number} params.amount
 * @param {string} [params.accountReference] - Paybill account number; not applicable to Till.
 * @param {string} [params.recipientName]
 * @param {string} [params.notifyMobileNumber]
 * @param {string} [params.narration]
 */
export async function submitLipaNaMpesaPayment({
  transactionId,
  paymentType,
  payBillTillNo,
  amount,
  accountReference,
  recipientName,
  notifyMobileNumber,
  narration,
}) {
  if (!transactionId || !paymentType || !payBillTillNo || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, paymentType, payBillTillNo and amount are required for a Lipa na M-Pesa payment');
  }

  const payload = {
    reqTransactionReferenceNo: transactionId,
    reqPaymentType: paymentType,
    reqPayBillTillNo: payBillTillNo,
    DebitAccountNumber: ncbaOpenBankingAccountNumber,
    DebitAmount: String(amount),
    reqCreditAmount: String(amount),
    reqDebitAcCurrency: 'KES',
    reqToAccountName: recipientName || 'PayChain Merchant',
    reqMobileNumber: notifyMobileNumber || '',
    reqPaymentDescription: narration || 'PayChain Payout',
    reqPaybillAccount: accountReference || '',
    Country: 'KENYA',
    reqChnlId: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_lnm_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/LipaNaMpesa/lipanampesa', payload);
  if (result?.resErrorCode !== '000') {
    throw new NcbaOpenBankingRequestError(result?.resErrorDesc || result?.resErrorMessage || 'This Lipa na M-Pesa payment was rejected');
  }
  return result;
}

/**
 * Submits a Bank-to-Wallet payout to an M-Pesa number — NCBA's
 * MobileMoneyTransfer rail. This replaces the old MobileB2WPayment +
 * MobileB2WValidation pair entirely: Rose (NCBA) sent this exact
 * endpoint/payload directly via email 2026-08-26 as the working
 * replacement, after MobileB2WValidation was confirmed 404ing in
 * production. Unlike the old pair, NCBA's own spec for this endpoint has no
 * validate-then-pay step — this is the only call needed.
 *
 * Per NCBA's email this only covers KES 50.00–KES 250,000.00 per
 * transaction, and is scoped to "recipient's Mpesa numbers" — NCBA hasn't
 * given an equivalent for Airtel Money, so an Airtel-destined payout will
 * still be attempted through this same call (there is no other rail) and
 * NCBA is expected to reject it cleanly (surfaces as a normal
 * NcbaOpenBankingRequestError below, refunded by the caller like any other
 * rejection) rather than misroute it.
 *
 * Async rail, same as every other bill/wallet payout in this file — a
 * `succeeded: true` response only means NCBA accepted the transfer, not
 * that it landed; resolves later via the callback/reconciliation sweep
 * (handlePesaLinkCallback/ncbaOpenBankingReconciliationService.js).
 * uniqueReferenceNumber is set to PayChain's own transactionId so that
 * resolution can match it back to Transaction.reference, same convention
 * as channelRef/reqChnlId on every other rail in this file.
 *
 * @param {object} params
 * @param {string} params.transactionId - PayChain's own reference; sent as
 *        uniqueReferenceNumber here and stored as Transaction.reference at
 *        the call site.
 * @param {string} params.beneficiaryName
 * @param {number} params.amount
 * @param {string} params.recipientNumber - 254XXXXXXXXX
 * @param {string} [params.narration]
 * @param {string} [params.debitAccount] - defaults to PayChain's own NCBA account
 */
export async function submitMobileB2wPayment({
  transactionId,
  beneficiaryName,
  amount,
  recipientNumber,
  narration,
  debitAccount,
}) {
  if (!transactionId || !beneficiaryName || !amount || !recipientNumber) {
    throw new NcbaOpenBankingValidationError('transactionId, beneficiaryName, amount and recipientNumber are required for a Mobile Money payout');
  }
  const numericAmount = Number(amount);
  if (!(numericAmount >= MOBILE_B2W_MIN_AMOUNT && numericAmount <= MOBILE_B2W_MAX_AMOUNT)) {
    throw new NcbaOpenBankingValidationError(
      `Amount must be between KES ${MOBILE_B2W_MIN_AMOUNT} and KES ${MOBILE_B2W_MAX_AMOUNT.toLocaleString()} (NCBA Mobile Money Transfer limits)`
    );
  }

  const payload = {
    beneficiaryName,
    date: new Date().toISOString().slice(0, 10),
    debitAccount: debitAccount || ncbaOpenBankingAccountNumber,
    debitAmount: numericAmount.toFixed(2),
    mobileNumber: recipientNumber,
    transactionNarration: narration || 'PayChain Payout',
    uniqueReferenceNumber: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_mobile_b2w_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/MobileMoneyTransfer/mobilemoneytransfer', payload);
  // A live test (2026-08-26) confirmed the recipient was actually paid by
  // NCBA on a call where result?.succeeded was falsy — Rose's documented
  // response shape (top-level `succeeded: true`) doesn't match what this
  // endpoint actually returns live, same doc/reality mismatch already seen
  // elsewhere in this file (see validateLipaNaMpesaAccount's history).
  // Checks every plausible success signal instead of trusting one field,
  // and always logs the full raw response on rejection so the real shape
  // is visible in Render logs — critical since a false negative here means
  // callers refund a payout that actually already landed.
  const succeeded =
    result?.succeeded === true ||
    result?.data?.succeeded === true ||
    String(result?.message || '').toUpperCase() === 'SUCCESS' ||
    String(result?.data?.message || '').toUpperCase() === 'SUCCESS';
  if (!succeeded) {
    logEvent('warn', 'ncba_openbanking_mobile_b2w_submit_rejected', { transactionId, response: result });
    throw new NcbaOpenBankingRequestError(result?.message || result?.data?.message || 'The payout could not be completed. Please try again.');
  }
  return result;
}
