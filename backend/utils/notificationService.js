// Africa's Talking SDK wrapper — the one place that knows how to talk to AT.
// utils/sms.js is the public "send an SMS" entrypoint every controller
// should import; it delegates the actual dispatch to this module. Keeping
// the SDK/init/phone-format details here (rather than in every controller)
// means there's exactly one place to change if the provider or its config
// ever changes.

// Memoized for the process lifetime — safe because Render restarts the
// entire process on every env var change/redeploy, so this can never keep
// serving a stale AT_API_KEY/AT_USERNAME pair across a live credential swap.
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
// Live-gate parity with controllers/mpesaController.js's MPESA_LIVE_ENABLED
// convention: going live is never inferred from a single env var alone.
// AT_USERNAME being a real (non-'sandbox') username is necessary but not
// sufficient — AT_LIVE_ENABLED must also be explicitly 'true' before a real,
// billed SMS is allowed to hit Africa's Talking's live gateway.
function isAtLiveGateOpen() {
  return process.env.AT_USERNAME !== 'sandbox' && process.env.AT_LIVE_ENABLED === 'true';
}

export async function sendAfricasTalkingSms(rawPhone, message) {
  const to = toE164Kenyan(rawPhone);
  if (!to) {
    throw new Error(`Cannot dispatch SMS — "${rawPhone}" is not a valid Kenyan mobile number`);
  }

  const username = process.env.AT_USERNAME;

  // Real/live credentials are configured (AT_USERNAME isn't AT's own
  // 'sandbox' account) but nobody has deliberately flipped AT_LIVE_ENABLED —
  // refuse to let that single env var alone put a real, billed SMS on the
  // wire. Intercept and simulate instead: log a loud warning, print the
  // exact compiled message body to the console, and hand back an
  // AT-shaped response so any caller inspecting the result doesn't break.
  if (username !== 'sandbox' && !isAtLiveGateOpen()) {
    console.warn('⚠️ AT Live Bypass: SMS routed to console simulation due to missing AT_LIVE_ENABLED flag');
    console.log(`[AT SIMULATION] To: ${to} | Message (${message.length} chars): ${message}`);

    return {
      SMSMessageData: {
        Message: 'Simulated — AT_LIVE_ENABLED is not set to true',
        Recipients: [{ number: to, status: 'Simulated', statusCode: 0, cost: 'KES 0.0000', messageId: null }],
      },
    };
  }

  const sms = await getSmsClient();

  const options = { to: [to], message };

  // Sandbox accounts can't send from a custom alphanumeric sender ID/short
  // code — only attach one for real, non-sandbox AT accounts.
  if (username !== 'sandbox' && process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  return sms.send(options);
}
