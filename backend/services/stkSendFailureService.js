import StkSendFailure from '../models/StkSendFailure.js';
import { NcbaStkAuthError, NcbaStkRequestError } from './ncbaStkPushService.js';

// The merchant's account cannot take a prompt yet (no NCBA account number).
export class StkSetupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StkSetupError';
    this.stage = 'setup';
    this.notSent = true;
  }
}

// Detail is for staff only, but still never store a token that slipped into an
// upstream error body.
const redact = (s) => String(s || '')
  .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/("?(?:access_)?token"?\s*[:=]\s*)"?[^",\s}]+"?/gi, '$1"[redacted]"')
  .slice(0, 600);

/**
 * Says what happened and what to tell the merchant. `httpStatus` is a 4xx
 * only when we KNOW no prompt was sent, so the app shows this message instead
 * of "the prompt may have been sent, check their phone". A timeout or dropped
 * connection stays a 502 for exactly that reason.
 */
export function classifyStkSendError(err) {
  if (err instanceof StkSetupError) {
    return { stage: 'setup', notSent: true, httpStatus: 409, message: 'Your account is not ready to receive M-PESA payments yet. Please contact support.' };
  }
  if (err instanceof NcbaStkAuthError) {
    return { stage: 'auth', notSent: true, httpStatus: 424, message: 'M-PESA payments are temporarily unavailable. Please try again in a few minutes.' };
  }
  if (err instanceof NcbaStkRequestError) {
    if (err.stage === 'rejected') {
      return { stage: 'rejected', notSent: true, httpStatus: 424, message: 'The M-PESA request was not accepted. Please check the phone number and try again.' };
    }
    if (err.notSent) {
      return { stage: 'request', notSent: true, httpStatus: 424, message: 'The M-PESA request could not be sent. Please try again in a few minutes.' };
    }
    return { stage: 'request', notSent: false, httpStatus: 502, message: 'Failed to send STK Push — please try again.' };
  }
  return { stage: 'other', notSent: false, httpStatus: 502, message: 'Failed to send STK Push — please try again.' };
}

/** Saves a failed send for the admin STK page. Never throws: a logging problem must not change the merchant's response. */
export async function recordStkSendFailure({ merchantId, phone, amount, kind, err }) {
  try {
    const c = classifyStkSendError(err);
    await StkSendFailure.create({
      merchantId: merchantId || null,
      phone: phone || null,
      amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
      kind: kind || null,
      stage: c.stage,
      notSent: c.notSent,
      httpStatus: Number.isFinite(err?.status) ? err.status : null,
      detail: redact(err?.detail || err?.message || 'Unknown error'),
    });
  } catch (e) {
    console.error('recordStkSendFailure: could not save:', e?.message || e);
  }
}
