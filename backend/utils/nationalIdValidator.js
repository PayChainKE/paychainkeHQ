// Shared Kenyan National ID validator, mirroring kraPinValidator.js's shape.
// Applied to Merchant.nationalId — the ID number of the individual
// registering the account (distinct from the uploaded national_id/passport
// *photo* in kybDocuments, which proves the number belongs to a real
// document but never captures the number itself). Having the number as a
// real, unique field lets duplicate-identity signups be rejected outright
// at registration instead of only being caught after the fact by
// documentReuseDetection.js's photo-hash comparison.
//
// Kenyan IDs are purely numeric, historically 7-8 digits (a shrinking
// number of much older ones are 6). No public checksum algorithm exists,
// so — same caveat as isValidKraPin — this is a shape + plausibility check,
// never proof the number is real or belongs to the person who typed it.
const NATIONAL_ID_SHAPE_REGEX = /^\d{6,8}$/;

export const NATIONAL_ID_FORMAT_HINT = 'Expected a 6-8 digit Kenyan National ID number, e.g. 12345678.';

export function normalizeNationalId(raw) {
  if (raw === null || raw === undefined) return raw;
  return String(raw).trim().replace(/\s+/g, '');
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

export function isValidNationalId(raw) {
  if (!raw) return false;
  const normalized = normalizeNationalId(raw);
  if (!NATIONAL_ID_SHAPE_REGEX.test(normalized)) return false;
  return isPlausibleDigitBlock(normalized);
}
