// Account-level lockout for password login, generic over any Mongoose
// model that carries failedLoginAttempts/loginLockedUntil. Mirrors
// utils/otpLockout.js's identical shape and rationale — per-IP rate
// limiting on the login route (e.g. developerLoginLimiter) stops a
// single-IP brute force but not a botnet/proxy-distributed one, which
// could otherwise spread password guesses across many IPs against one
// account indefinitely. This closes that gap.
import { notifyAdmins, escapeHtml } from './securityAlerts.js';

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

export class LoginLockedError extends Error {
  constructor(retryAt) {
    super(`Too many failed sign-in attempts. Try again after ${retryAt.toLocaleTimeString()}.`);
    this.name = 'LoginLockedError';
    this.retryAt = retryAt;
  }
}

// Call before comparing a submitted password against the stored hash.
export async function assertLoginNotLocked(Model, id) {
  const doc = await Model.findById(id).select('+loginLockedUntil');
  if (doc?.loginLockedUntil && doc.loginLockedUntil > new Date()) {
    throw new LoginLockedError(doc.loginLockedUntil);
  }
}

// Call after a failed password comparison — increments the counter and
// locks the account for LOCKOUT_MS once MAX_ATTEMPTS is reached.
export async function recordFailedLoginAttempt(Model, id) {
  const doc = await Model.findById(id).select('+failedLoginAttempts');
  if (!doc) return;
  const attempts = (doc.failedLoginAttempts || 0) + 1;
  const update = { failedLoginAttempts: attempts };
  const isNewLock = attempts === MAX_ATTEMPTS;
  if (attempts >= MAX_ATTEMPTS) {
    update.loginLockedUntil = new Date(Date.now() + LOCKOUT_MS);
  }
  await Model.findByIdAndUpdate(id, update);

  if (isNewLock) {
    const label = doc.email || doc.businessName || doc.phone || String(id);
    notifyAdmins({
      type: 'login_lockout',
      severity: 'warning',
      subject: 'Account locked — repeated failed sign-in attempts',
      heading: 'Login Lockout Triggered',
      details: `A ${Model.modelName} account <strong>${escapeHtml(label)}</strong> (id: ${id}) was locked for 15 minutes after ${MAX_ATTEMPTS} incorrect password attempts in a row.`,
      metadata: { model: Model.modelName, id: String(id), label },
    });
  }
}

// Call after a successful login — clears the counter/lock.
export async function resetLoginAttempts(Model, id) {
  await Model.findByIdAndUpdate(id, { failedLoginAttempts: 0, loginLockedUntil: null });
}
