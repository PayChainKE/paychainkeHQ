// PayChain Bill Payments — KPLC (Prepaid & Postpaid), NCWSC (Nairobi
// Water), Internet, and Rent Settlements, all settled from Bulk Pay
// (Standard Bill Payment Tariff Schedule, 2026-08-12).
//
// Pricing rule (Brandon, 2026-08-30, revised same day): the merchant pays
// both the real third-party (bank/aggregator) pass-through cost
// (`baseCost`) and PayChain's own kept margin (`serviceFee`) on every bill
// payment — same shape as config/bankTransferTariffCard.js and
// config/lipaNaMpesaTariffCard.js. The whole totalFee is deducted from the
// merchant's PayChain balance alongside the bill principal — see
// controllers/bulkPayController.js.

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// ── KPLC Prepaid Tokens — tiered ─────────────────────────────────────────
export const KPLC_PREPAID_BANDS = [
  { max: 500,      baseCost: 5,  serviceFee: 7  },
  { max: 2_000,    baseCost: 5,  serviceFee: 12 },
  { max: 4_000,    baseCost: 10, serviceFee: 19 },
  { max: 7_000,    baseCost: 10, serviceFee: 29 },
  { max: 10_000,   baseCost: 10, serviceFee: 40 },
  { max: 25_000,   baseCost: 15, serviceFee: 42 },
  { max: 50_000,   baseCost: 15, serviceFee: 51 },
  { max: 100_000,  baseCost: 15, serviceFee: 60 },
  { max: 250_000,  baseCost: 15, serviceFee: 69 },
];

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getKplcPrepaidTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const band = KPLC_PREPAID_BANDS.find((b) => value <= b.max) || KPLC_PREPAID_BANDS[KPLC_PREPAID_BANDS.length - 1];
  return {
    baseCost: round2(band.baseCost),
    serviceFee: round2(band.serviceFee),
    totalFee: round2(band.baseCost + band.serviceFee),
  };
}

// ── KPLC Postpaid Bill — flat, any amount ────────────────────────────────
export const KPLC_POSTPAID_BASE_COST = 10;
export const KPLC_POSTPAID_SERVICE_FEE = 27;

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getKplcPostpaidTariff() {
  return {
    baseCost: KPLC_POSTPAID_BASE_COST,
    serviceFee: KPLC_POSTPAID_SERVICE_FEE,
    totalFee: round2(KPLC_POSTPAID_BASE_COST + KPLC_POSTPAID_SERVICE_FEE),
  };
}

// ── NCWSC (Nairobi Water) — flat, any amount ─────────────────────────────
export const NCWSC_BASE_COST = 10;
export const NCWSC_SERVICE_FEE = 27;

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getNcwscTariff() {
  return {
    baseCost: NCWSC_BASE_COST,
    serviceFee: NCWSC_SERVICE_FEE,
    totalFee: round2(NCWSC_BASE_COST + NCWSC_SERVICE_FEE),
  };
}

// ── Internet (Zuku/Fibre/etc.) — flat, any amount ────────────────────────
// Not yet wired to a real Bulk Pay category: Internet doesn't exist as a
// Payee type today (only decorative, non-functional buttons in the
// frontend — see the merchant-dashboard/mobile-app/demo BulkPay pages).
// Kept here, verified against the tariff sheet, ready for when that
// category is actually built.
export const INTERNET_BASE_COST = 10;
export const INTERNET_SERVICE_FEE = 40;

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getInternetTariff() {
  return {
    baseCost: INTERNET_BASE_COST,
    serviceFee: INTERNET_SERVICE_FEE,
    totalFee: round2(INTERNET_BASE_COST + INTERNET_SERVICE_FEE),
  };
}

// ── Rent Settlements — tiered ─────────────────────────────────────────────
// Same "not yet wired to a real category" situation as Internet above.
export const RENT_SETTLEMENT_BANDS = [
  { max: 10_000,   baseCost: 15, serviceFee: 52  },
  { max: 20_000,   baseCost: 25, serviceFee: 75  },
  { max: 35_000,   baseCost: 25, serviceFee: 125 },
  { max: 50_000,   baseCost: 25, serviceFee: 175 },
  { max: 250_000,  baseCost: 35, serviceFee: 165 },
];

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getRentTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const band = RENT_SETTLEMENT_BANDS.find((b) => value <= b.max) || RENT_SETTLEMENT_BANDS[RENT_SETTLEMENT_BANDS.length - 1];
  return {
    baseCost: round2(band.baseCost),
    serviceFee: round2(band.serviceFee),
    totalFee: round2(band.baseCost + band.serviceFee),
  };
}
