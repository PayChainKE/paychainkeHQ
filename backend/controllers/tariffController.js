import { SAFARICOM_TARIFF } from '../config/revenueRateCard.js';
import {
  FLAT_FEE_FREE_TIER_MAX_KES,
  INVOICE_CLIENT_MARKUP_BANDS,
  INVOICE_MERCHANT_FLAT_FEE_KES,
  calculateCustomerSurcharge,
} from '../utils/pricingEngine.js';
import { PESALINK_BANDS, MAX_PESALINK_AMOUNT, RTGS_BASE_COST, RTGS_SERVICE_FEE } from '../config/bankTransferTariffCard.js';
import { B2C_REGISTERED_USER_BANDS, MAX_B2C_AMOUNT, calculateB2cServiceFee } from '../config/mpesaB2cTariffCard.js';
import { LIPA_NA_MPESA_B2B_BANDS, MAX_LIPA_NA_MPESA_B2B_AMOUNT } from '../config/lipaNaMpesaTariffCard.js';
import {
  KPLC_PREPAID_BANDS,
  KPLC_POSTPAID_BASE_COST,
  KPLC_POSTPAID_SERVICE_FEE,
  NCWSC_BASE_COST,
  NCWSC_SERVICE_FEE,
  INTERNET_BASE_COST,
  INTERNET_SERVICE_FEE,
  RENT_SETTLEMENT_BANDS,
} from '../config/billPaymentTariffCard.js';
import {
  NCBA_DISBURSEMENT_FLAT_FEE_KES,
  STABLECOIN_PAYMENT_FLAT_FEE_KES,
  SETTLEMENT_FLAT_FEE_KES,
  MPESA_B2B_LEGACY_FLAT_FEE_KES,
} from '../config/revenueRateCard.js';

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Turns a `{ max, ...fee fields }[]` band array into `{ label, ...fee
// fields }[]` with a human-readable "low–high" range per row (low is the
// previous row's max + 1, first row starts at 1) — every table on the
// Transaction Tariffs admin page is built from this, off the exact same
// arrays the pricing engine itself reads, so this can never drift from
// what's actually charged. `free` collapses every band at or below the
// platform's free-tier ceiling into one "1–{free}" row — some source
// tables (SAFARICOM_TARIFF) carry two separate zero-fee rows below 100
// (a 49 and a 100 boundary) that would otherwise render as two identical
// "free" rows back to back.
function labelBands(bands, { free } = {}) {
  const rows = free ? bands.filter((b) => b.max >= free) : bands;
  let prevMax = free || 0;
  return rows.map((b, i) => {
    const low = i === 0 && free ? 1 : prevMax + 1;
    prevMax = b.max;
    const label = i === 0 && free ? `1–${free}` : (b.max >= 250_000 ? `${low.toLocaleString()}+` : `${low.toLocaleString()}–${b.max.toLocaleString()}`);
    return { label, ...b };
  });
}

// @desc    Every fee tariff currently live on the platform, read straight
//          from the same config files the pricing engine itself imports —
//          single source of truth, so this page can never show a stale or
//          hand-copied number. Grouped exactly like the platform's own
//          money-in / invoices / money-out / flat-stream split.
// @route   GET /api/admin/tariffs
// @access  Private (Admin)
export const getTariffs = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        moneyIn: {
          note: 'Customer pays both columns on STK Push, QR, Payment Links, and self-funded wallet top-ups. Raw Paybill deposits / generic NCBA collections are KES 0 to everyone — Safaricom deducts its own cut from the payer automatically, outside PayChain\'s ledger entirely.',
          freeAtOrBelow: FLAT_FEE_FREE_TIER_MAX_KES,
          // Evaluates calculateCustomerSurcharge at each real Safaricom band
          // boundary rather than zipping the two tables by array index —
          // CUSTOMER_SURCHARGE_BANDS has its own, coarser boundary list, so
          // an index-paired zip would silently mismatch amounts and fees a
          // few rows in.
          bands: labelBands(SAFARICOM_TARIFF.map((s) => ({
            max: s.max,
            safaricomFee: s.fee,
            paychainFee: calculateCustomerSurcharge(s.max),
          })), { free: FLAT_FEE_FREE_TIER_MAX_KES }),
        },
        invoices: {
          note: `The one deliberate dual charge: the merchant pays a flat KES ${INVOICE_MERCHANT_FLAT_FEE_KES} service fee (clamped to the invoice value) alongside the customer's own tiered markup below.`,
          merchantFlatFee: INVOICE_MERCHANT_FLAT_FEE_KES,
          freeAtOrBelow: FLAT_FEE_FREE_TIER_MAX_KES,
          customerMarkupBands: labelBands(INVOICE_CLIENT_MARKUP_BANDS, { free: FLAT_FEE_FREE_TIER_MAX_KES }),
        },
        moneyOut: {
          note: 'Merchant pays both the real third-party (NCBA/Safaricom) cost and PayChain\'s own margin on every rail below.',
          rails: [
            {
              id: 'rtgs',
              label: 'RTGS (bank transfer)',
              shape: 'flat',
              baseCost: RTGS_BASE_COST,
              serviceFee: RTGS_SERVICE_FEE,
              totalFee: round2(RTGS_BASE_COST + RTGS_SERVICE_FEE),
            },
            {
              id: 'pesalink',
              label: 'PesaLink (bank transfer)',
              shape: 'tiered',
              maxAmount: MAX_PESALINK_AMOUNT,
              bands: labelBands(PESALINK_BANDS).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
            },
            {
              id: 'mobile_withdrawal',
              label: 'Mobile Withdrawal (M-Pesa B2C / NCBA Mobile B2W)',
              shape: 'tiered',
              maxAmount: MAX_B2C_AMOUNT,
              // Same reasoning as moneyIn above — B2C_SERVICE_FEE_BANDS has
              // its own, coarser boundary list than B2C_REGISTERED_USER_BANDS
              // (14 rows vs 20), so this evaluates calculateB2cServiceFee at
              // each real Safaricom-cost boundary instead of an index zip.
              bands: labelBands(B2C_REGISTERED_USER_BANDS.map((s) => ({
                max: s.max,
                baseCost: s.safaricomFee,
                serviceFee: calculateB2cServiceFee(s.max),
              }))).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
            },
            {
              id: 'lipa_na_mpesa',
              label: 'Lipa na M-Pesa B2B (Paybill/Till payout)',
              shape: 'tiered',
              maxAmount: MAX_LIPA_NA_MPESA_B2B_AMOUNT,
              bands: labelBands(LIPA_NA_MPESA_B2B_BANDS).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
            },
            {
              id: 'kplc_postpaid',
              label: 'KPLC Postpaid Bill',
              shape: 'flat',
              baseCost: KPLC_POSTPAID_BASE_COST,
              serviceFee: KPLC_POSTPAID_SERVICE_FEE,
              totalFee: round2(KPLC_POSTPAID_BASE_COST + KPLC_POSTPAID_SERVICE_FEE),
            },
            {
              id: 'kplc_prepaid',
              label: 'KPLC Prepaid Token',
              shape: 'tiered',
              bands: labelBands(KPLC_PREPAID_BANDS).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
            },
            {
              id: 'ncwsc',
              label: 'NCWSC (Nairobi Water)',
              shape: 'flat',
              baseCost: NCWSC_BASE_COST,
              serviceFee: NCWSC_SERVICE_FEE,
              totalFee: round2(NCWSC_BASE_COST + NCWSC_SERVICE_FEE),
            },
            {
              id: 'internet',
              label: 'Internet (priced, not yet a live Bulk Pay category)',
              shape: 'flat',
              dormant: true,
              baseCost: INTERNET_BASE_COST,
              serviceFee: INTERNET_SERVICE_FEE,
              totalFee: round2(INTERNET_BASE_COST + INTERNET_SERVICE_FEE),
            },
            {
              id: 'rent',
              label: 'Rent Settlement (priced, not yet a live Bulk Pay category)',
              shape: 'tiered',
              dormant: true,
              bands: labelBands(RENT_SETTLEMENT_BANDS).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
            },
          ],
        },
        flatStreams: {
          note: 'Flat PayChain margins on the remaining transaction types, not tied to a tiered NCBA/Safaricom cost sheet.',
          streams: [
            { id: 'ncba_disbursement', label: 'NCBA Disbursement (generic, e.g. bank/utility bulk payouts routed via NCBA Host-to-Host)', flatFee: NCBA_DISBURSEMENT_FLAT_FEE_KES },
            { id: 'stablecoin_payment', label: 'Stablecoin (USDC) outbound payment', flatFee: STABLECOIN_PAYMENT_FLAT_FEE_KES },
            { id: 'settlement', label: 'Generic settlement (bank/mobile off-ramp)', flatFee: SETTLEMENT_FLAT_FEE_KES },
            { id: 'mpesa_b2b_legacy', label: 'M-Pesa B2B (legacy, pre-NCBA — historical transactions only)', flatFee: MPESA_B2B_LEGACY_FLAT_FEE_KES },
          ],
        },
      },
    });
  } catch (error) {
    console.error('Get Tariffs Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
