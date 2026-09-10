import crypto from 'crypto';
import MerchantLoginDevice from '../models/MerchantLoginDevice.js';
import { extractIp, clipUa, logAudit } from './auditLog.js';
import { sendNewDeviceLoginEmail } from './resend.js';
import { buildNewDeviceLoginSms } from './accountSmsTemplates.js';
import { safeSendSMS } from './smsSanitizer.js';
import { toE164Kenyan } from './notificationService.js';

// Call once per completed login — after password + OTP (or the app-review
// bypass), never after just a password check, since the alert is meant to
// mean "someone is now actually inside this account," not "someone typed
// the right password" (which OTP already exists to gate on its own).
// Fire-and-forget from the caller's side: never awaited into the login
// response, and swallows its own errors internally so a DB hiccup here can
// never fail or delay an otherwise-successful login.
export async function checkAndRecordLoginDevice(merchant, req) {
  try {
    const ip = extractIp(req) || 'unknown';
    const userAgent = clipUa(req) || 'unknown';
    const fingerprint = crypto.createHash('sha256').update(`${userAgent}|${ip}`).digest('hex');

    // findOneAndUpdate + upsert with new:false returns the PRE-update
    // document — null specifically means no document existed, i.e. this
    // fingerprint is genuinely new for this merchant. One atomic op avoids
    // a separate exists-check racing a concurrent login from the same
    // device (two tabs logging in at once shouldn't both count as "new").
    const priorDoc = await MerchantLoginDevice.findOneAndUpdate(
      { merchantId: merchant._id, fingerprint },
      { $set: { lastSeenAt: new Date() }, $setOnInsert: { userAgent, ip, firstSeenAt: new Date() } },
      { upsert: true, new: false }
    );
    if (priorDoc) return; // known device — nothing to do

    // A merchant's very first login ever is trivially "new" against an
    // empty history — not suspicious, nothing to compare against yet, so
    // don't alert on it. Only device #2 onward can mean "unfamiliar."
    const deviceCount = await MerchantLoginDevice.countDocuments({ merchantId: merchant._id });
    if (deviceCount <= 1) return;

    logAudit({
      action: 'merchant.login.new_device',
      category: 'security',
      severity: 'warning',
      message: 'Login from a device/location not seen before on this account',
      merchant,
      actor: { type: 'self', id: merchant._id, email: merchant.email, name: merchant.name },
      metadata: { ip, userAgent },
    });

    const when = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    if (merchant.email) {
      sendNewDeviceLoginEmail(merchant.email, merchant.name, when, ip, userAgent).catch((err) =>
        console.error('New-device login email failed:', err)
      );
    }
    const phone = toE164Kenyan(merchant.phone);
    if (phone) {
      const { message } = buildNewDeviceLoginSms();
      safeSendSMS({ to: phone, message }).catch((err) =>
        console.error('New-device login SMS failed:', err)
      );
    }
  } catch (err) {
    console.error('checkAndRecordLoginDevice failed:', err);
  }
}
