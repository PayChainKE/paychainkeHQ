// Normalizes a Kenyan MSISDN into the standard local 10-digit display format
// M-Pesa itself uses (0712345678), whether it arrived 254-prefixed (M-Pesa)
// or inconsistently 254-/0-prefixed (NCBA). Anything that isn't phone-shaped
// (paybill numbers, "MASTER_WALLET", Stellar public keys, etc.) passes
// through unchanged, so this is always safe to wrap around a sender/
// recipient id without special-casing non-phone values.
export function formatPhoneDisplay(value) {
  if (!value) return value
  const digits = String(value).replace(/\D/g, '')
  if (/^254[71]\d{8}$/.test(digits)) return '0' + digits.slice(3)
  if (/^0[71]\d{8}$/.test(digits)) return digits
  if (/^[71]\d{8}$/.test(digits)) return '0' + digits
  return value
}
