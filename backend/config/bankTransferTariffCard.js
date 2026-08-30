// Interbank Transfer Tariff Schedules (PesaLink, RTGS, 2026-08-12) —
// outbound bank transfers from a merchant's PayChain balance/Virtual
// Account (same underlying Merchant.kesBalance field — "Virtual Account"
// is the NCBA-provisioned account-number concept, not a separate ledger)
// to any commercial bank account in Kenya.
//
// Pricing rule (Brandon, 2026-08-30, revised same day): the merchant pays
// both NCBA's real pass-through cost (`baseCost`) and PayChain's own kept
// margin (`serviceFee`) on every outbound bank transfer — same as every
// other money-out rail (see the identical shape in
// config/lipaNaMpesaTariffCard.js, config/billPaymentTariffCard.js, and
// config/mpesaB2cTariffCard.js). Money IN (config/ncbaTariffCard.js) stays
// merchant-free — that's a separate, still-standing policy. Deducted from
// the merchant's balance alongside the transfer principal, via
// controllers/ncbaOpenBankingController.js's executeNcbaBankPayout (the
// standalone "Withdraw to Bank" endpoint) and
// controllers/bulkPayController.js's Bank payee rows.
//
// Does NOT cover IFT (NCBA-to-NCBA internal transfers, forced whenever the
// destination bank code is NCBA's own — see NCBA_OWN_BANK_CODE in
// ncbaOpenBankingController.js) — this tariff sheet is external-bank-only,
// so IFT stays fee-exempt exactly as it is today.
const PESALINK_BANDS = [
  { max: 500,      baseCost: 0,   serviceFee: 50  },
  { max: 3_500,    baseCost: 50,  serviceFee: 20  },
  { max: 7_000,    baseCost: 50,  serviceFee: 38  },
  { max: 10_000,   baseCost: 50,  serviceFee: 50  },
  { max: 250_000,  baseCost: 100, serviceFee: 110 },
];

export const MAX_PESALINK_AMOUNT = 250_000;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getPesaLinkTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const band = PESALINK_BANDS.find((b) => value <= b.max) || PESALINK_BANDS[PESALINK_BANDS.length - 1];
  return {
    baseCost: round2(band.baseCost),
    serviceFee: round2(band.serviceFee),
    totalFee: round2(band.baseCost + band.serviceFee),
  };
}

// RTGS — flat, any amount. Real NCBA cost is KES 300; per Brandon
// (2026-08-30), total charged to the merchant is fixed at KES 400 rather
// than cost+the standard KES 130 margin (which would total 430) — so
// PayChain's kept margin on RTGS is KES 100, not 130.
export const RTGS_BASE_COST = 300;
export const RTGS_SERVICE_FEE = 100;

/** @returns {{ baseCost: number, serviceFee: number, totalFee: number }} */
export function getRtgsTariff() {
  return {
    baseCost: RTGS_BASE_COST,
    serviceFee: RTGS_SERVICE_FEE,
    totalFee: round2(RTGS_BASE_COST + RTGS_SERVICE_FEE),
  };
}

/**
 * Dispatch by rail — the single place callers look up "what does this
 * transfer cost" without needing their own pesalink/rtgs branching.
 * Unrecognized rail (e.g. 'ift', 'eft', null) returns zero fee — this
 * tariff doesn't cover those, matching today's actual (unpriced) behavior.
 * EFT was removed as a supported rail (2026-08-13) — NCBA's EFT endpoint
 * rejected the confirmed PesaLink bank code with BIC_NOT_FOUND and no
 * working code/format was found; PesaLink and RTGS both work.
 *
 * @param {'pesalink'|'rtgs'|string|null} rail
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getBankTransferTariff(rail, amount) {
  if (rail === 'rtgs') return getRtgsTariff();
  if (rail === 'pesalink') return getPesaLinkTariff(amount);
  return { baseCost: 0, serviceFee: 0, totalFee: 0 };
}
