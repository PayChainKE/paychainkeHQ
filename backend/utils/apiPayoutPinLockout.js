import Merchant from '../models/Merchant.js';
import { notifyAdmins } from './securityAlerts.js';

// Account-level lockout for the API Payout PIN — same shape as
// pinLockout.js (which guards appPin), but pinLockout.js is hardcoded to
// appPin's own field names and can't be reused for a second, distinct PIN.
// Kept as an intentional near-duplicate rather than a parameterized shared
// util, matching this codebase's existing convention (otpLockout.js and
// pinLockout.js are already separate siblings, not unified).
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class ApiPayoutPinLockedError extends Error {
  constructor(retryAt) {
    super(`Too many incorrect API payout PIN attempts. Try again after ${retryAt.toLocaleTimeString()}.`);
    this.name = 'ApiPayoutPinLockedError';
    this.retryAt = retryAt;
  }
}

export async function assertApiPayoutPinNotLocked(merchantId) {
  const merchant = await Merchant.findById(merchantId).select('+apiPayoutPinLockedUntil');
  if (merchant?.apiPayoutPinLockedUntil && merchant.apiPayoutPinLockedUntil > new Date()) {
    throw new ApiPayoutPinLockedError(merchant.apiPayoutPinLockedUntil);
  }
}

export async function recordFailedApiPayoutPinAttempt(merchantId) {
  const merchant = await Merchant.findById(merchantId).select('+failedApiPayoutPinAttempts');
  if (!merchant) return;
  const attempts = (merchant.failedApiPayoutPinAttempts || 0) + 1;
  const update = { failedApiPayoutPinAttempts: attempts };
  const isNewLock = attempts === MAX_ATTEMPTS;
  if (attempts >= MAX_ATTEMPTS) {
    update.apiPayoutPinLockedUntil = new Date(Date.now() + LOCKOUT_MS);
  }
  await Merchant.findByIdAndUpdate(merchantId, update);

  if (isNewLock) {
    const label = merchant.businessName || merchant.email || merchant.phone || String(merchantId);
    notifyAdmins({
      type: 'api_payout_pin_lockout',
      severity: 'critical',
      subject: 'Merchant API payout locked — repeated failed PIN attempts',
      heading: 'API Payout PIN Lockout Triggered',
      details: `Merchant <strong>${label}</strong> (id: ${merchantId}) was locked out of Developer API payouts for 15 minutes after ${MAX_ATTEMPTS} incorrect API payout PIN attempts in a row.`,
      metadata: { merchantId: String(merchantId), label },
    });
  }
}

export async function resetApiPayoutPinAttempts(merchantId) {
  await Merchant.findByIdAndUpdate(merchantId, { failedApiPayoutPinAttempts: 0, apiPayoutPinLockedUntil: null });
}
