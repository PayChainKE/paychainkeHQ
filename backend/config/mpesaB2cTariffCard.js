// Safaricom's official M-PESA B2C ("Business Bouquet") tariff — the
// standard business-pays charge for B2C transfers to registered M-Pesa
// users (customer pays 0, business bears the full charge). Source:
// Safaricom's own published tariff sheet, "M-PESA B2C PAYMENTS TO
// REGISTERED USERS" (mpesa-b2c-registered-users.pdf), the base table —
// not the "withdrawal charges paid" variant, where the business also
// covers the recipient's cash-out fee (an optional premium add-on, not
// the standard tariff).
//
// PayChain's own service fee on top of Safaricom's real cost — tracked
// here as the tiered B2C_SERVICE_FEE_BANDS table (Mobile Withdrawal
// Tariff Schedule, 2026-08-12) so every place that debits or reports a
// B2C fee (initiateB2C, bulk pay's Mobile Money rows, the revenue
// dashboard) reads the same numbers. Mirrors the safaricomFee / markup
// split already used in config/ncbaTariffCard.js.
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

// PayChain's own tiered service fee — replaces the old flat KES 10 margin.
// Note the free threshold here is KES 49 (not the platform's usual KES 100
// FLAT_FEE_FREE_TIER_MAX_KES) — Mobile Withdrawal has its own cutoff per
// the tariff sheet, charging KES 5 from KES 50 already. Doesn't need to
// share breakpoints with B2C_REGISTERED_USER_BANDS above: unlike the STK/QR
// tariff, Safaricom's real B2C cost is already flat (KES 13) across the
// entire 20,001-250,000 range, so there's no real cost sub-band for the
// sheet's compressed "KES 100-200" top row to anchor to. That range was
// confirmed (2026-08-12) as three even round tiers instead: KES 100 up to
// 50,000, KES 150 up to 100,000, KES 200 above that.
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
 * Look up the standard M-Pesa B2C tariff for a given payout amount.
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
