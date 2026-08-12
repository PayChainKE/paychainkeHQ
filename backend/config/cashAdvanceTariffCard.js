// Cash Advance Tariff & Pricing Structure (Revenue-Based Financing &
// Working Capital Facility, 2026-08-12) — PRICING FUNCTIONS ONLY.
//
// Deliberately not wired into anything yet, per explicit scope confirmed
// with the user (2026-08-12): today, "approving" a CashAdvanceApplication
// (backend/models/CashAdvanceApplication.js,
// backend/controllers/cashAdvanceController.js#adminUpdateCashAdvanceRequest)
// is a pure status-flip with no wallet credit, no advance ledger, and no
// repayment mechanism anywhere in the codebase. This tariff's "Automated
// Daily Remittance" would require a genuinely new skim inserted into every
// live STK Push/Dynamic QR/PayBill collection settlement path across the
// whole platform (mpesaController.js#resolveStkOutcome and the NCBA
// collection webhooks) — real customer money, every merchant, no existing
// pattern to model it on (every settlement path today is a clean two-way
// merchant/PayChain split, see utils/pricingEngine.js). That, plus a new
// loan ledger and credit-limit system, is a materially larger and riskier
// build than every other tariff this session and was scoped out
// deliberately — build it as its own dedicated, carefully-reviewed project.
//
// Also note: backend/models/Merchant.js's `cashAdvanceForm` feature-flag
// comment already flags that this product likely falls under CBK Digital
// Credit Providers Regulations, licensing status unconfirmed — another
// reason disbursement/repayment shouldn't be wired in casually.
//
// Known discrepancy, not resolved here: this tariff's stated eligibility
// criterion ("minimum 3 months of active transaction history") doesn't
// match the existing eligibility gate actually in use
// (trustScoreController.js#calculateTrustScore — a transaction-COUNT-based
// score, eligible at >=60, no tenure/months check at all). Left as-is;
// flagging for whoever scopes the real eligibility logic later.

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Every rate below is a decimal (0.025 = 2.5%), applied against the
// advance principal (`requestedAmount`/`approvedLimit` on
// CashAdvanceApplication, once that model gains a real ledger). Bands are
// inclusive of `max`; the 500,001-2,000,000 tier is the sheet's real
// ceiling, not a compressed/interpolated row — no ambiguity to resolve
// here, unlike every other tariff this session.
const CASH_ADVANCE_TIERS = [
  { max: 50_000,     originationFeeRate: 0.025, factorRate: 0.050, dailySplitRate: 0.10 },
  { max: 150_000,    originationFeeRate: 0.020, factorRate: 0.045, dailySplitRate: 0.12 },
  { max: 500_000,    originationFeeRate: 0.015, factorRate: 0.040, dailySplitRate: 0.15 },
  { max: 2_000_000,  originationFeeRate: 0.010, factorRate: 0.035, dailySplitRate: 0.15 },
];

export const MIN_CASH_ADVANCE_AMOUNT = 10_000;
export const MAX_CASH_ADVANCE_AMOUNT = 2_000_000;

// Credit Limit Scaling — a policy rule, not a per-advance fee calculation,
// kept here only as documented constants (no credit-limit field exists on
// Merchant to actually apply this to yet).
export const CREDIT_LIMIT_SCALING_MIN_RATE = 0.20;
export const CREDIT_LIMIT_SCALING_MAX_RATE = 0.35;

/**
 * Full pricing breakdown for a given advance principal — origination fee
 * (deducted up front from the disbursed proceeds), factor fee (the flat
 * capital cost, collected over time via the daily collection split), and
 * the resulting net-disbursed / total-repayable / total-PayChain-revenue
 * figures. Pure calculation — does not touch any balance, ledger, or
 * Transaction record (see file header).
 *
 * @param {number} advanceAmount
 * @returns {{
 *   originationFeeRate: number, factorRate: number, dailySplitRate: number,
 *   totalRevenueRate: number, originationFee: number, factorFee: number,
 *   netDisbursement: number, totalRepayable: number, totalRevenue: number,
 * }}
 */
export function getCashAdvanceTariff(advanceAmount) {
  const amount = Number(advanceAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      originationFeeRate: 0, factorRate: 0, dailySplitRate: 0, totalRevenueRate: 0,
      originationFee: 0, factorFee: 0, netDisbursement: 0, totalRepayable: 0, totalRevenue: 0,
    };
  }

  const tier = CASH_ADVANCE_TIERS.find((t) => amount <= t.max) || CASH_ADVANCE_TIERS[CASH_ADVANCE_TIERS.length - 1];
  const { originationFeeRate, factorRate, dailySplitRate } = tier;

  const originationFee = round2(amount * originationFeeRate);
  const factorFee = round2(amount * factorRate);

  return {
    originationFeeRate,
    factorRate,
    dailySplitRate,
    // Rate, not a KES amount — round2 (2dp) would corrupt a value like
    // 0.075 into 0.08. Exact sum of two exact decimal-literal rates from
    // the tier table needs no rounding at all.
    totalRevenueRate: originationFeeRate + factorRate,
    originationFee,
    factorFee,
    // What actually lands in the merchant's balance if disbursed today —
    // origination fee taken off the top.
    netDisbursement: round2(amount - originationFee),
    // Principal + factor fee — what the daily collection split works
    // toward recovering in full before repayment is complete.
    totalRepayable: round2(amount + factorFee),
    // Origination fee (upfront) + factor fee (recovered over time) —
    // PayChain's total earn on this advance.
    totalRevenue: round2(originationFee + factorFee),
  };
}
