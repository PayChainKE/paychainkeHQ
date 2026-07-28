// Safaricom's official M-PESA B2C ("Business Bouquet") tariff — the
// standard business-pays charge for B2C transfers to registered M-Pesa
// users (customer pays 0, business bears the full charge). Source:
// Safaricom's own published tariff sheet, "M-PESA B2C PAYMENTS TO
// REGISTERED USERS" (mpesa-b2c-registered-users.pdf), the base table —
// not the "withdrawal charges paid" variant, where the business also
// covers the recipient's cash-out fee (an optional premium add-on, not
// the standard tariff).
//
// This is a pure passthrough of Safaricom's real cost for now — PayChain's
// own margin on top isn't decided yet, tracked here as an explicit
// PAYCHAIN_B2C_MARKUP constant (currently 0) so adding it later is a
// one-line change rather than a restructure. Mirrors the safaricomFee /
// markup split already used in config/ncbaTariffCard.js.
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

export const MAX_B2C_AMOUNT = 250_000;

// Not charged yet — see file header. Named and exported so it's easy to
// find and change once PayChain's own B2C rate is decided.
export const PAYCHAIN_B2C_MARKUP = 0;

export class B2cTariffBoundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'B2cTariffBoundsError';
  }
}

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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

  return {
    safaricomFee: round2(safaricomFee),
    markup: round2(PAYCHAIN_B2C_MARKUP),
    totalFee: round2(safaricomFee + PAYCHAIN_B2C_MARKUP),
  };
}
