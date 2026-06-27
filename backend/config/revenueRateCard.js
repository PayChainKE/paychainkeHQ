// Single source of truth for PayChain's revenue model rates. Every revenue
// computation (admin Revenue page, P&L exports, board reports) reads from
// this card so a rate change is one edit instead of N grepped magic numbers.
//
// Rates are expressed as decimals (0.01 = 1%). Floors are absolute KES.
// Each stream maps to a transaction-type bucket so the aggregator knows
// which docs to multiply by the rate.

export const REVENUE_STREAMS = [
  {
    id: 'transaction_fee',
    label: 'Transaction Fee',
    description: 'Charged on inbound paybill receipts (KES). The headline merchant-acquiring revenue line.',
    icon: 'point_of_sale',
    accent: 'emerald',
    rate: 0.010,        // 1.00%
    minFee: 5,          // KES floor per txn
    txTypes: ['inbound'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'fx_spread',
    label: 'FX Spread / Conversion',
    description: 'Spread captured on on-chain conversions between KES and USDC. Earned on every fx_swap.',
    icon: 'currency_exchange',
    accent: 'pink',
    rate: 0.015,        // 1.50% spread
    minFee: 0,
    txTypes: ['fx_swap'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'stablecoin_payment',
    label: 'Stablecoin Payment Fee',
    description: 'Fee on USDC outbound payments — settlements, cross-border B2B, supplier payouts.',
    icon: 'paid',
    accent: 'blue',
    rate: 0.005,        // 0.50%
    minFee: 0,
    txTypes: ['outbound', 'bulk_pay'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'settlement_fee',
    label: 'Settlement Fee',
    description: 'Charged on KES off-ramp settlements to merchant bank or mobile money.',
    icon: 'account_balance_wallet',
    accent: 'amber',
    rate: 0.003,        // 0.30%
    minFee: 0,
    txTypes: ['settlement'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'cash_advance',
    label: 'Cash Advance Fee',
    description: 'Origination fee on PayChain Cash Advance product (merchant credit line). Pilot stage.',
    icon: 'savings',
    accent: 'violet',
    rate: 0.025,        // 2.50%
    minFee: 0,
    txTypes: [],        // Not yet wired to a transaction type — surfaces as 0.
    statuses: [],
    basis: 'kes_volume',
    pilot: true,
  },
];

// Quick lookup by id for the controller and the frontend if we ever need it.
export const REVENUE_STREAM_BY_ID = Object.fromEntries(REVENUE_STREAMS.map((s) => [s.id, s]));

// Compute the fee for one transaction under a stream's rate. Used in the
// $function pipeline AND mirrored in JS for any single-doc preview.
export function computeStreamFee(stream, kesAmount) {
  const v = Number(kesAmount) || 0;
  if (v <= 0) return 0;
  return Math.max(stream.minFee || 0, v * stream.rate);
}
