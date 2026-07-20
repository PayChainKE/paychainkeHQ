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
    throw new NcbaOpenBankingAuthError('NCBA Open Banking is not fully configured (NCBA_OPENBANKING_USER_ID / _PASSWORD / _SUBSCRIPTION_KEY missing)');
  }

  try {
    const response = await axios.post(
      `${ncbaOpenBankingBaseUrl}/api/v1/Auth/generate-token`,
      { userID: ncbaOpenBankingUserId, password: ncbaOpenBankingPassword },
      {
        headers: {
          'Ocp-Apim-Subscription-Key': ncbaOpenBankingSubscriptionKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const { accessToken, tokenType } = response.data || {};
    if (!accessToken || !tokenType) {
      throw new NcbaOpenBankingAuthError('NCBA Open Banking token response missing accessToken/tokenType');
    }

    cachedToken = accessToken;
    cachedTokenType = tokenType;
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    logEvent('info', 'ncba_openbanking_token_refreshed', {});
    return { accessToken, tokenType };
  } catch (err) {
    if (err instanceof NcbaOpenBankingAuthError) throw err;
    logEvent('error', 'ncba_openbanking_token_fetch_failed', { error: unwrapAxiosError(err) });
    throw new NcbaOpenBankingAuthError(`Failed to obtain NCBA Open Banking access token: ${unwrapAxiosError(err)}`);
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
  const { accessToken, tokenType } = await getAccessToken();

  try {
    const response = await axios.post(`${ncbaOpenBankingBaseUrl}${path}`, body, {
      headers: {
        Authorization: `${tokenType} ${accessToken}`,
        'Ocp-Apim-Subscription-Key': ncbaOpenBankingSubscriptionKey,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401 && !retrying) {
      await getAccessToken({ forceRefresh: true });
      return ncbaOpenBankingPost(path, body, { retrying: true });
    }
    logEvent('error', 'ncba_openbanking_request_failed', { path, error: unwrapAxiosError(err) });
    throw new NcbaOpenBankingRequestError(unwrapAxiosError(err));
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
 * EFT transfer wrapper — implemented alongside PesaLink for completeness
 * (same shape, thin wrapper, same synchronous-response behaviour) but not
 * yet routed to by any payout business logic. PesaLink (real-time) covers
 * this phase's need; EFT (T+1, per the UAT Guide) is available for a future
 * amount-threshold decision.
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
