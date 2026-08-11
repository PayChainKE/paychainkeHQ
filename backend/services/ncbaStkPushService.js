import axios from 'axios';

// ── NCBA STK Push configuration ─────────────────────────────────────────────
// Separate host and credentials from services/ncbaOpenBankingService.js —
// NCBA's STK Push & Dynamic QR Code API (used for customer collections via
// PayChain's dedicated NCBA Till short code, issued by NCBA on 2026-08-11)
// runs on c2bapis.ncbagroup.com, not the Open Banking gateway. Per Rose
// Soy's onboarding email, the Open Banking UAT userID/password work against
// this host too, so NCBA_STK_USERNAME/_PASSWORD fall back to the Open
// Banking credentials when left unset.
const ncbaStkBaseUrl = (process.env.NCBA_STK_BASE_URL || 'https://c2bapis.ncbagroup.com').replace(/\/$/, '');
const ncbaStkUsername = process.env.NCBA_STK_USERNAME || process.env.NCBA_OPENBANKING_USER_ID;
const ncbaStkPassword = process.env.NCBA_STK_PASSWORD || process.env.NCBA_OPENBANKING_PASSWORD;
export const NCBA_STK_PAYBILL = process.env.NCBA_STK_PAYBILL || '889066';

// Real network calls to NCBA (UAT or live) only happen when this is
// explicitly 'true' — mirrors ncbaOpenBankingService.js's liveCallsEnabled,
// so the STK flow is fully exercisable offline before NCBA credentials/IP
// whitelisting are confirmed.
const liveCallsEnabled = process.env.NCBA_STK_LIVE_ENABLED === 'true';

export class NcbaStkAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaStkAuthError';
  }
}

export class NcbaStkRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaStkRequestError';
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

function simulate(event, payload) {
  logEvent('info', event, { simulated: true, ...payload });
  return { simulated: true };
}

// Module-scope token cache, same shape as ncbaOpenBankingService.js's.
// NCBA's response includes expires_in (seconds) here, unlike Open Banking's
// token endpoint — used directly when present, with a conservative fallback.
const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;
let cachedToken = null;
let tokenExpiresAt = 0;

async function fetchNewToken() {
  if (!ncbaStkUsername || !ncbaStkPassword) {
    throw new NcbaStkAuthError('STK Push is not fully configured. Please contact support.');
  }

  try {
    // Per the STK Push section of NCBA's spec this is a GET with Basic auth
    // (the doc's QR Code section shows POST for the identical path — a
    // contradiction within NCBA's own document; GET is what's implemented
    // here since STK is what this integration needs. If UAT rejects it,
    // try POST instead).
    const response = await axios.get(`${ncbaStkBaseUrl}/payments/api/v1/auth/token`, {
      auth: { username: ncbaStkUsername, password: ncbaStkPassword },
      // See the identical comment in ncbaOpenBankingService.js — NCBA's
      // gateway has been observed blocking axios's default User-Agent
      // outright, even from an already-whitelisted IP.
      headers: { 'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)' },
      timeout: 15000,
    });

    const { access_token: accessToken, expires_in: expiresIn } = response.data || {};
    if (!accessToken) {
      throw new NcbaStkAuthError('STK token response was invalid.');
    }

    cachedToken = accessToken;
    tokenExpiresAt = Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : DEFAULT_TOKEN_TTL_MS);
    logEvent('info', 'ncba_stk_token_refreshed', {});
    return accessToken;
  } catch (err) {
    if (err instanceof NcbaStkAuthError) throw err;
    // Full upstream error detail goes to the server log only — never bake
    // a raw upstream response body into a message that reaches the client
    // (see the identical fix in ncbaOpenBankingService.js's fetchNewToken).
    logEvent('error', 'ncba_stk_token_fetch_failed', { error: unwrapAxiosError(err) });
    throw new NcbaStkAuthError('Failed to obtain an STK Push access token.');
  }
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return fetchNewToken();
}

async function ncbaStkPost(path, body, { retrying = false } = {}) {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(`${ncbaStkBaseUrl}${path}`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
      },
      timeout: 20000,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401 && !retrying) {
      await getAccessToken({ forceRefresh: true });
      return ncbaStkPost(path, body, { retrying: true });
    }
    // Full upstream error detail goes to the server log only — never bake a
    // raw upstream response body into a message that reaches the client.
    logEvent('error', 'ncba_stk_request_failed', { path, error: unwrapAxiosError(err) });
    throw new NcbaStkRequestError('STK Push request failed. Please try again.');
  }
}

/**
 * Sends an STK Push prompt to a customer's phone via PayChain's NCBA Till
 * short code (NCBA_STK_PAYBILL — NCBA's STK API still names this field
 * PayBillNo even though it's a Till). A response with TransactionID === null
 * means NCBA rejected the push outright (e.g. bad number) — throws
 * immediately, same as Daraja's ResponseCode !== '0' check. A non-null
 * TransactionID means the prompt was sent; the actual pay/cancel outcome
 * must be learned via queryStkPush below (this endpoint never tells you
 * whether the customer entered their PIN).
 *
 * @param {object} params
 * @param {string} params.phone - 254XXXXXXXXX
 * @param {number} params.amount
 * @param {string} params.accountNo - merchant's own virtual account
 *        reference, reconciled by the existing NCBA account-notification
 *        webhooks).
 * @returns {{ transactionId: string, referenceId: string }}
 */
export async function initiateStkPush({ phone, amount, accountNo }) {
  if (!phone || !amount || !accountNo) {
    throw new NcbaStkRequestError('phone, amount and accountNo are required to initiate an STK Push');
  }

  if (!liveCallsEnabled) {
    const fakeId = `SIM-STK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    simulate('ncba_stk_initiate_sandbox', { phone, amount, accountNo });
    return { transactionId: fakeId, referenceId: fakeId };
  }

  const result = await ncbaStkPost('/payments/api/v1/stk-push/initiate', {
    TelephoneNo: phone,
    Amount: String(amount),
    PayBillNo: NCBA_STK_PAYBILL,
    AccountNo: accountNo,
    Network: 'Safaricom',
    TransactionType: 'CustomerPayBillOnline',
  });

  if (!result?.TransactionID) {
    throw new NcbaStkRequestError(result?.StatusDescription || 'The STK Push request was rejected. Please try again.');
  }

  return { transactionId: result.TransactionID, referenceId: result.ReferenceID || result.TransactionID };
}

/**
 * Polls the outcome of a previously-initiated STK Push. NCBA's documented
 * responses only show 'SUCCESS'/'FAILED' — anything else (including no
 * response yet) is treated by callers as still-pending.
 *
 * @param {object} params
 * @param {string} params.transactionId - from initiateStkPush's response
 * @returns {{ status: 'SUCCESS'|'FAILED'|'PENDING', description: string }}
 */
export async function queryStkPush({ transactionId }) {
  if (!transactionId) {
    throw new NcbaStkRequestError('transactionId is required to query an STK Push');
  }

  if (!liveCallsEnabled) {
    // Sandbox: resolve as SUCCESS on first poll — mirrors the poll loop's
    // caller (mpesaController.js's pollAndResolveNcbaStkPush) expecting an
    // "auto-confirm shortly after" behavior rather than genuinely waiting.
    simulate('ncba_stk_query_sandbox', { transactionId });
    return { status: 'SUCCESS', description: 'Sandbox simulation — no real money moved' };
  }

  const result = await ncbaStkPost('/payments/api/v1/stk-push/query', { TransactionID: transactionId });
  const status = String(result?.status || '').toUpperCase();
  if (status === 'SUCCESS' || status === 'FAILED') {
    return { status, description: result?.description || '' };
  }
  return { status: 'PENDING', description: result?.description || '' };
}
