import { safaricomFeeFor } from './revenueRateCard.js';
import { RAW_C2B_FLAT_MARKUP_KES, FLAT_FEE_FREE_TIER_MAX_KES } from '../utils/pricingEngine.js';

// NCBA Virtual Account collection tariff.
//
// PayChain absorbs Safaricom's underlying cost per band (a real cost
// PayChain pays away, not revenue) and layers its own margin on top. The
// two are tracked separately (mirrors the existing paychainFee /
// safaricomFee split on Transaction):
//   - `safaricomFee` = the absorbed cost component. Not PayChain revenue —
//     it's what we pay away, we just don't pass it to the merchant. Tiered
//     by amount, since that real cost genuinely scales with amount.
//   - `markup`       = what PayChain actually keeps. This is what's
//     stamped into Transaction.paychainFee and what the admin Revenue
//     dashboard reports as earned revenue for this stream.
//
// markup = safaricomFee + RAW_C2B_FLAT_MARKUP_KES (a flat KES margin on
// top of whatever cost PayChain absorbed for that band), not a flat
// constant on its own. A flat-only markup — what this used to be — meant
// every collection above a few hundred KES cost PayChain more to absorb
// than it earned (safaricomFee grows with amount; a flat markup doesn't),
// so the whole NCBA rail was quietly running at a loss for its larger
// transactions. Scaling markup with the absorbed cost guarantees a
// constant, real KES 5 margin no matter the amount. Free (both zero) at
// or below FLAT_FEE_FREE_TIER_MAX_KES, matching every other rail.
//
// The merchant is credited grossAmount minus the *combined* total — see
// getNcbaTariffBand() below and services/ncbaLedgerService.js.
export const MAX_NCBA_COLLECTION_AMOUNT = 250_000;

const NCBA_SAFARICOM_FEE_BANDS = [
  { max: 100,     safaricomFee: 0  },
  { max: 500,     safaricomFee: 5  },
  { max: 1_000,   safaricomFee: 10 },
  { max: 1_500,   safaricomFee: 15 },
  { max: 2_500,   safaricomFee: 20 },
  { max: 3_500,   safaricomFee: 25 },
  { max: 5_000,   safaricomFee: 34 },
  { max: 7_500,   safaricomFee: 42 },
  { max: 10_000,  safaricomFee: 48 },
  { max: 15_000,  safaricomFee: 57 },
];

export class NcbaTariffBoundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaTariffBoundsError';
  }
}

// Standard financial rounding: half away from zero, to 2dp. All inputs here
// are already integers, but every downstream KES amount in this pipeline is
// rounded via this same helper for consistency.
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Look up the NCBA collection fee for a given gross amount — the absorbed
 * Safaricom-side cost (tiered) plus PayChain's own margin on top of it
 * (flat KES 5, scaling with the cost so it's never smaller than what was
 * absorbed). Free (0/0) at or below FLAT_FEE_FREE_TIER_MAX_KES.
 *
 * @param {number} grossAmount
 * @returns {{ safaricomFee: number, markup: number, totalFee: number }}
 * @throws {NcbaTariffBoundsError} if grossAmount is non-positive, non-finite,
 *         or exceeds MAX_NCBA_COLLECTION_AMOUNT.
 */
export function getNcbaTariffBand(grossAmount) {
  const amount = Number(grossAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new NcbaTariffBoundsError(`grossAmount must be a positive number, received "${grossAmount}"`);
  }
  if (amount > MAX_NCBA_COLLECTION_AMOUNT) {
    throw new NcbaTariffBoundsError(
      `grossAmount KES ${amount} exceeds the maximum NCBA collection limit of KES ${MAX_NCBA_COLLECTION_AMOUNT}`
    );
  }

  const band = NCBA_SAFARICOM_FEE_BANDS.find((b) => amount <= b.max);
  const safaricomFee = band ? band.safaricomFee : safaricomFeeFor(amount);
  const markup = amount <= FLAT_FEE_FREE_TIER_MAX_KES ? 0 : round2(safaricomFee + RAW_C2B_FLAT_MARKUP_KES);

  return {
    safaricomFee: round2(safaricomFee),
    markup,
    totalFee: round2(safaricomFee + markup),
  };
}
