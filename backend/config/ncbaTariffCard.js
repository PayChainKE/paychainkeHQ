import { safaricomFeeFor } from './revenueRateCard.js';

// NCBA Virtual Account collection tariff — tiered banding. Replaces the
// previous flat 1% NCBA_COLLECTION_RATE.
//
// PayChain absorbs Safaricom's underlying cost per band and layers a fixed
// markup on top. The two are tracked separately (mirrors the existing
// paychainFee / safaricomFee split on Transaction):
//   - `safaricomFee` = the absorbed cost component. Not PayChain revenue —
//     it's what we pay away, we just don't pass it to the merchant.
//   - `markup`       = what PayChain actually keeps. This is what's stamped
//     into Transaction.paychainFee and what the admin Revenue dashboard
//     reports as earned revenue for this stream.
// The merchant is credited grossAmount minus the *combined* total — see
// getNcbaTariffBand() below and services/ncbaLedgerService.js.
//
// This table is the single source of truth for both the JS-side lookup
// (getNcbaTariffBand) and the MongoDB aggregation expression
// (ncbaMarkupMongoExpr, used by controllers/revenueController.js) — the
// tier boundaries only ever live here.
export const MAX_NCBA_COLLECTION_AMOUNT = 250_000;

const NCBA_TARIFF_BANDS = [
  { max: 100,     safaricomFee: 0,  markup: 0  },
  { max: 500,     safaricomFee: 5,  markup: 2  },
  { max: 1_000,   safaricomFee: 10, markup: 3  },
  { max: 1_500,   safaricomFee: 15, markup: 4  },
  { max: 2_500,   safaricomFee: 20, markup: 5  },
  { max: 3_500,   safaricomFee: 25, markup: 6  },
  { max: 5_000,   safaricomFee: 34, markup: 8  },
  { max: 7_500,   safaricomFee: 42, markup: 10 },
  { max: 10_000,  safaricomFee: 48, markup: 12 },
  { max: 15_000,  safaricomFee: 57, markup: 15 },
];

// Above KES 15,000 (up to MAX_NCBA_COLLECTION_AMOUNT): no more explicit
// bands — fall back to the published Safaricom tariff (SAFARICOM_TARIFF,
// already used for M-Pesa, extends to 500,000) plus a flat markup.
const ABOVE_TOP_BAND_MARKUP = 15;

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

  const band = NCBA_TARIFF_BANDS.find((b) => amount <= b.max);

  const safaricomFee = band ? band.safaricomFee : safaricomFeeFor(amount);
  const markup        = band ? band.markup : ABOVE_TOP_BAND_MARKUP;

  return {
    safaricomFee: round2(safaricomFee),
    markup: round2(markup),
    totalFee: round2(safaricomFee + markup),
  };
}

/**
 * MongoDB aggregation expression computing the NCBA markup (PayChain
 * revenue) for the "above top band" case only needs a flat constant — the
 * Safaricom-cost component isn't part of revenue, so it never needs to be
 * expressed in Mongo (see controllers/revenueController.js, where this
 * replaces the linear `$multiply: [kesAmount, stream.rate]` for the
 * `ncba_collection_fee` stream).
 *
 * @param {object} basisExpr - a Mongo aggregation expression yielding the KES basis for the doc.
 */
export function ncbaMarkupMongoExpr(basisExpr) {
  return {
    $switch: {
      branches: NCBA_TARIFF_BANDS.map((b) => ({
        case: { $lte: [basisExpr, b.max] },
        then: b.markup,
      })),
      default: ABOVE_TOP_BAND_MARKUP,
    },
  };
}
