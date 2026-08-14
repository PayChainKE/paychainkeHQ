// Normalizes a Kenyan MSISDN into the standard local 10-digit display format
// M-Pesa itself uses (0712345678), whether it arrived 254-prefixed (M-Pesa)
// or inconsistently 254-/0-prefixed (NCBA). Anything that isn't phone-shaped
// (paybill numbers, "MASTER_WALLET", Stellar public keys, etc.) passes
// through unchanged, so this is always safe to wrap around a sender/
// recipient id without special-casing non-phone values. Mirrors
// apps/merchant-dashboard/src/utils/formatPhoneDisplay.js.
export function formatPhoneDisplay(value?: string | null): string {
  if (!value) return value ?? ''
  const digits = String(value).replace(/\D/g, '')
  if (/^254[71]\d{8}$/.test(digits)) return '0' + digits.slice(3)
  if (/^0[71]\d{8}$/.test(digits)) return digits
  if (/^[71]\d{8}$/.test(digits)) return '0' + digits
  return value
}

// Same normalization, but for a "Phone Number" receipt field specifically —
// where showing a passed-through non-phone value (a paybill number, a bank
// account, "MASTER_WALLET") mislabeled as a phone number would be actively
// wrong rather than merely unformatted. Returns '—' for anything that isn't
// recognizably a Kenyan MSISDN.
export function formatPhoneOrDash(value?: string | null): string {
  const formatted = formatPhoneDisplay(value)
  return formatted && /^0[71]\d{8}$/.test(String(formatted)) ? formatted : '—'
}
