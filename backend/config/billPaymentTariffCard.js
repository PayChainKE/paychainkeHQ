import { getTariffBands, getTariffFlat } from '../services/tariffCardCache.js';

// PayChain Bill Payments — KPLC (Prepaid & Postpaid), NCWSC (Nairobi
// Water), Internet, and Rent Settlements, all settled from Bulk Pay
// (Standard Bill Payment Tariff Schedule, 2026-08-12).
//
// Pricing rule (Brandon, 2026-08-30, revised same day): the merchant pays
// both the real third-party (bank/aggregator) pass-through cost
// (`baseCost`, hardcoded/fixed) and PayChain's own kept margin
// (`serviceFee`, admin-editable via the Transaction Tariffs page — see
// services/tariffCardCache.js) on every bill payment — same shape as
// config/bankTransferTariffCard.js and config/lipaNaMpesaTariffCard.js.
// The whole totalFee is deducted from the merchant's PayChain balance
// alongside the bill principal — see controllers/bulkPayController.js.

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// ── KPLC Prepaid Tokens — tiered ─────────────────────────────────────────
const KPLC_PREPAID_BANDS_DEFAULT = [
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

export function getKplcPrepaidServiceFeeBands() {
  return getTariffBands(
    'kplc_prepaid_service_fee',
    KPLC_PREPAID_BANDS_DEFAULT.map((b) => ({ max: b.max, fee: b.serviceFee }))
  );
}

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getKplcPrepaidTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const baseBand = KPLC_PREPAID_BANDS_DEFAULT.find((b) => value <= b.max) || KPLC_PREPAID_BANDS_DEFAULT[KPLC_PREPAID_BANDS_DEFAULT.length - 1];
  const feeBands = getKplcPrepaidServiceFeeBands();
  const feeBand = feeBands.find((b) => value <= b.max) || feeBands[feeBands.length - 1];
  return {
    baseCost: round2(baseBand.baseCost),
    serviceFee: round2(feeBand.fee),
    totalFee: round2(baseBand.baseCost + feeBand.fee),
  };
}

// ── KPLC Postpaid Bill — flat, any amount ────────────────────────────────
export const KPLC_POSTPAID_BASE_COST = 10;
const KPLC_POSTPAID_SERVICE_FEE_DEFAULT = 27;

export function getKplcPostpaidServiceFee() {
  return getTariffFlat('kplc_postpaid_service_fee', KPLC_POSTPAID_SERVICE_FEE_DEFAULT);
}

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getKplcPostpaidTariff() {
  const serviceFee = getKplcPostpaidServiceFee();
  return {
    baseCost: KPLC_POSTPAID_BASE_COST,
    serviceFee,
    totalFee: round2(KPLC_POSTPAID_BASE_COST + serviceFee),
  };
}

// ── NCWSC (Nairobi Water) — flat, any amount ─────────────────────────────
export const NCWSC_BASE_COST = 10;
const NCWSC_SERVICE_FEE_DEFAULT = 27;

export function getNcwscServiceFee() {
  return getTariffFlat('ncwsc_service_fee', NCWSC_SERVICE_FEE_DEFAULT);
}

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getNcwscTariff() {
  const serviceFee = getNcwscServiceFee();
  return {
    baseCost: NCWSC_BASE_COST,
    serviceFee,
    totalFee: round2(NCWSC_BASE_COST + serviceFee),
  };
}

// ── Internet (Zuku/Fibre/etc.) — flat, any amount ────────────────────────
// Not yet wired to a real Bulk Pay category: Internet doesn't exist as a
// Payee type today (only decorative, non-functional buttons in the
// frontend — see the merchant-dashboard/mobile-app/demo BulkPay pages).
// Kept here, verified against the tariff sheet, ready for when that
// category is actually built. Still admin-editable even while dormant —
// harmless, and one less thing to remember to wire up later.
export const INTERNET_BASE_COST = 10;
const INTERNET_SERVICE_FEE_DEFAULT = 40;

export function getInternetServiceFee() {
  return getTariffFlat('internet_service_fee', INTERNET_SERVICE_FEE_DEFAULT);
}

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getInternetTariff() {
  const serviceFee = getInternetServiceFee();
  return {
    baseCost: INTERNET_BASE_COST,
    serviceFee,
    totalFee: round2(INTERNET_BASE_COST + serviceFee),
  };
}

// ── Rent Settlements — tiered ─────────────────────────────────────────────
// Same "not yet wired to a real category" situation as Internet above.
const RENT_SETTLEMENT_BANDS_DEFAULT = [
  { max: 10_000,   baseCost: 15, serviceFee: 52  },
  { max: 20_000,   baseCost: 25, serviceFee: 75  },
  { max: 35_000,   baseCost: 25, serviceFee: 125 },
  { max: 50_000,   baseCost: 25, serviceFee: 175 },
  { max: 250_000,  baseCost: 35, serviceFee: 165 },
];

export function getRentServiceFeeBands() {
  return getTariffBands(
    'rent_service_fee',
    RENT_SETTLEMENT_BANDS_DEFAULT.map((b) => ({ max: b.max, fee: b.serviceFee }))
  );
}

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getRentTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const baseBand = RENT_SETTLEMENT_BANDS_DEFAULT.find((b) => value <= b.max) || RENT_SETTLEMENT_BANDS_DEFAULT[RENT_SETTLEMENT_BANDS_DEFAULT.length - 1];
  const feeBands = getRentServiceFeeBands();
  const feeBand = feeBands.find((b) => value <= b.max) || feeBands[feeBands.length - 1];
  return {
    baseCost: round2(baseBand.baseCost),
    serviceFee: round2(feeBand.fee),
    totalFee: round2(baseBand.baseCost + feeBand.fee),
  };
}
