import axios from 'axios';
import { decryptKey } from '../utils/cryptoHelper.js';

// ── KRA eTIMS OSCU configuration ────────────────────────────────────────
// Per KRA's own OSCU/VSCU Step-by-Step sign-up guide (Section C): the base
// host has no "/etims-api" path segment — the example given there is
// straight from host to endpoint, e.g. https://etims-api-sbx.kra.go.ke/selectInitOsdcInfo.
const SANDBOX_BASE_URL = process.env.ETIMS_SANDBOX_BASE_URL || 'https://etims-api-sbx.kra.go.ke';
const PRODUCTION_BASE_URL = process.env.ETIMS_PRODUCTION_BASE_URL || 'https://etims-api.kra.go.ke';
const REQUEST_TIMEOUT_MS = Number(process.env.ETIMS_TIMEOUT_MS) || 20000;

// Real calls to KRA's live tax infrastructure only happen when this is
// explicitly 'true' — same simulation-gate pattern as
// NCBA_OPENBANKING_LIVE_ENABLED / NCBA_STK_LIVE_ENABLED
// (services/ncbaOpenBankingService.js, services/ncbaStkPushService.js).
// Registering a device or signing an invoice against KRA's real
// sandbox/production endpoints is not something that should ever happen as
// a side effect of running the app locally, in CI, or in a test suite.
const liveCallsEnabled = process.env.ETIMS_LIVE_ENABLED === 'true';

export class EtimsApiError extends Error {
  constructor(message, { resultCd, resultMsg, endpoint } = {}) {
    super(message);
    this.name = 'EtimsApiError';
    this.resultCd = resultCd;
    this.resultMsg = resultMsg;
    this.endpoint = endpoint;
  }
}

export class EtimsConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EtimsConfigError';
  }
}

function baseUrlFor(environment) {
  return environment === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function httpClient(environment) {
  return axios.create({
    baseURL: baseUrlFor(environment),
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });
}

// KRA's OSCU integration guide isn't something this environment has direct
// access to verify against — this places tin/bhfId/cmcKey on every request
// body (alongside the endpoint-specific payload), which is the pattern
// KRA's own published sandbox sample payloads use. This is the one place
// that would need to change if a given merchant's sandbox certification
// packet specifies headers instead.
function buildRequestBody(config, cmcKeyPlain, payload) {
  return {
    tin: config.tin,
    bhfId: config.bhfId,
    ...(cmcKeyPlain ? { cmcKey: cmcKeyPlain } : {}),
    ...payload,
  };
}

async function post(environment, endpoint, body, { simulateResponse } = {}) {
  if (!liveCallsEnabled) {
    logEvent('info', 'etims.simulated', { endpoint, environment });
    return simulateResponse
      ? simulateResponse(body)
      : { resultCd: '000', resultMsg: 'Simulated (ETIMS_LIVE_ENABLED is not "true")', resultDt: new Date().toISOString(), data: {} };
  }

  try {
    const res = await httpClient(environment).post(endpoint, body);
    const { resultCd, resultMsg } = res.data || {};
    if (resultCd !== '000') {
      logEvent('error', 'etims.rejected', { endpoint, resultCd, resultMsg });
      throw new EtimsApiError(resultMsg || 'KRA eTIMS rejected the request', { resultCd, resultMsg, endpoint });
    }
    logEvent('info', 'etims.ok', { endpoint, resultCd });
    return res.data;
  } catch (err) {
    if (err instanceof EtimsApiError) throw err;
    const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
    logEvent('error', 'etims.request_failed', {
      endpoint, isTimeout, message: err.message, kraBody: err.response?.data,
    });
    throw new EtimsApiError(
      isTimeout
        ? `KRA eTIMS request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `KRA eTIMS request to ${endpoint} failed: ${err.message}`,
      { resultCd: err.response?.data?.resultCd, resultMsg: err.response?.data?.resultMsg, endpoint }
    );
  }
}

// ── Device handshake ────────────────────────────────────────────────────
export async function initializeDevice({ tin, bhfId, dvcSrlNo, environment = 'sandbox' }) {
  const body = { tin, bhfId, dvcSrlNo };
  const data = await post(environment, '/selectInitOsdcInfo', body, {
    simulateResponse: () => ({
      resultCd: '000',
      resultMsg: 'Simulated init (ETIMS_LIVE_ENABLED is not "true")',
      resultDt: new Date().toISOString(),
      data: { info: { cmcKey: `SIMULATED-CMC-KEY-${tin}-${bhfId}-${Date.now()}` } },
    }),
  });
  const cmcKey = data?.data?.info?.cmcKey || data?.data?.cmcKey;
  if (!cmcKey) {
    throw new EtimsApiError('KRA accepted the handshake but returned no cmcKey', { endpoint: '/selectInitOsdcInfo' });
  }
  return { cmcKey, raw: data };
}

// ── Authenticated calls (require a config doc + decrypted cmcKey) ──────
export async function fetchStandardCodes(config, cmcKeyPlain) {
  return post(config.environment, '/selectCodeList', buildRequestBody(config, cmcKeyPlain, {}), {
    simulateResponse: () => ({ resultCd: '000', resultMsg: 'Simulated', data: { clsList: [] } }),
  });
}

export async function registerItem(config, cmcKeyPlain, itemData) {
  return post(config.environment, '/saveItem', buildRequestBody(config, cmcKeyPlain, itemData), {
    simulateResponse: () => ({ resultCd: '000', resultMsg: 'Simulated item registration', data: {} }),
  });
}

export async function saveSalesTransaction(config, cmcKeyPlain, salesPayload) {
  return post(config.environment, '/saveTrnsSalesOsdc', buildRequestBody(config, cmcKeyPlain, salesPayload), {
    simulateResponse: () => simulateSalesResponse(config, salesPayload),
  });
}

export async function savePurchaseTransaction(config, cmcKeyPlain, purchasePayload) {
  return post(config.environment, '/saveTrnsPurchaseOsdc', buildRequestBody(config, cmcKeyPlain, purchasePayload), {
    simulateResponse: () => ({ resultCd: '000', resultMsg: 'Simulated', data: {} }),
  });
}

export async function saveStockInOut(config, cmcKeyPlain, stockPayload) {
  return post(config.environment, '/saveStockItem', buildRequestBody(config, cmcKeyPlain, stockPayload), {
    simulateResponse: () => ({ resultCd: '000', resultMsg: 'Simulated', data: {} }),
  });
}

// Deterministic, clearly-synthetic fiscal response used only while
// ETIMS_LIVE_ENABLED isn't 'true' — lets the whole sale -> sign -> QR
// pipeline be exercised end-to-end (and unit-tested) without ever touching
// KRA's real infrastructure.
function simulateSalesResponse(config, salesPayload) {
  const seq = String(salesPayload.invcNo).padStart(10, '0');
  return {
    resultCd: '000',
    resultMsg: 'Simulated sales response (ETIMS_LIVE_ENABLED is not "true")',
    resultDt: new Date().toISOString(),
    data: {
      sdcId: `SDC00SIM${config.bhfId}`,
      rcptNo: salesPayload.invcNo,
      totRcptNo: salesPayload.invcNo,
      intrlData: `SIM${seq}INTRLDATA0000000000`.slice(0, 32),
      rcptSign: `SIM${seq}RCPTSIGN00000000000`.slice(0, 32),
      vsdcRcptPbctDate: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    },
  };
}

export function getCmcKeyPlain(configDoc) {
  if (!configDoc?.cmcKeyEncrypted) return null;
  return decryptKey(configDoc.cmcKeyEncrypted);
}

export const isLiveCallsEnabled = () => liveCallsEnabled;
