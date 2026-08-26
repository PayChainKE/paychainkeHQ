// Shared email format validator. The Merchant schema's own regex
// (models/Merchant.js) already blocks anything that isn't shaped like an
// email at all (no @, no dot) via a Mongoose validator, but that only
// fires on save and produces a raw ValidationError — every other field
// on Merchant creation (phone, KRA PIN) is checked explicitly in the
// controller first for a clean 400 + message, and email had no such gate.
// This also catches a few obviously-fake shapes the old regex let through
// (consecutive dots, leading/trailing dots) and rejects a short list of
// well-known disposable/throwaway-email domains — format-level checks
// only. This does NOT confirm the address is real or reachable (no
// send-a-code verification) — never present a passed check as "we
// verified this inbox exists."
const EMAIL_SHAPE_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// A representative sample of widely-used disposable/temp-mail providers —
// not exhaustive (new ones appear constantly), just enough to catch the
// common, lazy case.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org',
  'throwaway.email', 'yopmail.com', 'trashmail.com', 'fakeinbox.com',
  'getnada.com', 'dispostable.com', 'mailnesia.com', 'sharklasers.com',
]);

export const EMAIL_FORMAT_HINT = 'Enter a real email address, e.g. name@business.com.';

export function isValidEmail(raw) {
  const email = String(raw ?? '').trim();
  if (!email) return false;
  if (!EMAIL_SHAPE_REGEX.test(email)) return false;
  if (email.includes('..')) return false;
  if (email.startsWith('.') || email.endsWith('.')) return false;

  const domain = email.split('@')[1]?.toLowerCase();
  if (domain?.startsWith('.') || domain?.endsWith('.')) return false;
  if (domain && DISPOSABLE_DOMAINS.has(domain)) return false;

  return true;
}
