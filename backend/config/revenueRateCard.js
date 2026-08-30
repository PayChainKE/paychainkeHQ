import { getKplcPostpaidServiceFee, getNcwscServiceFee } from './billPaymentTariffCard.js';
import { getTariffFlat } from '../services/tariffCardCache.js';

// Note: these two feed only the REVENUE_STREAMS description text below
// (display metadata, not live pricing — ncba_kplc/ncba_ncwsc are priced via
// their own dedicated feeCalculator.js branches, never this file's generic
// flatFee fallback), so they're read once at module load. A later admin
// edit to the underlying service fee is reflected the next time this
// module reloads (server restart), same as every other description string
// in this file that references a tariff figure.
const KPLC_POSTPAID_SERVICE_FEE = getKplcPostpaidServiceFee();
const NCWSC_SERVICE_FEE = getNcwscServiceFee();

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
// Every outbound/disbursement stream below used to charge a flat 0.5%
// (PAYCHAIN_TXN_RATE) on top of the transaction amount. Per 2026-08-11
// instruction: PayChain charges flat KES fees, not a percentage cut,
// "unless otherwise" — so each of those streams now has its own flat
// figure instead. FX_SPREAD_RATE is the deliberate exception: FX
// conversion is priced as a spread industry-wide (a flat fee doesn't scale
// sensibly from a KES 100 swap to a KES 1M one, and 2% already matches
// Kotani Pay/HoneyCoin's own standard) — not wired to a real payout yet
// (pilot/reporting-only), so there's no live charge to migrate.
export const FX_SPREAD_RATE       = 0.020;  // 2.00% — Kotani / HoneyCoin standard
// Cash Advance no longer uses a flat rate — see
// config/cashAdvanceTariffCard.js for the tiered origination-fee/factor-
// rate/split-rate schedule (pricing functions only; still not wired to a
// real disbursement or repayment anywhere — see that file's header).
// NCBA Virtual Account collections no longer use a flat linear rate — see
// config/ncbaTariffCard.js for the tiered Safaricom-cost + markup bands.

// Flat PayChain margin per transaction, one constant per outbound stream
// that's still genuinely flat. ncba_lipa_na_mpesa and KPLC (postpaid/
// prepaid)/NCWSC no longer have their own flat constants here — they're
// priced via their own tiered tariff cards instead (config/
// lipaNaMpesaTariffCard.js, config/billPaymentTariffCard.js), both actually
// deducted from a real merchant balance today. The rest below are still
// currently reporting-only figures on the admin Revenue dashboard (no
// controller deducts them from a merchant yet), but are still expressed as
// real flat KES amounts now rather than a phantom percentage-of-amount
// figure, so the dashboard shows an honest number pending each rail's own
// pricing rollout.
const NCBA_DISBURSEMENT_FLAT_FEE_KES_DEFAULT  = 50;
const STABLECOIN_PAYMENT_FLAT_FEE_KES_DEFAULT = 30;
const SETTLEMENT_FLAT_FEE_KES_DEFAULT         = 20;
const MPESA_B2B_LEGACY_FLAT_FEE_KES_DEFAULT   = 20;

// Admin-editable (Transaction Tariffs page) — see services/tariffCardCache.js.
// settlement_fee/stablecoin_payment/mpesa_b2b_fee are genuinely priced live
// through these (utils/feeCalculator.js's generic fallback reads
// `stream.flatFee` for any type without its own dedicated branch — 'settlement',
// 'outbound'/'bulk_pay', and 'mpesa_b2b' all fall through to it), so their
// REVENUE_STREAMS entries below use a `get flatFee()` accessor rather than a
// static value, making every read (including inside a real Transaction's
// pre-save hook) reflect the current cached figure rather than whatever was
// true when this module first loaded. ncba_disbursement_fee's flatFee is
// display-only today (ncba_outbound always resolves via its own dedicated
// branch first) but kept live the same way for consistency.
export function getNcbaDisbursementFlatFee()  { return getTariffFlat('ncba_disbursement_flat', NCBA_DISBURSEMENT_FLAT_FEE_KES_DEFAULT); }
export function getStablecoinPaymentFlatFee() { return getTariffFlat('stablecoin_flat', STABLECOIN_PAYMENT_FLAT_FEE_KES_DEFAULT); }
export function getSettlementFlatFee()        { return getTariffFlat('settlement_flat', SETTLEMENT_FLAT_FEE_KES_DEFAULT); }
export function getMpesaB2bLegacyFlatFee()    { return getTariffFlat('mpesa_b2b_legacy_flat', MPESA_B2B_LEGACY_FLAT_FEE_KES_DEFAULT); }

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
    description: 'On-chain KES ↔ USDC conversions. 2.00% spread — aligned to standard stablecoin off-ramp rates (Kotani Pay, HoneyCoin). Priced here but not yet wired to a real charge — controllers/transactionController.js\'s KES_TO_USDC/USDC_TO_KES swap handlers create the fx_swap Transaction without stamping paychainFee, so this stream always reports KES 0 today regardless of swap volume.',
    icon: 'currency_exchange',
    accent: 'pink',
    rate: FX_SPREAD_RATE,
    minFee: 0,
    txTypes: ['fx_swap'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    pilot: true,
  },
  {
    id: 'stablecoin_payment',
    label: 'Stablecoin Payment Fee',
    description: `PayChain's flat KES ${STABLECOIN_PAYMENT_FLAT_FEE_KES_DEFAULT} margin on USDC outbound payments — settlements, cross-border B2B, supplier payouts, bulk pay.`,
    icon: 'paid',
    accent: 'blue',
    rate: null,
    get flatFee() { return getStablecoinPaymentFlatFee(); },
    minFee: 0,
    txTypes: ['outbound', 'bulk_pay'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    passthrough: 'safaricom',
  },
  {
    id: 'settlement_fee',
    label: 'Settlement Fee',
    description: `PayChain's flat KES ${SETTLEMENT_FLAT_FEE_KES_DEFAULT} margin on KES off-ramp settlements to merchant bank or mobile money. Safaricom B2C tariff passes through to the merchant.`,
    icon: 'account_balance_wallet',
    accent: 'amber',
    rate: null,
    get flatFee() { return getSettlementFlatFee(); },
    minFee: 0,
    txTypes: ['settlement'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
    passthrough: 'safaricom',
  },
  {
    id: 'ncba_collection_fee',
    label: 'NCBA Collection Fee',
    description: 'Money IN is never charged to the merchant — this stream earns PayChain KES 0. Safaricom collects its own cut automatically from the paying customer; PayChain never sees or tracks that money (see config/ncbaTariffCard.js).',
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
    description: `PayChain's flat KES ${NCBA_DISBURSEMENT_FLAT_FEE_KES_DEFAULT} margin on outbound NCBA bulk disbursements (supplier payments, KPLC/water utility payouts) routed via NCBA Host-to-Host.`,
    icon: 'account_balance',
    accent: 'blue',
    rate: null,
    get flatFee() { return getNcbaDisbursementFlatFee(); },
    minFee: 0,
    txTypes: ['ncba_outbound'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'mpesa_b2c_fee',
    label: 'M-Pesa B2C Fee',
    description: 'PayChain\'s own tiered Mobile Withdrawal service fee on merchant withdrawals to M-Pesa (config/mpesaB2cTariffCard.js#calculateB2cServiceFee), charged alongside Safaricom\'s real B2C cost — both deducted from the merchant.',
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
    description: 'NCBA\'s replacement for Daraja B2C — merchant withdrawals to M-Pesa/Airtel numbers via NCBA\'s Mobile B2W Payment API, billed under the same Mobile Withdrawal tariff as mpesa_b2c_fee (config/mpesaB2cTariffCard.js) — both Safaricom\'s real cost and PayChain\'s own service fee are charged to the merchant.',
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
    description: `PayChain's flat KES ${MPESA_B2B_LEGACY_FLAT_FEE_KES_DEFAULT} margin on merchant payouts to another business's Paybill or Till, from before this rail moved to NCBA (see ncba_lipa_na_mpesa_fee below) — kept for historical transactions only, no longer earned on new payouts.`,
    icon: 'point_of_sale',
    accent: 'indigo',
    rate: null,
    get flatFee() { return getMpesaB2bLegacyFlatFee(); },
    minFee: 0,
    txTypes: ['mpesa_b2b'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_lipa_na_mpesa_fee',
    label: 'NCBA Lipa na M-Pesa Fee',
    description: 'Tiered B2B PayBill & Till Payout tariff — real NCBA/Safaricom B2B switching cost plus PayChain\'s own service fee, both charged to the merchant — on payouts to another business\'s Paybill or Till, via NCBA\'s Lipa na M-Pesa Payment API — NCBA\'s replacement for Daraja B2B. See config/lipaNaMpesaTariffCard.js. Charged both on the standalone single-payout endpoint (controllers/mpesaController.js#initiateB2B) and on Bulk Pay\'s Mobile Money -> Paybill/Buy Goods rows.',
    icon: 'point_of_sale',
    accent: 'indigo',
    tiered: true,
    rate: null,
    minFee: 0,
    txTypes: ['ncba_lipa_na_mpesa'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_kplc_fee',
    label: 'NCBA KPLC Bill Payment Fee',
    description: `PayChain's flat KES ${KPLC_POSTPAID_SERVICE_FEE} service fee, plus the real third-party base cost, on Bulk Pay KPLC (Kenya Power) postpaid bill payments (config/billPaymentTariffCard.js), via NCBA's Open Banking KPLC Payment API — both charged to the merchant alongside the bill value, distinct from the generic ncba_disbursement_fee stream used by bank and other utility (WATER) bulk payouts.`,
    icon: 'bolt',
    accent: 'amber',
    rate: null,
    flatFee: KPLC_POSTPAID_SERVICE_FEE,
    minFee: 0,
    txTypes: ['ncba_kplc'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_kplc_prepaid_fee',
    label: 'NCBA KPLC Prepaid Token Fee',
    description: 'Tiered PayChain service fee (KES 7-69) plus the real third-party base cost on Bulk Pay KPLC (Kenya Power) prepaid electricity token purchases, via NCBA\'s Open Banking KPLC Prepaid Transaction API — see config/billPaymentTariffCard.js. Distinct from ncba_kplc_fee (postpaid bill payments) — NCBA treats prepaid and postpaid as separate products.',
    icon: 'bolt',
    accent: 'amber',
    tiered: true,
    rate: null,
    minFee: 0,
    txTypes: ['ncba_kplc_prepaid'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'ncba_ncwsc_fee',
    label: 'NCBA NCWSC Bill Payment Fee',
    description: `PayChain's flat KES ${NCWSC_SERVICE_FEE} service fee, plus the real third-party base cost, on Bulk Pay Nairobi Water (NCWSC) bill payments (config/billPaymentTariffCard.js), via NCBA's Open Banking NWSC Payment API — both charged to the merchant alongside the bill value.`,
    icon: 'water_drop',
    accent: 'sky',
    rate: null,
    flatFee: NCWSC_SERVICE_FEE,
    minFee: 0,
    txTypes: ['ncba_ncwsc'],
    statuses: ['completed', 'verified'],
    basis: 'kes_volume',
  },
  {
    id: 'cash_advance',
    label: 'Cash Advance Fee',
    description: 'Tiered origination fee + fixed factor fee on PayChain Cash Advance (Revenue-Based Financing) — see config/cashAdvanceTariffCard.js. Pilot stage: pricing only, not wired to any real disbursement, repayment, or Transaction type yet.',
    icon: 'savings',
    accent: 'violet',
    tiered: true,
    rate: null,
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
  if (stream.flatFee != null) return stream.flatFee;
  return Math.max(stream.minFee || 0, v * stream.rate);
}
