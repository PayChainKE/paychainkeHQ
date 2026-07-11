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

function findEightDigitCode(text) {
  const prefix = process.env.NCBA_INSTITUTION_PREFIX;
  const str = String(text ?? '');

  if (prefix && /^\d{4}$/.test(prefix)) {
    const fullAccountMatch = str.match(new RegExp(`${prefix}(\\d{8})`));
    if (fullAccountMatch) return fullAccountMatch[1];
  }

  const bareMatch = str.match(EIGHT_DIGIT_RUN);
  return bareMatch ? bareMatch[1] : null;
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
 * `PhoneNr` and `CustomerName` are consulted only as an explicit secondary
 * checkpoint, reached solely when Narrative is empty or does not
 * structurally contain a valid 8-digit code — they never override a
 * Narrative match. This matters because NCBA's guide documents both as
 * overloaded free text that can drift outside their nominal purpose:
 *   - PhoneNr: "phone number of the transaction initiator... may be
 *     occupied with the account ncba number... or may be blank"
 *   - CustomerName: "name of the transaction initiator... may be occupied
 *     with the transaction reference and the phone number of the sender"
 * PhoneNr is checked ahead of CustomerName in that checkpoint since it's
 * the more likely of the two to carry a numeric account reference.
 *
 * All three fields are independently scanned up front (regardless of which
 * one ultimately wins) purely to detect disagreement: if more than one
 * field carries a distinct 8-digit run, that's logged as a structural
 * conflict for manual review, since a payment that inconsistently quotes
 * two different-looking merchant codes across fields is exactly the kind
 * of case that leads to silent misattribution. Narrative's priority still
 * applies to which code is actually used — the conflict log is a red flag,
 * not a veto.
 *
 * Returns null (not a thrown error) if no field yields anything — the
 * caller should log this loudly, since it means a reconcilable credit
 * arrived that we couldn't attribute to any merchant.
 */
export function extractMerchantCode({ narrative, phoneNr, customerName, transId } = {}) {
  const narrativeCode = findEightDigitCode(narrative);
  const phoneCode = findEightDigitCode(phoneNr);
  const customerNameCode = findEightDigitCode(customerName);

  const distinctCandidates = new Set([narrativeCode, phoneCode, customerNameCode].filter(Boolean));
  if (distinctCandidates.size > 1) {
    logStructuralConflict({
      transId: transId ?? null,
      narrativeCode,
      phoneCode,
      customerNameCode,
    });
  }

  // Primary: Narrative is authoritative and wins outright when valid.
  if (narrativeCode) {
    return narrativeCode;
  }

  // Secondary checkpoint: only reached because Narrative was empty/blank
  // or structurally invalid (no 8-digit run found).
  if (phoneCode) {
    return phoneCode;
  }
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
