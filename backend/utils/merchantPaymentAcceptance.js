// Whether a merchant may receive money right now. Two admin controls stop it:
//   - status 'locked': the full account lock (no sign-in, no payments)
//   - inboundLocked:   "Block incoming payments" only; the merchant can still
//                      sign in, view history and pay out what they hold
// Every collection path checks this one helper, so the two controls can't
// drift apart. Callers must load `status` and `inboundLocked`.
export const PAYMENT_ACCEPTANCE_FIELDS = 'status inboundLocked inboundLockReason';

export function canReceivePayments(merchant) {
  if (!merchant) return false;
  return merchant.status !== 'locked' && !merchant.inboundLocked;
}

// Neutral on purpose: a payer is never told the merchant is locked. Shown on
// the payment page as it loads, so they're stopped before entering anything.
export const MERCHANT_CANNOT_RECEIVE_MESSAGE = 'Payments to this merchant are temporarily unavailable. Please do not send money to this merchant through PayChain, including by paybill, until the service resumes.';

// The reason a merchant is shown for a block. It completes the sentence
// "...temporarily paused due to ___", so presets and custom text read the same
// everywhere (in-app, banner, SMS, email).
export const DEFAULT_INBOUND_BLOCK_REASON = 'scheduled system maintenance';
export const MAX_INBOUND_BLOCK_REASON = 160;

// Empty falls back to the default. Returns null when it's too long to send.
export function normalizeInboundBlockReason(raw) {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (!cleaned) return DEFAULT_INBOUND_BLOCK_REASON;
  return cleaned.length > MAX_INBOUND_BLOCK_REASON ? null : cleaned;
}

// For the merchant's own Request Money / QR screens, never a public page.
export function merchantBlockedMessage(merchant) {
  if (!merchant?.inboundLocked) return 'Incoming payments are blocked on your account. Contact support.';
  const reason = merchant.inboundLockReason || DEFAULT_INBOUND_BLOCK_REASON;
  return `Payment collection on your account is temporarily paused due to ${reason}. We'll notify you as soon as it resumes.`;
}
