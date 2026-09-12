import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import MerchantLoginDevice from '../models/MerchantLoginDevice.js';
import { extractIp, clipUa, logAudit } from './auditLog.js';
import { notifyAdmins, escapeHtml } from './securityAlerts.js';
import { dispatchOtp } from './otpDispatch.js';
import { timingSafeStringEqual } from './timingSafeCompare.js';
import { LARGE_TRANSACTION_ALERT_KES } from '../config/fraudThresholds.js';

// A login from a device PayChain has never seen, immediately followed by a
// large payout, is the clearest signature of an account takeover cashing
// out before anyone notices — stronger than either signal alone. This guard
// requires a fresh OTP (sent to the merchant's own phone/email, same as
// login) before such a payout is allowed to actually move money.
//
// "Recent" rather than "ever new": a device stays flagged for this window
// after its first sighting, not forever — the risk window is the hours
// right after an unfamiliar sign-in, not an unfamiliar device that's since
// become the merchant's normal one.
const NEW_DEVICE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

const OTP_TTL_MS = 10 * 60 * 1000; // matches login OTP's own 10-minute window
// Stricter than login's 5-attempt OTP lockout (utils/otpLockout.js) — this
// gates money actually leaving the account, not just access to it.
const MAX_ATTEMPTS = 3;

export class PayoutStepUpInvalidError extends Error {}

// True when the current request's device/location fingerprint is one
// MerchantLoginDevice first saw inside the last NEW_DEVICE_WINDOW_MS — the
// exact same fingerprint (sha256(userAgent|ip)) utils/newDeviceLoginAlert.js
// already computes at login, just re-checked here at payout time. No record
// at all reads the same as "just seen" (safest default — never silently
// skip the check just because the lookup came back empty).
export async function isRecentDevice(merchantId, req) {
  const ip = extractIp(req) || 'unknown';
  const userAgent = clipUa(req) || 'unknown';
  const fingerprint = crypto.createHash('sha256').update(`${userAgent}|${ip}`).digest('hex');

  const device = await MerchantLoginDevice.findOne({ merchantId, fingerprint }).select('firstSeenAt').lean();
  if (!device) return true;
  return Date.now() - new Date(device.firstSeenAt).getTime() < NEW_DEVICE_WINDOW_MS;
}

export async function requiresPayoutStepUp({ merchantId, req, amountKes }) {
  if (!(Number(amountKes) >= LARGE_TRANSACTION_ALERT_KES)) return false;
  return isRecentDevice(merchantId, req);
}

// Generates and dispatches a fresh code, persisting it on the dedicated
// payoutStepUp* fields — never the login otp/otpExpires fields (see
// Merchant.js's comment on why a payout step-up racing a concurrent
// login/reset OTP must not clobber either one's pending code).
export async function issuePayoutStepUpOtp(merchant, req) {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);
  await Merchant.updateOne(
    { _id: merchant._id },
    { $set: { payoutStepUpOtp: otp, payoutStepUpOtpExpires: otpExpires, payoutStepUpAttempts: 0 } }
  );

  // SMS-first (viaPhone: true) since a step-up is triggered mid-session, not
  // tied to whichever identifier the merchant originally typed to log in —
  // dispatchOtp already falls back to email on its own if the phone can't
  // be normalized.
  const { channel, maskedPhone } = await dispatchOtp(merchant, {
    viaPhone: true,
    otp,
    label: 'PayChain payout confirmation',
  });

  logAudit({
    action: 'merchant.payout.step_up_required',
    category: 'security',
    severity: 'warning',
    message: 'Large payout attempted from an unfamiliar device — step-up code sent',
    merchant,
    req,
    metadata: { channel },
  });

  notifyAdmins({
    type: 'payout_step_up_challenge',
    severity: 'warning',
    subject: `Step-up challenge issued: ${merchant.businessName || merchant.email}`,
    heading: 'Large Payout From New Device — Step-Up Sent',
    details: `<strong>${escapeHtml(merchant.businessName || merchant.phone || merchant.email)}</strong> attempted a large payout from a device/location not recently seen on this account. A verification code was sent to confirm it's really them before the payout proceeds — no action needed unless it fails or this recurs.`,
    metadata: { merchantId: String(merchant._id) },
  });

  return { channel, maskedPhone };
}

// Verifies a submitted step-up code. Throws PayoutStepUpInvalidError on a
// wrong/expired code; on the 3rd wrong code in a row, also locks outbound
// transfers on the account (reusing outboundVelocityGuard.js's own
// outboundLocked field/mechanism) and escalates to admins at 'critical' —
// repeated wrong codes immediately after a new-device login is the
// signature of an active takeover attempt, not a typo.
export async function verifyPayoutStepUpOtp(merchant, code) {
  const doc = await Merchant.findById(merchant._id)
    .select('+payoutStepUpOtp +payoutStepUpOtpExpires +payoutStepUpAttempts businessName phone email');
  if (!doc) throw new PayoutStepUpInvalidError('Invalid or expired code.');

  const isValid = Boolean(
    doc.payoutStepUpOtp &&
    timingSafeStringEqual(doc.payoutStepUpOtp, String(code || '')) &&
    doc.payoutStepUpOtpExpires &&
    doc.payoutStepUpOtpExpires > new Date()
  );

  if (isValid) {
    await Merchant.updateOne(
      { _id: merchant._id },
      { $set: { payoutStepUpOtp: null, payoutStepUpOtpExpires: null, payoutStepUpAttempts: 0 } }
    );
    return;
  }

  const attempts = (doc.payoutStepUpAttempts || 0) + 1;
  await Merchant.updateOne({ _id: merchant._id }, { $set: { payoutStepUpAttempts: attempts } });

  if (attempts >= MAX_ATTEMPTS) {
    await Merchant.updateOne(
      { _id: merchant._id },
      {
        $set: {
          outboundLocked: true,
          outboundLockedAt: new Date(),
          outboundLockReason: `${attempts} incorrect payout step-up codes in a row`,
          payoutStepUpOtp: null,
          payoutStepUpOtpExpires: null,
        },
      }
    );

    logAudit({
      action: 'merchant.payout.step_up_failed_lockout',
      category: 'security',
      severity: 'critical',
      message: 'Outbound transfers auto-locked — repeated incorrect payout step-up codes',
      merchant: doc,
      actor: { type: 'system', id: null, email: null, name: 'system' },
    });

    notifyAdmins({
      type: 'payout_step_up_challenge',
      severity: 'critical',
      subject: `Outbound locked — failed step-up codes: ${doc.businessName || doc.email}`,
      heading: 'Repeated Incorrect Payout Step-Up Codes',
      details: `<strong>${escapeHtml(doc.businessName || doc.phone || doc.email)}</strong> entered ${attempts} incorrect payout confirmation codes in a row, right after a login from an unfamiliar device — the pattern of a takeover attempting to cash out. Outbound transfers have been automatically locked on this account; login and everything else is unaffected. Review before clearing the lock.`,
      metadata: { merchantId: String(doc._id) },
    });

    throw new PayoutStepUpInvalidError('Too many incorrect codes. Outbound transfers have been temporarily locked on this account for security.');
  }

  throw new PayoutStepUpInvalidError('Invalid or expired code.');
}
