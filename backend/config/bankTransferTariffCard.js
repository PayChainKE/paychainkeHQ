// Interbank Transfer Tariff Schedules (PesaLink, RTGS, 2026-08-12) —
// outbound bank transfers from a merchant's PayChain balance/Virtual
// Account (same underlying Merchant.kesBalance field — "Virtual Account"
// is the NCBA-provisioned account-number concept, not a separate ledger)
// to any commercial bank account in Kenya. Same shape as every other
// tariff card this session: every lookup returns
// { baseCost, serviceFee, totalFee }, where baseCost is NCBA's real
// Online/Mobile bank-charge pass-through and serviceFee is PayChain's own
// kept margin — both deducted from the merchant's balance alongside the
// transfer principal, via controllers/ncbaOpenBankingController.js's
// executeNcbaBankPayout (the standalone "Withdraw to Bank" endpoint) and
// controllers/bulkPayController.js's Bank payee rows.
//
// Does NOT cover IFT (NCBA-to-NCBA internal transfers, forced whenever the
// destination bank code is NCBA's own — see NCBA_OWN_BANK_CODE in
// ncbaOpenBankingController.js) — this tariff sheet is external-bank-only,
// so IFT stays fee-exempt exactly as it is today.
//
// PesaLink's 501-10,000 band (service markup given as a range, "47-97")
// had no real third-party cost sub-band to anchor an interpolation to —
// NCBA's real PesaLink charge is flat KES 50 across that whole row, same
// situation as every other tariff's compressed bands this session.
// Confirmed with the user (2026-08-12): 3 round tiers.
const PESALINK_BANDS = [
  { max: 500,      baseCost: 0,   serviceFee: 50  },
  { max: 3_500,    baseCost: 50,  serviceFee: 47  },
  { max: 7_000,    baseCost: 50,  serviceFee: 72  },
  { max: 10_000,   baseCost: 50,  serviceFee: 97  },
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

// RTGS — flat, any amount. NCBA's manual branch RTGS charge is KES 500,
// PayChain's automated rate is KES 300.
export const RTGS_BASE_COST = 300;
export const RTGS_SERVICE_FEE = 130;

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
