// M-Pesa B2C ("Business Bouquet") payouts — merchant withdrawals to a
// registered M-Pesa number. Also used for NCBA Mobile B2W (see
// utils/feeCalculator.js's ncba_mobile_b2w branch).
//
// Pricing rule (Brandon, 2026-08-30, revised same day): the merchant pays
// both Safaricom's real B2C cost (B2C_REGISTERED_USER_BANDS, source:
// Safaricom's own published tariff sheet, "M-PESA B2C PAYMENTS TO
// REGISTERED USERS") and PayChain's own tiered service fee
// (B2C_SERVICE_FEE_BANDS, Mobile Withdrawal Tariff Schedule, 2026-08-12).
// Note the free threshold here is KES 49 (not the platform's usual KES 100
// FLAT_FEE_FREE_TIER_MAX_KES) — Mobile Withdrawal has its own cutoff per
// the tariff sheet, charging KES 5 from KES 50 already.
const B2C_REGISTERED_USER_BANDS = [
  { max: 49,      safaricomFee: 0  },
  { max: 100,     safaricomFee: 0  },
  { max: 500,     safaricomFee: 5  },
  { max: 1_000,   safaricomFee: 5  },
  { max: 1_500,   safaricomFee: 5  },
  { max: 2_500,   safaricomFee: 9  },
  { max: 3_500,   safaricomFee: 9  },
  { max: 5_000,   safaricomFee: 9  },
  { max: 7_500,   safaricomFee: 11 },
  { max: 10_000,  safaricomFee: 11 },
  { max: 15_000,  safaricomFee: 11 },
  { max: 20_000,  safaricomFee: 11 },
  { max: 25_000,  safaricomFee: 13 },
  { max: 30_000,  safaricomFee: 13 },
  { max: 35_000,  safaricomFee: 13 },
  { max: 40_000,  safaricomFee: 13 },
  { max: 45_000,  safaricomFee: 13 },
  { max: 50_000,  safaricomFee: 13 },
  { max: 70_000,  safaricomFee: 13 },
  { max: 250_000, safaricomFee: 13 },
];

const B2C_SERVICE_FEE_BANDS = [
  { max: 49,      fee: 0   },
  { max: 100,     fee: 5   },
  { max: 500,     fee: 6   },
  { max: 1_000,   fee: 12  },
  { max: 1_500,   fee: 19  },
  { max: 2_500,   fee: 20  },
  { max: 3_500,   fee: 25  },
  { max: 5_000,   fee: 28  },
  { max: 7_500,   fee: 46  },
  { max: 10_000,  fee: 56  },
  { max: 20_000,  fee: 73  },
  { max: 50_000,  fee: 100 },
  { max: 100_000, fee: 150 },
  { max: 250_000, fee: 200 },
];

export const MAX_B2C_AMOUNT = 250_000;

export class B2cTariffBoundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'B2cTariffBoundsError';
  }
}

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * PayChain's own tiered service fee on a Mobile Withdrawal — the B2C
 * analogue of pricingEngine.js's calculateCustomerSurcharge, banded per
 * B2C_SERVICE_FEE_BANDS above.
 *
 * @param {number} amount
 * @returns {number} fee in KES, rounded to 2dp.
 */
export function calculateB2cServiceFee(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const band = B2C_SERVICE_FEE_BANDS.find((b) => value <= b.max) || B2C_SERVICE_FEE_BANDS[B2C_SERVICE_FEE_BANDS.length - 1];
  return round2(band.fee);
}

/**
 * Look up the M-Pesa B2C tariff for a given payout amount. `safaricomFee`
 * is Safaricom's real cost, `markup` is PayChain's own kept margin —
 * `totalFee` (both combined) is what's actually deducted from the merchant.
 *
 * @param {number} amount
 * @returns {{ safaricomFee: number, markup: number, totalFee: number }}
 * @throws {B2cTariffBoundsError} if amount is non-positive, non-finite, or
 *         exceeds MAX_B2C_AMOUNT (Safaricom's own B2C ceiling).
 */
export function getB2cTariff(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new B2cTariffBoundsError(`amount must be a positive number, received "${amount}"`);
  }
  if (value > MAX_B2C_AMOUNT) {
    throw new B2cTariffBoundsError(`amount KES ${value} exceeds the maximum B2C limit of KES ${MAX_B2C_AMOUNT}`);
  }

  const band = B2C_REGISTERED_USER_BANDS.find((b) => value <= b.max);
  const safaricomFee = band.safaricomFee;
  const markup = calculateB2cServiceFee(value);

  return {
    safaricomFee: round2(safaricomFee),
    markup: round2(markup),
    totalFee: round2(safaricomFee + markup),
  };
}

// Mongo-side equivalent of `markup` above, for controllers/revenueController.js's
// per-stream aggregation (which prices from a Mongo expression rather than
// re-reading the stored Transaction.paychainFee field) — mirrors
// pricingEngine.js#mpesaMerchantFeeMongoExpr's $switch pattern now that the
// markup is tiered rather than a flat literal. `basisExpr` is whatever Mongo
// expression yields the per-doc KES basis (the withdrawal amount).
export function mpesaB2cMarkupMongoExpr(basisExpr) {
  return {
    $switch: {
      branches: B2C_SERVICE_FEE_BANDS.map((b) => ({
        case: { $lte: [basisExpr, b.max] },
        then: b.fee,
      })),
      default: B2C_SERVICE_FEE_BANDS[B2C_SERVICE_FEE_BANDS.length - 1].fee,
    },
  };
}
