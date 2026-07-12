// Africa's Talking SDK wrapper — the one place that knows how to talk to AT.
// utils/sms.js is the public "send an SMS" entrypoint every controller
// should import; it delegates the actual dispatch to this module. Keeping
// the SDK/init/phone-format details here (rather than in every controller)
// means there's exactly one place to change if the provider or its config
// ever changes.

let smsClient = null;

// Lazily initialize on first use rather than at import time — importing
// this module (e.g. at server boot) shouldn't crash a deploy just because
// AT_API_KEY/AT_USERNAME aren't set yet; the failure only surfaces when an
// SMS actually needs to go out.
async function getSmsClient() {
  if (smsClient) return smsClient;

  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    throw new Error('Africa\'s Talking is not configured — set AT_API_KEY and AT_USERNAME');
  }

  const { default: africastalking } = await import('africastalking');
  smsClient = africastalking({ apiKey, username }).SMS;
  return smsClient;
}

// Kenyan mobile numbers arrive in every shape a merchant/customer might type
// — 07XXXXXXXX, 7XXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX. Africa's Talking
// requires clean E.164 (+254XXXXXXXXX). Returns null (never throws) for
// anything that doesn't resolve to a valid 9-digit Safaricom/Airtel-shaped
// number — same [71]-prefix convention already used for KE MSISDNs
// elsewhere in this codebase (controllers/invoiceController.js).
export function toE164Kenyan(rawPhone) {
  let digits = String(rawPhone ?? '').replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (!/^[71]\d{8}$/.test(digits)) {
    return null;
  }

  return `+254${digits}`;
}

/**
 * Sends a single SMS via Africa's Talking. This is a thin, honest wrapper —
 * it throws on any failure (bad phone, missing config, AT API error) rather
 * than swallowing anything itself. Callers that must never let a delivery
 * failure interrupt a core flow (OTP dispatch, transaction alerts) are
 * expected to wrap this in their own try/catch — see utils/sms.js.
 */
export async function sendAfricasTalkingSms(rawPhone, message) {
  const to = toE164Kenyan(rawPhone);
  if (!to) {
    throw new Error(`Cannot dispatch SMS — "${rawPhone}" is not a valid Kenyan mobile number`);
  }

  const sms = await getSmsClient();

  const options = { to: [to], message };

  // Sandbox accounts can't send from a custom alphanumeric sender ID/short
  // code — only attach one for real, non-sandbox AT accounts.
  if (process.env.AT_USERNAME !== 'sandbox' && process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  return sms.send(options);
}
