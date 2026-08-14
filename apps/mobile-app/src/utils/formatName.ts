// NCBA/M-Pesa payloads frequently send names in ALL CAPS (e.g. the
// CustomerName field on account-notification webhooks) — this presents them
// the way a merchant expects to read them: first letter of each word
// capitalized, the rest lowercase. "JACOB BRANDON OMUTITI" -> "Jacob Brandon
// Omutiti". Splits on space, hyphen and apostrophe so multi-part names
// ("MARY-JANE", "O'BRIEN") still capitalize correctly. Mirrors
// merchant-dashboard's utils/formatName.js.
export function formatName(name?: string | null): string {
  if (!name || typeof name !== 'string') return name || '';
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
