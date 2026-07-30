// Normalizes a Kenyan MSISDN into the standard local 10-digit display format
// M-Pesa itself uses in its own confirmation SMS (0712345678), regardless of
// which rail it arrived from — Safaricom's C2B payload always sends
// 254-prefixed MSISDNs, while NCBA's free-text CustomerName field has been
// observed carrying either 254- or 0-prefixed numbers (see
// parseNcbaCustomerField in ncbaAccountNotificationValidators.js). Anything
// that isn't phone-shaped passes through unchanged, so this is always safe
// to wrap around a value without special-casing non-phone fallbacks.
export function formatPhoneDisplay(raw) {
  if (!raw) return raw;
  const digits = String(raw).replace(/\D/g, '');
  if (/^254[71]\d{8}$/.test(digits)) return '0' + digits.slice(3);
  if (/^0[71]\d{8}$/.test(digits)) return digits;
  if (/^[71]\d{8}$/.test(digits)) return '0' + digits;
  return raw;
}
