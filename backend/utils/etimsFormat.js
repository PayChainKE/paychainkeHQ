// Shared formatting helpers for KRA eTIMS OSCU payloads/receipts — kept in
// one place so etimsClient.js, invoicingService.js, reportService.js and
// receiptFormatter.js can never drift apart on money rounding or signature
// formatting.

// KRA requires every decimal amount formatted to exactly 2 decimal places.
// Rounding on the raw float (0.1 + 0.2 style drift) can silently shift a
// tax total by a cent across many line items, so round in integer cents
// first, then divide back down.
export function money2dp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function money2dpString(value) {
  return money2dp(value).toFixed(2);
}

// KRA returns rcptSign / intrlData as an unbroken alphanumeric string; the
// printed receipt must present it hyphenated every 4 characters, e.g.
// "TE68SLA234J5" -> "TE68-SLA2-34J5".
export function hyphenateEvery4(raw) {
  if (!raw) return '';
  return String(raw).match(/.{1,4}/g).join('-');
}

// Per the Technical Specification of TIS for OSCU/VSCU v2.0 (worked receipt
// examples, p.8/p.10): tin, bhfId, and the raw (unhyphenated) rcptSign are
// concatenated directly into the query string, not passed as separate
// key=value pairs. The path segment is "indexEtimsReceptData" (missing the
// "i" in "Receipt") in KRA's own published examples — not a typo to "fix",
// since a corrected spelling would 404 against KRA's real, deployed URL.
export function buildQrVerificationUrl(tin, bhfId, rcptSignRaw) {
  return `https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceptData?${tin}${bhfId}${rcptSignRaw || ''}`;
}

// KRA date fields are plain YYYYMMDD strings, not ISO timestamps.
export function formatKraDate(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// KRA datetime fields are YYYYMMDDHHmmss.
export function formatKraDateTime(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${formatKraDate(d)}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// KRA's published standard payment-type code list (selectCodeList
// classification "05"). Only the handful PayChain actually collects via
// are mapped here; anything else falls back to "07" (Other).
const PAYMENT_METHOD_TO_KRA_CODE = {
  cash: '01',
  card: '05',
  mobile_money: '06',
  other: '07',
};

export function paymentMethodToKraCode(paymentMethod) {
  return PAYMENT_METHOD_TO_KRA_CODE[paymentMethod] || PAYMENT_METHOD_TO_KRA_CODE.other;
}

// Human-readable label for a KRA pmtTyCd — TIS spec item 3.k requires
// "means of payment" appear on the receipt itself, not just be stored.
const PMT_TY_LABELS = { '01': 'Cash', '02': 'Credit', '03': 'Cash/Credit', '04': 'Bank Cheque', '05': 'Card', '06': 'Mobile Money', '07': 'Other' };
export function pmtTyCdLabel(pmtTyCd) {
  return PMT_TY_LABELS[pmtTyCd] || 'Other';
}

export const TAX_TYPE_CODES = ['A', 'B', 'C', 'D', 'E'];

// Short display labels for each tax type code — shared by every place that
// renders a receipt/invoice's tax-rate breakdown to a human.
export const TAX_LABELS = { A: 'EX', B: 'VAT16', C: 'ZERO', D: 'NON-VAT', E: 'VAT8' };

// KRA's fixed rate per tax type code, per the integration spec.
export const TAX_RATES = { A: 0, B: 0.16, C: 0, D: 0, E: 0.08 };

// Same rates, as the whole-number percentages KRA's taxRtA..taxRtE sales
// payload fields expect (16, not 0.16) — TIS spec item 6.20.4 requires the
// TIS be programmed with rates "A".."E" and print each on every receipt.
export const TAX_RATE_PERCENT = Object.fromEntries(
  TAX_TYPE_CODES.map((c) => [c, Math.round(TAX_RATES[c] * 100)])
);

// KRA's standard credit-note refund-reason codes (selectCodeList
// classification "06"). Only exposed as a named default here — a caller with
// a more specific reason can still pass their own code.
export const REFUND_REASON_CODES = {
  MISSING_QUANTITY: '01',
  MISSING_ITEM: '02',
  DAMAGED: '03',
  WRONG_TAX_TYPE: '04',
  OTHER: '05',
};
export const DEFAULT_REFUND_REASON_CODE = REFUND_REASON_CODES.OTHER;
