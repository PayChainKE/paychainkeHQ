// Single source of truth for PayChain's revenue model. Two layers:
//
//   1. SAFARICOM_TARIFF — Safaricom's published M-Pesa tariff. This is a
//      pass-through cost; PayChain does not keep it. We surface it so the
//      admin can see what the *customer* paid in total.
//
//   2. REVENUE_STREAMS — what PayChain actually earns. The headline rule
//      is "+0.5% on every transaction, on top of whatever Safaricom
//      charges". Plus a 2% spread on FX conversions (matches the standard
//      stablecoin off-ramp rate used by Kotani Pay / HoneyCoin).
//
// Rate edits happen here — every aggregator, P&L export and board report
// reads from this file.

// ── Safaricom standard tariff (Send Money / PayBill) ──────────────────
// Source: Safaricom public M-Pesa tariff (KES). Pass-through cost — the
// sender pays this to Safaricom, never to PayChain. Used purely for
// transparency in the admin Revenue page.
export const SAFARICOM_TARIFF = [
  { max: 49,      fee: 0   },
  { max: 100,     fee: 0   },
  { max: 500,     fee: 7   },
  { max: 1000,    fee: 13  },
  { max: 1500,    fee: 23  },
  { max: 2500,    fee: 33  },
  { max: 3500,    fee: 53  },
  { max: 5000,    fee: 57  },
  { max: 7500,    fee: 78  },
  { max: 10000,   fee: 90  },
  { max: 15000,   fee: 100 },
  { max: 20000,   fee: 105 },
  { max: 35000,   fee: 108 },
  { max: 50000,   fee: 108 },
  { max: 150000,  fee: 108 },
  { max: 250000,  fee: 108 },
  { max: 500000,  fee: 108 },
];

export function safaricomFeeFor(kesAmount) {
  const v = Number(kesAmount) || 0;
  if (v <= 0) return 0;
  for (const tier of SAFARICOM_TARIFF) {
    if (v <= tier.max) return tier.fee;
  }
  return SAFARICOM_TARIFF[SAFARICOM_TARIFF.length - 1].fee;
}

// ── PayChain headline rate ────────────────────────────────────────────
// Applied to every transaction PayChain processes (inbound, outbound,
// bulk pay, settlement). On top of the Safaricom tariff for M-Pesa
// transactions. This is the universal margin line.
export const PAYCHAIN_TXN_RATE    = 0.005;  // 0.50%
export const FX_SPREAD_RATE       = 0.020;  // 2.00% — Kotani / HoneyCoin standard
export const CASH_ADVANCE_RATE    = 0.025;  // 2.50% — pilot product
// NCBA Virtual Account collections no longer use a flat linear rate — see
// config/ncbaTariffCard.js for the tiered Safaricom-cost + markup bands.

// ── Revenue streams ───────────────────────────────────────────────────
// Each stream maps to one or more transaction-type buckets; the aggregator
// multiplies the per-doc KES basis by `rate` and sums.
export const REVENUE_STREAMS = [
  {
    id: 'transaction_fee',
    label: 'Transaction Fee',
    description: 'PayChain charges 0.50% on every inbound paybill receipt — applied on top of the standard Safaricom tariff.',
    icon: 'point_of_sale',
    accent: 'emerald',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['inbound'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    passthrough: 'safaricom',
  },
  {
    id: 'fx_spread',
    label: 'FX Spread / Conversion',
    description: 'On-chain KES ↔ USDC conversions. 2.00% spread — aligned to standard stablecoin off-ramp rates (Kotani Pay, HoneyCoin).',
    icon: 'currency_exchange',
    accent: 'pink',
    rate: FX_SPREAD_RATE,
    minFee: 0,
    txTypes: ['fx_swap'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'stablecoin_payment',
    label: 'Stablecoin Payment Fee',
    description: 'PayChain margin on USDC outbound payments — settlements, cross-border B2B, supplier payouts, bulk pay.',
    icon: 'paid',
    accent: 'blue',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['outbound', 'bulk_pay'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    passthrough: 'safaricom',
  },
  {
    id: 'settlement_fee',
    label: 'Settlement Fee',
    description: 'PayChain margin on KES off-ramp settlements to merchant bank or mobile money. Safaricom B2C tariff passes through to the merchant.',
    icon: 'account_balance_wallet',
    accent: 'amber',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['settlement'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    passthrough: 'safaricom',
  },
  {
    id: 'ncba_collection_fee',
    label: 'NCBA Collection Fee',
    description: 'Tiered Safaricom-style tariff on every inbound NCBA Virtual Account collection — PayChain absorbs the underlying Safaricom cost per band and keeps a fixed markup. No single rate; see config/ncbaTariffCard.js.',
    icon: 'account_balance',
    accent: 'teal',
    tiered: true,
    rate: null,
    minFee: 0,
    txTypes: ['ncba_inbound'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_disbursement_fee',
    label: 'NCBA Disbursement Fee',
    description: 'PayChain margin on outbound NCBA bulk disbursements (supplier payments, KPLC/water utility payouts) routed via NCBA Host-to-Host.',
    icon: 'account_balance',
    accent: 'blue',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['ncba_outbound'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'cash_advance',
    label: 'Cash Advance Fee',
    description: 'Origination fee on PayChain Cash Advance product (merchant credit line). Pilot stage.',
    icon: 'savings',
    accent: 'violet',
    rate: CASH_ADVANCE_RATE,
    minFee: 0,
    txTypes: [],
    statuses: [],
    basis: 'kes_volume',
    pilot: true,
  },
];

export const REVENUE_STREAM_BY_ID = Object.fromEntries(REVENUE_STREAMS.map((s) => [s.id, s]));

export function computeStreamFee(stream, kesAmount) {
  const v = Number(kesAmount) || 0;
  if (v <= 0) return 0;
  return Math.max(stream.minFee || 0, v * stream.rate);
}
