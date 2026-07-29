// Groups a 12-digit PayChain/NCBA virtual account number into readable
// blocks of 4 ("123456789012" -> "1234 5678 9012"). Anything that isn't
// exactly 12 raw digits (the 8-digit interim ncbaMerchantCode, "Pending"
// placeholders, etc.) passes through unchanged, so this is always safe to
// wrap around a display value without special-casing fallback states.
//
// Display only — never use this on a value that's copied to clipboard,
// embedded in a QR/URL, or used for matching.
export function formatAccountNumber(value?: string | null): string {
  if (!value) return value ?? '';
  const digits = String(value).replace(/\s+/g, '');
  if (!/^\d{12}$/.test(digits)) return value;
  return digits.match(/.{1,4}/g)!.join(' ');
}
