import Merchant from '../models/Merchant.js';
import { notifyAdmins } from './securityAlerts.js';

// Account-level lockout for the 4-digit payment/bulk-pay PINs. IP rate
// limiting (see the pinLimiter in each PIN-guarded route file) stops a
// single-IP brute force but not a botnet/proxy-distributed one — this
// closes that gap by locking the *account* itself after repeated failures,
// independent of where the requests come from.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class PinLockedError extends Error {
  constructor(retryAt) {
    super(`Too many incorrect PIN attempts. Try again after ${retryAt.toLocaleTimeString()}.`);
    this.name = 'PinLockedError';
    this.retryAt = retryAt;
  }
}

// Call before running bcrypt.compare against a stored PIN.
export async function assertPinNotLocked(merchantId) {
  const merchant = await Merchant.findById(merchantId).select('+pinLockedUntil');
  if (merchant?.pinLockedUntil && merchant.pinLockedUntil > new Date()) {
    throw new PinLockedError(merchant.pinLockedUntil);
  }
}

// Call after a failed bcrypt.compare — increments the counter and locks
// the account for LOCKOUT_MS once MAX_ATTEMPTS is reached.
export async function recordFailedPinAttempt(merchantId) {
  const merchant = await Merchant.findById(merchantId).select('+failedPinAttempts');
  if (!merchant) return;
  const attempts = (merchant.failedPinAttempts || 0) + 1;
  const update = { failedPinAttempts: attempts };
  const isNewLock = attempts === MAX_ATTEMPTS;
  if (attempts >= MAX_ATTEMPTS) {
    update.pinLockedUntil = new Date(Date.now() + LOCKOUT_MS);
  }
  await Merchant.findByIdAndUpdate(merchantId, update);

  if (isNewLock) {
    const label = merchant.businessName || merchant.email || merchant.phone || String(merchantId);
    notifyAdmins({
      type: 'pin_lockout',
      severity: 'warning',
      subject: 'Merchant account locked — repeated failed PIN attempts',
      heading: 'Payment PIN Lockout Triggered',
      details: `Merchant <strong>${label}</strong> (id: ${merchantId}) was locked for 15 minutes after ${MAX_ATTEMPTS} incorrect payment PIN attempts in a row. This guards every money-movement flow (Send Money, Bulk Pay, B2C/B2B).`,
      metadata: { merchantId: String(merchantId), label },
    });
  }
}

// Call after a successful bcrypt.compare — clears the counter/lock.
export async function resetPinAttempts(merchantId) {
  await Merchant.findByIdAndUpdate(merchantId, { failedPinAttempts: 0, pinLockedUntil: null });
}
