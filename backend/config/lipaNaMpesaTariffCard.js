// B2B PayBill & Till Payout Tariff Schedule (Outbound B2B Transfers,
// 2026-08-12) — PayChain B2B Lipa Na M-Pesa: business-initiated payouts
// from a merchant's PayChain balance/Virtual Account to any Safaricom Buy
// Goods Till or Business PayBill, via NCBA's Open Banking Lipa na M-Pesa
// Payment API (NCBA's replacement for Daraja B2B).
//
// Pricing rule (Brandon, 2026-08-30, revised same day): the merchant pays
// both the real NCBA + Safaricom B2B switching pass-through cost
// (`baseCost`) and PayChain's own kept margin (`serviceFee`) — same shape
// as config/bankTransferTariffCard.js and config/billPaymentTariffCard.js.
// Deducted from the paying business's PayChain balance alongside the
// transfer principal.
//
// Replaces the old flat KES 30 NCBA_LIPA_NA_MPESA_FLAT_FEE_KES (which was
// also never actually charged on Bulk Pay's Paybill/Till rows — only on
// the standalone single-payout endpoint, mpesaController.js#initiateB2B).
const LIPA_NA_MPESA_B2B_BANDS = [
  { max: 100,      baseCost: 0,  serviceFee: 0   },
  { max: 500,      baseCost: 5,  serviceFee: 5   },
  { max: 1_000,    baseCost: 7,  serviceFee: 8   },
  { max: 2_500,    baseCost: 10, serviceFee: 13  },
  { max: 5_000,    baseCost: 12, serviceFee: 15  },
  { max: 10_000,   baseCost: 15, serviceFee: 20  },
  { max: 20_000,   baseCost: 20, serviceFee: 37  },
  { max: 30_000,   baseCost: 25, serviceFee: 39  },
  { max: 40_000,   baseCost: 25, serviceFee: 47  },
  { max: 50_000,   baseCost: 25, serviceFee: 54  },
  { max: 100_000,  baseCost: 30, serviceFee: 56  },
  { max: 150_000,  baseCost: 30, serviceFee: 74  },
  { max: 200_000,  baseCost: 30, serviceFee: 92  },
  { max: 250_000,  baseCost: 30, serviceFee: 110 },
];

export const MAX_LIPA_NA_MPESA_B2B_AMOUNT = 250_000;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * @param {number} amount
 * @returns {{ baseCost: number, serviceFee: number, totalFee: number }}
 */
export function getLipaNaMpesaTariff(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { baseCost: 0, serviceFee: 0, totalFee: 0 };
  }
  const band = LIPA_NA_MPESA_B2B_BANDS.find((b) => value <= b.max) || LIPA_NA_MPESA_B2B_BANDS[LIPA_NA_MPESA_B2B_BANDS.length - 1];
  return {
    baseCost: round2(band.baseCost),
    serviceFee: round2(band.serviceFee),
    totalFee: round2(band.baseCost + band.serviceFee),
  };
}
