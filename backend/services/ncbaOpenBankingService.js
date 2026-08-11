import axios from 'axios';

// ── NCBA Open Banking configuration ────────────────────────────────────────
// Same "never derive from NODE_ENV" rule as ncbaBulkPaymentService.js /
// mpesaController.js — hosting platforms set NODE_ENV=production even on
// staging, which would otherwise silently point a demo deploy at NCBA's
// live rail.
//
// Base URL confirmed against NCBA's own "Open Banking UAT Guide" PDF
// (matches the credentials text file; the Postman collection's `baseUrl`
// variable disagreed and appears to just be stale).
const ncbaOpenBankingEnv = (process.env.NCBA_OPENBANKING_ENVIRONMENT || 'sandbox').toLowerCase();
const isLiveEnv = ncbaOpenBankingEnv === 'live';
const ncbaOpenBankingBaseUrl = isLiveEnv
  ? (process.env.NCBA_OPENBANKING_BASE_URL || 'https://api.ncbagroup.com')
  : (process.env.NCBA_OPENBANKING_SANDBOX_BASE_URL || 'https://openbankingtest.api.ncbagroup.com/test/apigateway');

const ncbaOpenBankingUserId         = process.env.NCBA_OPENBANKING_USER_ID;
const ncbaOpenBankingPassword       = process.env.NCBA_OPENBANKING_PASSWORD;
const ncbaOpenBankingSubscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const ncbaOpenBankingAccountNumber  = process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER;
// "Customer number – first 6 digits of the sender account number or any
// other assigned customer number as guided by NCBA" (UAT Guide). Required
// on PesaLink/EFT payment payloads, separate from the account number itself.
const ncbaOpenBankingSenderCif      = process.env.NCBA_OPENBANKING_SENDER_CIF;

// Per the UAT Guide's Payment Rules for both PesaLink and EFT: "Minimum
// payments of KES. 50 ... and a maximum of KES. 999,999".
const MIN_TRANSFER_AMOUNT = 50;
const MAX_TRANSFER_AMOUNT = 999999;

// Real network calls to NCBA (test or live) only happen when this is
// explicitly 'true' — everything else simulates, so the payout flow is
// fully exercisable offline before NCBA finishes IP whitelisting.
const liveCallsEnabled = process.env.NCBA_OPENBANKING_LIVE_ENABLED === 'true';

// Hakikisha/Airtel Money mobile-number validation path — a prerequisite for
// submitMobileB2wPayment below. Not shown in the UAT Guide's text (only its
// request/response JSON was) — confirmed instead from NCBA's own "Open
// Banking V2 - Callback Enabled" Postman collection (the /MpesaB2WValidation
// folder's saved request actually targets /MobileB2WValidation — the
// collection's own folder name is just stale/mismatched). Still
// env-overridable in case NCBA changes it.
const ncbaMobileWalletValidationPath = process.env.NCBA_MOBILE_WALLET_VALIDATION_PATH || '/api/v1/MobileB2WValidation/validate-account';

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

function unwrapAxiosError(err) {
  return err.response?.data ? JSON.stringify(err.response.data) : err.message;
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
  // Every real call funnels through here — validatePesaLinkAccount,
  // submitPesaLinkTransfer, and submitEftTransfer all end up needing
  // PayChain's own NCBA account number (as SenderAccountNumber/
  // DebitAccountNumber, or as the debitAccount fallback). Unlike
  // ncbaBulkPaymentService.js's equivalent check, this used to be missing
  // here — a blank value would silently ride along as `undefined` in the
  // request body instead of failing clearly before ever reaching NCBA.
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
      timeout: 20000,
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
      `Amount must be between KES ${MIN_TRANSFER_AMOUNT} and KES ${MAX_TRANSFER_AMOUNT.toLocaleString()} (NCBA PesaLink/EFT limits)`
    );
  }
}

/**
 * Confirms a destination bank account is real before money is sent to it —
 * catches typo'd account numbers before they cost a merchant a failed
 * transfer. Always attempted before submitPesaLinkTransfer.
 *
 * Per NCBA's UAT Guide, a resolvable-but-invalid account still comes back
 * as an HTTP 200 with StatusCode !== '00' (not an HTTP error) — so this
 * must inspect the body, not just catch network/HTTP failures.
 */
export async function validatePesaLinkAccount({ bankCode, accountNumber, debitAccount }) {
  if (!bankCode || !accountNumber) {
    throw new NcbaOpenBankingValidationError('bankCode and accountNumber are required to validate a PesaLink destination');
  }

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_pesalink_validate_sandbox', { bankCode, accountNumber });
  }

  const result = await ncbaOpenBankingPost('/api/v1/PesalinkValidation/validate-account', {
    targetPic: bankCode,
    accountToVerify: accountNumber,
    debitAccount: debitAccount || ncbaOpenBankingAccountNumber,
  });

  if (result?.StatusCode !== '00') {
    throw new NcbaOpenBankingValidationError(result?.StatusMessage || 'NCBA could not verify the destination bank account');
  }

  return result;
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
    throw new NcbaOpenBankingValidationError('NCBA could not find a PesaLink-registered bank for this mobile number');
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
 * Per NCBA's UAT Guide, PesaLink/EFT payments do NOT accept a callbackUrl —
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
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'NCBA rejected the PesaLink transfer');
  }
  return result;
}

/**
 * Submits an EFT transfer — NCBA's next-business-day local bank rail,
 * routed to from ncbaOpenBankingController.js#submitNcbaBankTransfer
 * whenever the caller picks rail: 'eft' instead of the default 'pesalink'.
 * Same request/response shape and amount bounds as PesaLink (per the UAT
 * Guide, both are KES 50–999,999) and also resolves synchronously — the
 * only real difference NCBA documents is settlement timing (PesaLink:
 * immediate, 24/7/365; EFT: T+1, business days only).
 */
export async function submitEftTransfer({
  transactionId,
  beneficiaryAccountNumber,
  beneficiaryBankCode,
  beneficiaryName,
  amount,
  narration,
  senderCountry = 'Kenya',
}) {
  if (!transactionId || !beneficiaryAccountNumber || !beneficiaryBankCode || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, beneficiaryAccountNumber, beneficiaryBankCode and amount are required for an EFT transfer');
  }
  assertTransferAmountInBounds(amount);

  const payload = {
    Amount: Number(amount).toFixed(2),
    BeneficiaryAccountNumber: beneficiaryAccountNumber,
    BeneficiaryBankBIC: beneficiaryBankCode,
    BeneficiaryName: beneficiaryName,
    Currency: 'KES',
    DebitAccountNumber: ncbaOpenBankingAccountNumber,
    Narration: narration || 'PayChain Payout',
    SenderCIF: ncbaOpenBankingSenderCif,
    SenderCountry: senderCountry,
    TransactionID: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_eft_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/EFTTransaction/efttransaction', payload);
  if (result?.resultCode !== '000') {
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'NCBA rejected the EFT transfer');
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
 * rail, distinct from PesaLink/EFT in three ways: BeneficiaryBankBIC here
 * is a real SWIFT BIC (not a "00"-prefixed CBK clearing code), it supports
 * KE/UG/TZ/RW beneficiaries in KES/USD/GBP/EUR/TZS/UGX/RWF (not KES-only,
 * Kenya-only), and it has no minimum-amount-bounded maximum (per the UAT
 * Guide: "Minimum payments of KES 50 ... with no maximum CAP" — so, unlike
 * PesaLink/EFT, assertTransferAmountInBounds is NOT applied here). No RTGS-
 * specific account-validation endpoint is documented anywhere in the UAT
 * Guide or Postman collection (unlike PesaLink/LNM/KPLC/NCWSC, which each
 * have one) — this is submit-only, no pre-flight validation call.
 *
 * Per the UAT Guide, RTGS resolves synchronously (T+3 hours is the bank's
 * own settlement window, not this API call — the resultCode IS the final
 * submission result, matching PesaLink/EFT's response shape, not the
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
    throw new NcbaOpenBankingValidationError(`Amount must be at least KES ${MIN_TRANSFER_AMOUNT} (NCBA RTGS minimum) — RTGS has no maximum cap`);
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
    throw new NcbaOpenBankingRequestError(result?.statusDescription || 'NCBA rejected the RTGS transfer');
  }
  return result;
}

/**
 * Validates a recipient's M-Pesa (Hakikisha) or Airtel Money number before a
 * Mobile B2W payout — required prerequisite per the UAT Guide, which
 * returns a validationId that must be echoed back on the actual payment.
 * Simulates whenever NCBA_OPENBANKING_LIVE_ENABLED is off, same as every
 * other function in this file.
 *
 * @param {object} params
 * @param {'safaricom'|'airtel'} params.provider
 * @param {string} params.msisdn - 254XXXXXXXXX
 * @returns {{ validationId: string, customerName: string }}
 */
export async function validateMobileWalletNumber({ provider, msisdn }) {
  if (!provider || !msisdn) {
    throw new NcbaOpenBankingValidationError('provider and msisdn are required to validate a mobile wallet number');
  }

  if (!liveCallsEnabled) {
    const result = simulate('ncba_openbanking_mobile_wallet_validate_sandbox', { provider, msisdn });
    return { validationId: `SIM-VALID-${Date.now()}`, customerName: null, ...result };
  }

  const result = await ncbaOpenBankingPost(ncbaMobileWalletValidationPath, { provider, msisdn });
  if (!result?.validationId) {
    throw new NcbaOpenBankingValidationError(result?.message || 'Could not validate the destination mobile number.');
  }

  return { validationId: result.validationId, customerName: result.customerName || null };
}

/**
 * Validates a KPLC (Kenya Power) postpaid account before a bill payment —
 * "This is a validation service to check the account/meter number validity
 * and confirm balance due" per the UAT Guide. Returns a validationId that
 * must be echoed back on the actual payment (same validate-then-pay shape
 * as validateMobileWalletNumber/validateLipaNaMpesaAccount above). Endpoint
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
  validationId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !validationId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, validationId, meterNumber and amount are required for a KPLC payment');
  }

  const payload = {
    validationId,
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
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'NCBA rejected the KPLC payment');
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
  validationId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !validationId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, validationId, meterNumber and amount are required for a KPLC prepaid token purchase');
  }

  const payload = {
    validationId,
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
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'NCBA rejected the KPLC prepaid token purchase');
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
  validationId,
  customerName,
  meterNumber,
  msisdn,
  amount,
  narration,
  debitAccount,
}) {
  if (!transactionId || !validationId || !meterNumber || !amount) {
    throw new NcbaOpenBankingValidationError('transactionId, validationId, meterNumber and amount are required for an NCWSC payment');
  }

  const payload = {
    validationId,
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
    throw new NcbaOpenBankingRequestError(result?.data?.message || result?.message || 'NCBA rejected the NCWSC payment');
  }
  return result;
}

/**
 * Validates a destination Paybill or Till number before a Lipa na M-Pesa
 * payout — "This is a prerequisite for Bill Payments" per the UAT Guide.
 * identifierType is "4" for Paybill, "2" for Till (per the UAT Guide's own
 * labeling). Endpoint confirmed from NCBA's "Open Banking V2 - Callback
 * Enabled" Postman collection — not shown as a path in the UAT Guide's own
 * text (only its request/response JSON was), same situation as
 * validateMobileWalletNumber above.
 *
 * @param {object} params
 * @param {'Paybill'|'Till'} params.paymentType
 * @param {string} params.payBillTillNo
 */
export async function validateLipaNaMpesaAccount({ paymentType, payBillTillNo }) {
  if (!paymentType || !payBillTillNo) {
    throw new NcbaOpenBankingValidationError('paymentType and payBillTillNo are required to validate a Paybill/Till destination');
  }

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_lnm_validate_sandbox', { paymentType, payBillTillNo });
  }

  const identifierType = paymentType === 'Till' ? '2' : '4';
  const result = await ncbaOpenBankingPost('/api/v1/LipaNaMpesaValidation/accountdetails', {
    identifier: payBillTillNo,
    identifierType,
  });

  if (result?.errorCode !== '000') {
    throw new NcbaOpenBankingValidationError(result?.errorMessage || 'NCBA could not verify the destination Paybill/Till number');
  }

  // origanizationShortCode is NCBA's own typo, kept exactly as documented.
  return { organizationName: result.OrganizationName || null, shortCode: result.origanizationShortCode || null };
}

/**
 * Submits a Lipa na M-Pesa payout to a third-party Paybill or Till number —
 * NCBA's direct replacement for Daraja B2B (BusinessPayBill/
 * BusinessBuyGoods). Response shape (hdrRefNo/hdrTranId/resErrorCode/
 * UnitId) matches NCBA's other "accepted into processing" rails (e.g. M-Pesa
 * Float Purchase, explicitly documented as a 24-hour service) rather than
 * PesaLink/EFT's synchronous resultCode shape, and the payload carries no
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
    throw new NcbaOpenBankingRequestError(result?.resErrorDesc || result?.resErrorMessage || 'NCBA rejected the Lipa na M-Pesa payment');
  }
  return result;
}

/**
 * Submits a Mobile B2W (Bank-to-Wallet) payout to an M-Pesa or Airtel Money
 * number — NCBA's direct replacement for Daraja B2C. Per the UAT Guide this
 * is an ASYNCHRONOUS rail: a `succeeded: true` response only means NCBA
 * accepted the instruction into its processing queue (same shape as the
 * doc's KPLC/Water/E-Citizen examples, all explicitly documented as
 * resolving via a later callback) — unlike submitPesaLinkTransfer/
 * submitEftTransfer above, which resolve synchronously. callbackUrl is left
 * blank (the doc marks it optional), matching how services/
 * ncbaBulkPaymentService.js's existing utility-payment calls already handle
 * this — NCBA posts back to whatever webhook was registered during
 * onboarding (the same /webhooks/ncba-openbanking-callback route this app
 * already exposes), not a per-request URL. channelRef/reqChnlId are set to
 * PayChain's own transactionId, so handlePesaLinkCallback (already generic
 * — see ncbaOpenBankingController.js) can match the eventual callback back
 * to this specific payout without any new webhook route.
 *
 * @param {object} params
 * @param {string} params.transactionId - PayChain's own reference; becomes
 *        both channelRef/reqChnlId here and Transaction.reference at the
 *        call site, so the eventual callback can find the pending row.
 * @param {string} params.validationId - from validateMobileWalletNumber
 * @param {'safaricom'|'airtel'} params.provider
 * @param {number} params.amount
 * @param {string} params.recipientNumber - 254XXXXXXXXX
 * @param {string} [params.senderNumber] - number to receive NCBA's own notification, optional
 * @param {string} [params.narration]
 */
export async function submitMobileB2wPayment({
  transactionId,
  validationId,
  provider,
  amount,
  recipientNumber,
  senderNumber,
  narration,
}) {
  if (!transactionId || !validationId || !provider || !amount || !recipientNumber) {
    throw new NcbaOpenBankingValidationError('transactionId, validationId, provider, amount and recipientNumber are required for a Mobile B2W payout');
  }

  const payload = {
    validationId,
    provider,
    amount: String(amount),
    debitAccount: ncbaOpenBankingAccountNumber,
    // UAT Guide's own field name for this ("receipientNumber") is a typo in
    // NCBA's spec — kept exactly as documented since it's what their API
    // actually expects.
    receipientNumber: recipientNumber,
    senderNumber: senderNumber || '',
    channelRef: transactionId,
    narration: narration || 'PayChain Payout',
    callbackUrl: '',
    reqChnlId: transactionId,
  };

  if (!liveCallsEnabled) {
    return simulate('ncba_openbanking_mobile_b2w_submit_sandbox', { transactionId, amount });
  }

  const result = await ncbaOpenBankingPost('/api/v1/MobileB2WPayment/mobileb2wpayment', payload);
  if (!result?.succeeded) {
    throw new NcbaOpenBankingRequestError(result?.message || 'The payout could not be completed. Please try again.');
  }
  return result;
}
