// NCBA Virtual Account rules + shared inbound-reconciliation validation.
//
// NCBA assigns PayChain a single 4-digit institution prefix (bank-side,
// never generated or stored here) and concatenates it with an 8-digit
// PayChain-issued merchant code into the full 12-digit virtual account
// number merchants receive M-Pesa/EFT/PesaLink funds on. PayChain only ever
// generates/validates its 8-digit half — see generateMerchantCode() /
// validateMerchantCode().

const EIGHT_DIGIT_CODE = /^\d{8}$/;
const MAX_AUTO_INCREMENT_ID = 99_999_999; // largest value that fits in 8 digits

export class NcbaValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NcbaValidationError';
    this.code = code || 'VALIDATION_FAILED';
  }
}

/**
 * Generate the 8-digit, zero-padded NCBA merchant code for a merchant from
 * its atomically-allocated auto-increment id (see Counter.js — Merchant.js's
 * pre-save hook calls this so every merchant gets one on creation).
 *
 * e.g. generateMerchantCode(5421) -> "00005421"
 *
 * @throws {NcbaValidationError} if autoIncrementId isn't a positive integer
 *         that fits in 8 digits, or the strict length invariant fails.
 */
export function generateMerchantCode(autoIncrementId) {
  const id = Number(autoIncrementId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NcbaValidationError(
      `autoIncrementId must be a positive integer, received "${autoIncrementId}"`,
      'INVALID_AUTO_INCREMENT_ID'
    );
  }
  if (id > MAX_AUTO_INCREMENT_ID) {
    throw new NcbaValidationError(
      `autoIncrementId ${id} exceeds the 8-digit merchant code capacity (max ${MAX_AUTO_INCREMENT_ID})`,
      'MERCHANT_CODE_CAPACITY_EXCEEDED'
    );
  }

  const code = String(id).padStart(8, '0');

  // Mathematically unreachable given the bounds check above, but the spec
  // calls for an explicit strict-length assertion rather than trusting the
  // arithmetic silently.
  if (code.length !== 8) {
    throw new NcbaValidationError(`Generated merchant code "${code}" is not exactly 8 characters`, 'MERCHANT_CODE_LENGTH_INVARIANT');
  }

  return code;
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
  if (normalised.startsWith('0')) normalised = `254${normalised.slice(1)}`;
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
