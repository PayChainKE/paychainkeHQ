import { safaricomFeeFor } from './revenueRateCard.js';
import { RAW_C2B_FLAT_MARKUP_KES } from '../utils/pricingEngine.js';

// NCBA Virtual Account collection tariff.
//
// PayChain absorbs Safaricom's underlying cost per band (a real cost
// PayChain pays away, not revenue) and layers its own flat markup on top.
// The two are tracked separately (mirrors the existing paychainFee /
// safaricomFee split on Transaction):
//   - `safaricomFee` = the absorbed cost component. Not PayChain revenue —
//     it's what we pay away, we just don't pass it to the merchant. Still
//     tiered by amount, since that cost genuinely scales with amount.
//   - `markup`       = what PayChain actually keeps. This is what's stamped
//     into Transaction.paychainFee and what the admin Revenue dashboard
//     reports as earned revenue for this stream. Flat KES
//     RAW_C2B_FLAT_MARKUP_KES on every collection, matching the same flat
//     fee already charged on the direct-Safaricom C2B rail
//     (mpesaController.js#confirmationURL) — was previously its own tiered
//     table here (0-15 KES, i.e. literally KES 0 for amounts under 100),
//     which silently fell out of sync when the rest of the platform moved
//     to "flat KES 5 only" and meant this rail — the one actually used for
//     this merchant's real paybill+account payments — kept undercharging
//     or not charging at all.
// The merchant is credited grossAmount minus the *combined* total — see
// getNcbaTariffBand() below and services/ncbaLedgerService.js.
//
// This table is the single source of truth for both the JS-side lookup
// (getNcbaTariffBand) and the MongoDB aggregation expression
// (ncbaMarkupMongoExpr, used by controllers/revenueController.js) — the
// tier boundaries only ever live here.
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
 * Look up the tiered NCBA collection fee for a given gross amount.
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
  const markup        = RAW_C2B_FLAT_MARKUP_KES;

  return {
    safaricomFee: round2(safaricomFee),
    markup: round2(markup),
    totalFee: round2(safaricomFee + markup),
  };
}

/**
 * MongoDB aggregation expression computing the NCBA markup (PayChain
 * revenue) — now just the flat RAW_C2B_FLAT_MARKUP_KES constant for every
 * doc, no longer banded (see the module comment above for why).
 *
 * @param {object} _basisExpr - unused now that the markup is flat; kept so
 *        call sites (controllers/revenueController.js) don't need to change.
 */
export function ncbaMarkupMongoExpr(_basisExpr) {
  return RAW_C2B_FLAT_MARKUP_KES;
}
