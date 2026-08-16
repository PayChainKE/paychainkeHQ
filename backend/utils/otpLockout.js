// Account-level lockout for OTP verification, generic over any Mongoose
// model that carries failedOtpAttempts/otpLockedUntil (Admin, Merchant).
// Mirrors utils/pinLockout.js — per-IP rate limiting on the verify-otp
// route stops a single-IP brute force but not a botnet/proxy-distributed
// one, which could otherwise spread guesses across many IPs against one
// account within the OTP's validity window. This closes that gap.
import { notifyAdmins } from './securityAlerts.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class OtpLockedError extends Error {
  constructor(retryAt) {
    super(`Too many incorrect codes. Try again after ${retryAt.toLocaleTimeString()}.`);
    this.name = 'OtpLockedError';
    this.retryAt = retryAt;
  }
}

// Call before comparing a submitted OTP against the stored one.
export async function assertOtpNotLocked(Model, id) {
  const doc = await Model.findById(id).select('+otpLockedUntil');
  if (doc?.otpLockedUntil && doc.otpLockedUntil > new Date()) {
    throw new OtpLockedError(doc.otpLockedUntil);
  }
}

// Call after a failed OTP comparison — increments the counter and locks
// the account for LOCKOUT_MS once MAX_ATTEMPTS is reached. Do NOT call
// this for an expired-code rejection; that's not a guessing attempt.
export async function recordFailedOtpAttempt(Model, id) {
  const doc = await Model.findById(id).select('+failedOtpAttempts');
  if (!doc) return;
  const attempts = (doc.failedOtpAttempts || 0) + 1;
  const update = { failedOtpAttempts: attempts };
  const isNewLock = attempts === MAX_ATTEMPTS;
  if (attempts >= MAX_ATTEMPTS) {
    update.otpLockedUntil = new Date(Date.now() + LOCKOUT_MS);
  }
  await Model.findByIdAndUpdate(id, update);

  if (isNewLock) {
    const label = doc.email || doc.businessName || doc.phone || String(id);
    notifyAdmins({
      type: 'otp_lockout',
      severity: 'warning',
      subject: 'Account locked — repeated failed OTP attempts',
      heading: 'OTP Lockout Triggered',
      details: `A ${Model.modelName} account <strong>${label}</strong> (id: ${id}) was locked for 15 minutes after ${MAX_ATTEMPTS} incorrect OTP attempts in a row.`,
      metadata: { model: Model.modelName, id: String(id), label },
    });
  }
}

// Call after a successful OTP verification — clears the counter/lock.
export async function resetOtpAttempts(Model, id) {
  await Model.findByIdAndUpdate(id, { failedOtpAttempts: 0, otpLockedUntil: null });
}
