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

// ── Safaricom standard Paybill tariff — Business Bouquet ───────────────
// Source: Safaricom's own published tariff sheet, "PAYBILL STANDARD
// TARIFF" (PAYBILL-STANDARD-TARIFF.pdf), Business Bouquet column — the
// tariff PayChain actually operates under (business pays Safaricom KES 0;
// the paying customer bears the full charge). Verified against every
// band in the PDF; replaces a previous table that didn't match any of
// the three real Safaricom tariff options (Mgao / Business Bouquet /
// Customer Bouquet). Pass-through cost — the customer pays this to
// Safaricom, never to PayChain. Used purely for transparency in the
// admin Revenue page.
export const SAFARICOM_TARIFF = [
  { max: 49,      fee: 0   },
  { max: 100,     fee: 0   },
  { max: 500,     fee: 5   },
  { max: 1_000,   fee: 10  },
  { max: 1_500,   fee: 15  },
  { max: 2_500,   fee: 20  },
  { max: 3_500,   fee: 25  },
  { max: 5_000,   fee: 34  },
  { max: 7_500,   fee: 42  },
  { max: 10_000,  fee: 48  },
  { max: 15_000,  fee: 57  },
  { max: 20_000,  fee: 62  },
  { max: 25_000,  fee: 67  },
  { max: 30_000,  fee: 72  },
  { max: 35_000,  fee: 83  },
  { max: 40_000,  fee: 99  },
  { max: 45_000,  fee: 103 },
  { max: 50_000,  fee: 108 },
  { max: 70_000,  fee: 108 },
  { max: 250_000, fee: 108 },
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
    description: 'Tiered PayChain fee on every inbound M-Pesa receipt (C2B paybill + STK Push) — applied on top of the standard Safaricom tariff. No single rate; see utils/pricingEngine.js.',
    icon: 'point_of_sale',
    accent: 'emerald',
    tiered: true,
    rate: null,
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
    id: 'mpesa_b2c_fee',
    label: 'M-Pesa B2C Fee',
    description: 'Safaricom\'s standard B2C tariff on merchant withdrawals to M-Pesa, passed through at cost (deducted from the merchant alongside the withdrawal). PayChain\'s own margin on top (PAYCHAIN_B2C_MARKUP) is not charged yet, so this stream reads near-zero revenue until that changes.',
    icon: 'smartphone',
    accent: 'rose',
    tiered: true,
    rate: null,
    minFee: 0,
    txTypes: ['mpesa_b2c'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_mobile_b2w_fee',
    label: 'NCBA Mobile B2W Fee',
    description: 'NCBA\'s replacement for Daraja B2C — merchant withdrawals to M-Pesa/Airtel numbers via NCBA\'s Mobile B2W Payment API. NCBA has not published a real cost schedule for this rail; the numbers here are inherited from Safaricom\'s own B2C tariff (getB2cTariff) as a placeholder, not a claim about NCBA\'s actual cost.',
    icon: 'smartphone',
    accent: 'rose',
    tiered: true,
    rate: null,
    minFee: 0,
    txTypes: ['ncba_mobile_b2w'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'mpesa_b2b_fee',
    label: 'M-Pesa B2B Fee (legacy)',
    description: 'PayChain\'s flat margin on merchant payouts to another business\'s Paybill or Till, from before this rail moved to NCBA (see ncba_lipa_na_mpesa_fee below) — kept for historical transactions only, no longer earned on new payouts.',
    icon: 'point_of_sale',
    accent: 'indigo',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['mpesa_b2b'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_lipa_na_mpesa_fee',
    label: 'NCBA Lipa na M-Pesa Fee',
    description: 'PayChain\'s flat margin on merchant payouts to another business\'s Paybill or Till, via NCBA\'s Lipa na M-Pesa Payment API — NCBA\'s replacement for Daraja B2B. NCBA hasn\'t published a cost schedule for this rail, so no NCBA cost passes through; this is PayChain\'s own charge only, same rate as the legacy Daraja B2B stream it replaces.',
    icon: 'point_of_sale',
    accent: 'indigo',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['ncba_lipa_na_mpesa'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_kplc_fee',
    label: 'NCBA KPLC Bill Payment Fee',
    description: 'PayChain\'s flat margin on Bulk Pay KPLC (Kenya Power) postpaid bill payments, via NCBA\'s Open Banking KPLC Payment API. NCBA hasn\'t published a cost schedule for this rail, so no NCBA cost passes through; this is PayChain\'s own charge only, distinct from the generic ncba_disbursement_fee stream used by bank and other utility (WATER) bulk payouts.',
    icon: 'bolt',
    accent: 'amber',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['ncba_kplc'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_ncwsc_fee',
    label: 'NCBA NCWSC Bill Payment Fee',
    description: 'PayChain\'s flat margin on Bulk Pay Nairobi Water (NCWSC) bill payments, via NCBA\'s Open Banking NWSC Payment API. NCBA hasn\'t published a cost schedule for this rail, so no NCBA cost passes through; this is PayChain\'s own charge only.',
    icon: 'water_drop',
    accent: 'sky',
    rate: PAYCHAIN_TXN_RATE,
    minFee: 0,
    txTypes: ['ncba_ncwsc'],
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
