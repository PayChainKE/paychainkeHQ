// Field-level parsing for NCBA's Account-Level Notification Push (SOAP),
// per NCBA's own "Account-Level Notification Push Service Guide".

export class NcbaAccountNotificationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NcbaAccountNotificationError';
    this.code = code || 'VALIDATION_FAILED';
  }
}

const EIGHT_DIGIT_RUN = /\b(\d{8})\b/;
const TWELVE_DIGIT_RUN = /\b(\d{12})\b/;

// `allowTwelveDigitFallback` is only ever passed for Narrative (see
// extractMerchantCode below) — never for PhoneNr/CustomerName, since a
// Kenyan MSISDN in 254XXXXXXXXX form is also exactly 12 digits, and blindly
// slicing "the last 8 digits" out of what's actually a phone number would
// misattribute the payment instead of just failing safe.
function findEightDigitCode(text, { allowTwelveDigitFallback = false } = {}) {
  const prefix = process.env.NCBA_INSTITUTION_PREFIX;
  const str = String(text ?? '');

  if (prefix && /^\d{4}$/.test(prefix)) {
    const fullAccountMatch = str.match(new RegExp(`${prefix}(\\d{8})`));
    if (fullAccountMatch) return fullAccountMatch[1];
  }

  const bareMatch = str.match(EIGHT_DIGIT_RUN);
  if (bareMatch) return bareMatch[1];

  // Safety net for when NCBA_INSTITUTION_PREFIX isn't configured yet but
  // the field already carries the full 12-digit virtual account number
  // (institution prefix + merchant code) as one contiguous run — the
  // prefix match above can't fire without knowing the prefix's digits, and
  // \b(\d{8})\b can never match 8 digits out of the middle of a 12-digit
  // run (there's no word-boundary between two adjacent digits). The
  // merchant code is always the last 8 digits of that 12-digit number by
  // construction (see generateRandomMerchantCode/getNcbaVirtualAccountNumber),
  // so this is a safe positional extraction, not a guess.
  if (allowTwelveDigitFallback) {
    const twelveMatch = str.match(TWELVE_DIGIT_RUN);
    if (twelveMatch) return twelveMatch[1].slice(-8);
  }

  return null;
}

function logStructuralConflict(fields) {
  console.error(JSON.stringify({
    level: 'error',
    event: 'ncba_account_notification_merchant_code_conflict',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

/**
 * Best-effort extraction of an 8-digit PayChain merchant code from NCBA's
 * notification.
 *
 * `Narrative` is the primary, authoritative source and wins outright
 * whenever it structurally resolves to a valid 8-digit code — per NCBA's
 * guide it's the field meant to carry "Paybill account number, Customer
 * Name etc." (it may also be blank).
 *
 * `CustomerName` is consulted only as an explicit secondary checkpoint,
 * reached solely when Narrative is empty or does not structurally contain
 * a valid 8-digit code — it never overrides a Narrative match. This
 * matters because NCBA's guide documents it as overloaded free text that
 * can drift outside its nominal purpose ("name of the transaction
 * initiator... may be occupied with the transaction reference and the
 * phone number of the sender").
 *
 * `PhoneNr` is deliberately NOT consulted (dropped 2026-07-28, confirmed
 * live with NCBA's integration team) — during UAT they've been sending
 * PhoneNr as a real MSISDN or PayChain's settlement account number, never
 * a merchant code, and per their own guide it's meant to carry "phone
 * number of the transaction initiator." Treating it as a merchant-code
 * source risked misreading an actual phone number as an account
 * reference and misattributing the payment.
 *
 * Both fields are independently scanned up front (regardless of which one
 * ultimately wins) purely to detect disagreement: if they carry distinct
 * 8-digit runs, that's logged as a structural conflict for manual review,
 * since a payment that inconsistently quotes two different-looking
 * merchant codes is exactly the kind of case that leads to silent
 * misattribution. Narrative's priority still applies to which code is
 * actually used — the conflict log is a red flag, not a veto.
 *
 * Returns null (not a thrown error) if no field yields anything — the
 * caller should log this loudly, since it means a reconcilable credit
 * arrived that we couldn't attribute to any merchant.
 */
export function extractMerchantCode({ narrative, customerName, transId } = {}) {
  const narrativeCode = findEightDigitCode(narrative, { allowTwelveDigitFallback: true });
  const customerNameCode = findEightDigitCode(customerName);

  const distinctCandidates = new Set([narrativeCode, customerNameCode].filter(Boolean));
  if (distinctCandidates.size > 1) {
    logStructuralConflict({
      transId: transId ?? null,
      narrativeCode,
      customerNameCode,
    });
  }

  // Primary: Narrative is authoritative and wins outright when valid.
  if (narrativeCode) {
    return narrativeCode;
  }

  // Secondary checkpoint: only reached because Narrative was empty/blank
  // or structurally invalid (no 8-digit run found).
  if (customerNameCode) {
    return customerNameCode;
  }

  return null;
}

/**
 * NCBA's TransAmount is signed: positive = credit, negative = debit. This is
 * the one authoritative signal for transaction direction — it does NOT need
 * to be inferred from TransType.
 */
export function validateTransAmount(transAmount) {
  const value = Number(transAmount);
  if (!Number.isFinite(value) || value === 0) {
    throw new NcbaAccountNotificationError(`TransAmount must be a non-zero number, received "${transAmount}"`, 'INVALID_AMOUNT');
  }
  return Math.round(value * 100) / 100;
}

export function validateTransId(transId) {
  const id = String(transId ?? '').trim();
  if (!id || id.length > 64) {
    throw new NcbaAccountNotificationError('TransID is missing or malformed', 'INVALID_REFERENCE');
  }
  return id;
}

const KENYAN_MSISDN = /\b(254\d{9}|0\d{9})\b/;

// When no MSISDN is present to anchor where the name ends (the matched
// branch below already discards everything after it, channel code
// included), NCBA can still append its own trailing bank-channel code —
// e.g. "JACOB BRANDON OMUTITI 84076c2640d9". Strips a trailing
// whitespace-separated token only if it contains at least one digit — real
// human names don't contain digits, so this reliably catches a generated
// code without risking a false-positive strip of a genuine short trailing
// name token (the previously-observed all-letters "UG" channel code is
// left alone, matching prior behavior for that case).
function stripTrailingDigitCode(name) {
  if (!name) return name;
  const match = name.match(/^(.*?)\s+(\S*\d\S*)$/);
  if (match) return match[1].trim() || null;
  // No leading part to split off — if the whole string itself looks like a
  // channel code (contains a digit), there's no real name here at all.
  return /\d/.test(name) ? null : name;
}

/**
 * Best-effort split of NCBA's CustomerName field into { name, phone }.
 *
 * Observed live from real (non-test) NCBA collections — e.g.
 * "ROSE CHELANGAT SOY 254715237398 UG" — CustomerName carries the payer's
 * name followed by their MSISDN followed by a trailing bank-channel code
 * we don't need. This is more reliable in practice than PhoneNr: in the
 * same live traffic, PhoneNr has been observed carrying the Account
 * Number instead of a phone number (matches NCBA's own guide, which
 * documents PhoneNr as possibly "occupied with the account ncba number").
 *
 * Returns { name: string|null, phone: string|null } — either can be null
 * if the field is blank or doesn't contain a recognizable MSISDN; callers
 * should degrade gracefully (e.g. "a customer", or fall back to PhoneNr).
 */
export function parseNcbaCustomerField(customerName) {
  const str = String(customerName ?? '').trim();
  if (!str) return { name: null, phone: null };

  const match = str.match(KENYAN_MSISDN);
  if (!match) return { name: stripTrailingDigitCode(str), phone: null };

  const phone = match[1];
  const name = str.slice(0, match.index).trim() || null;
  return { name, phone };
}

/**
 * Last-resort MSISDN search over NCBA's free-text Narrative field — tried
 * only when neither CustomerName nor PhoneNr yielded a usable phone (see
 * ncbaAccountNotificationController.js). Some banks echo the payer's
 * number into the narrative/reference text even when the dedicated fields
 * don't carry it; costs nothing to check and never makes things worse,
 * since it's strictly a fallback after the two more reliable sources.
 *
 * @param {string} text
 * @returns {string|null}
 */
export function extractMsisdnFromText(text) {
  const match = String(text ?? '').match(KENYAN_MSISDN);
  return match ? match[1] : null;
}
