// NCBA Virtual Account rules + shared inbound-reconciliation validation.
//
// NCBA assigns PayChain a single 4-digit institution prefix (bank-side,
// never generated or stored here) and concatenates it with an 8-digit
// PayChain-issued merchant code into the full 12-digit virtual account
// number merchants receive M-Pesa/EFT/PesaLink funds on. PayChain only ever
// generates/validates its 8-digit half — see generateRandomMerchantCode() /
// validateMerchantCode().

const EIGHT_DIGIT_CODE = /^\d{8}$/;

export class NcbaValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NcbaValidationError';
    this.code = code || 'VALIDATION_FAILED';
  }
}

// Sequential codes (00000001, 00000002, ...) look like a typo to a customer
// keying in a payment reference by hand — long runs of leading zeros read
// as "did I miss a digit?". A random 8-digit code with no leading zero
// (10000000-99999999) reads as a normal account number instead. Merchant.js's
// pre-save hook checks the DB for a collision before assigning one (the
// unique index on ncbaMerchantCode is the final backstop) — with 90 million
// possible codes, collisions are vanishingly rare for signup-rate traffic.
const RANDOM_CODE_MIN = 10_000_000;
const RANDOM_CODE_MAX = 99_999_999;

// A run like "55555" or "77777" inside an otherwise random code looks just
// as suspicious as a sequential one — reject and re-roll rather than hand
// one out. True 8-digit randomness rarely produces a run this long, so
// this almost never costs more than one extra draw.
const MAX_REPEATED_DIGIT_RUN = 3;

function hasLongRepeatedDigitRun(digits) {
  let runLength = 1;
  for (let i = 1; i < digits.length; i++) {
    runLength = digits[i] === digits[i - 1] ? runLength + 1 : 1;
    if (runLength > MAX_REPEATED_DIGIT_RUN) return true;
  }
  return false;
}

export function generateRandomMerchantCode() {
  let candidate;
  do {
    candidate = String(Math.floor(Math.random() * (RANDOM_CODE_MAX - RANDOM_CODE_MIN + 1)) + RANDOM_CODE_MIN);
  } while (hasLongRepeatedDigitRun(candidate));
  return candidate;
}

/**
 * Validate (and normalise) an inbound NCBA reconciliation push's
 * merchantCode field.
 *
 * NCBA is expected to send this pre-formatted exactly as PayChain generated
 * it (zero-padded, 8 digits, e.g. "00000001"). Some bank-side numeric fields
 * strip leading zeros in transit (e.g. "5421" instead of "00005421") — a
 * short-but-numeric code is re-padded to the canonical 8-digit form before
 * lookup, rather than rejected outright. Anything non-numeric, empty, or
 * longer than 8 digits is rejected — we only ever pad, never truncate.
 *
 * @throws {NcbaValidationError} if it can't be resolved to an exact 8-digit
 *         numeric string.
 */
export function validateMerchantCode(rawMerchantCode) {
  const trimmed = String(rawMerchantCode ?? '').trim();
  const code = /^\d{1,8}$/.test(trimmed) ? trimmed.padStart(8, '0') : trimmed;

  if (!EIGHT_DIGIT_CODE.test(code)) {
    throw new NcbaValidationError(
      `merchantCode must resolve to an exact 8-digit numeric string, received "${trimmed}"`,
      'INVALID_MERCHANT_CODE'
    );
  }

  return code;
}

/**
 * Builds the full 12-digit NCBA virtual account number for a merchant —
 * PayChain's bank-assigned 4-digit institution prefix (NCBA_INSTITUTION_PREFIX
 * env var) concatenated with the merchant's own 8-digit code. This is the
 * number PayChain must issue to each merchant so their customers have
 * something to pay into (M-Pesa/EFT/PesaLink/etc. all settle against it).
 *
 * Returns null — not an error — if the prefix isn't configured yet. NCBA
 * assigns this once PayChain's merchant database (i.e. every merchant
 * having an 8-digit code) is in place, so this is expected to be null until
 * that value is set, and merchant-facing surfaces should render a "pending
 * bank assignment" state rather than treating null as a failure.
 */
export function getNcbaVirtualAccountNumber(ncbaMerchantCode) {
  const prefix = process.env.NCBA_INSTITUTION_PREFIX;

  if (!prefix || !/^\d{4}$/.test(prefix)) {
    return null;
  }
  if (!ncbaMerchantCode || !EIGHT_DIGIT_CODE.test(ncbaMerchantCode)) {
    return null;
  }

  return `${prefix}${ncbaMerchantCode}`;
}

// Display-only grouping ("123456789012" -> "1234 5678 9012") so the 12-digit
// account number reads professionally instead of as one long digit string.
// Only touches values that are exactly 12 raw digits — the 8-digit interim
// ncbaMerchantCode, "Pending assignment", or anything else passed through
// unchanged, so callers can safely wrap every display site with this
// without special-casing the various fallback states.
export function formatAccountNumberDisplay(value) {
  if (!value) return value;
  const digits = String(value).replace(/\s+/g, '');
  if (!/^\d{12}$/.test(digits)) return value;
  return digits.match(/.{1,4}/g).join(' ');
}

export function validateCollectionAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new NcbaValidationError(`Amount must be a positive number, received "${amount}"`, 'INVALID_AMOUNT');
  }
  return Math.round(value * 100) / 100;
}

export function validatePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber ?? '').replace(/\D/g, '');
  // Kenyan MSISDN, normalised to 254XXXXXXXXX (matches the convention already
  // used for M-Pesa numbers elsewhere in this codebase).
  let normalised = digits;
  if (normalised.startsWith('0')) {
    normalised = `254${normalised.slice(1)}`;
  } else if (/^[71]\d{8}$/.test(normalised)) {
    // Bare 9-digit MSISDN body, no leading 0 or 254 — this is how
    // Merchant.phone is stored for merchants who signed up before a leading
    // 0/254 was consistently stripped or added at signup (e.g. "790889066"
    // instead of "0790889066"). frontend/utils/formatPhoneDisplay.js and
    // this file's own display counterpart already treat this exact shape as
    // valid and render it correctly — this validator was the one place
    // still rejecting it outright, which is what broke "Send Money" ->
    // Primary M-PESA Number (recipientAccount is set straight from
    // merchant.phone there, unlike the free-typed "Any M-PESA Number" field,
    // which always normalizes to a leading 0 as the user types).
    normalised = `254${normalised}`;
  }
  if (!/^254\d{9}$/.test(normalised)) {
    throw new NcbaValidationError(`PhoneNumber is not a valid MSISDN, received "${phoneNumber}"`, 'INVALID_PHONE');
  }
  return normalised;
}

export function validateTransactionReference(transactionReference) {
  const ref = String(transactionReference ?? '').trim();
  if (!ref || ref.length > 64) {
    throw new NcbaValidationError('TransactionReference is missing or malformed', 'INVALID_REFERENCE');
  }
  return ref;
}
