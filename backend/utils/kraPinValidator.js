// Shared KRA (Kenya Revenue Authority) PIN validator — the single place
// this logic should live. Applied consistently across every entity that
// carries a KRA PIN in this app: Merchant.kraPin (registration,
// admin-create, officer-onboard, profile update — controllers/
// merchantAuthController.js, adminController.js, officerController.js),
// Payee.kraPin for both employees and suppliers (controllers/
// bulkPayController.js), and the eTIMS OSCU device handshake
// (controllers/etimsController.js), which sends kraPin on to KRA as the tin.
//
// isValidKraPin() does two layers of checking:
//   1. Shape — one leading letter, 9 digits, one trailing letter.
//   2. Obviously-fake digit patterns — all nine digits identical
//      (000000000, 111111111, ...) or a strictly ascending/descending run
//      (012345678, 123456789, 987654321, ...). These are exactly what
//      someone rushing through a required field types, or what a bot fills
//      in — real KRA-issued PINs are effectively never this pattern. This
//      is a plausibility heuristic, not a real KRA checksum: KRA has never
//      published a public checksum algorithm for PINs, so this deliberately
//      does not claim to (and can't) confirm a PIN is real or registered.
//      A value that passes both layers has not been confirmed to exist —
//      never present a passed check to a user as "verified with KRA." That's
//      what the separate, manually-ticked kybChecklist.kraPinVerified flag
//      (models/Merchant.js) is for.
const KRA_PIN_SHAPE_REGEX = /^([AP])(\d{9})([A-Z])$/i;

// Deliberately not the sequential/repeated-digit-vulnerable "P123456789A" —
// see isPlausibleDigitBlock below.
export const KRA_PIN_FORMAT_HINT = 'Expected format: one letter (A or P), 9 digits, one letter — e.g. P051892647A.';

export function normalizeKraPin(raw) {
  if (raw === null || raw === undefined) return raw;
  return String(raw).trim().toUpperCase();
}

function isPlausibleDigitBlock(digits) {
  const d = digits.split('').map(Number);
  const allSame = d.every((n) => n === d[0]);
  if (allSame) return false;

  let ascending = true;
  let descending = true;
  for (let i = 1; i < d.length; i++) {
    if (d[i] !== d[i - 1] + 1) ascending = false;
    if (d[i] !== d[i - 1] - 1) descending = false;
  }
  if (ascending || descending) return false;

  return true;
}

export function isValidKraPin(raw) {
  if (!raw) return false;
  const match = KRA_PIN_SHAPE_REGEX.exec(normalizeKraPin(raw));
  if (!match) return false;
  const [, , digits] = match;
  return isPlausibleDigitBlock(digits);
}

// KRA's leading character denotes taxpayer type. Nothing in this app
// branches behavior on it today — both merchants and employees/suppliers
// are accepted either way — but it's occasionally useful for display or
// support tooling.
export function kraPinTaxpayerType(raw) {
  const pin = normalizeKraPin(raw);
  if (!isValidKraPin(pin)) return null;
  return pin[0] === 'A' ? 'individual' : 'non_individual';
}
