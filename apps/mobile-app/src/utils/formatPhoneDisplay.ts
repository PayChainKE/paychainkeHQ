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
// wrong rather than merely unformatted. Only genuinely non-phone-shaped
// values (no digit run of Kenyan-MSISDN length at all) fall back to '—' —
// a real phone number that merely didn't match the strict 07XX/01XX
// pattern (e.g. still 254-prefixed, or with stray formatting) is shown as
// received rather than hidden outright, since a receipt hiding a real
// number the record actually has is worse than showing it unformatted.
export function formatPhoneOrDash(value?: string | null): string {
  const formatted = formatPhoneDisplay(value)
  if (formatted && /^0[71]\d{8}$/.test(String(formatted))) return formatted
  const digits = String(value ?? '').replace(/\D/g, '')
  if (/\d{9,12}/.test(digits)) return String(value)
  return '—'
}
