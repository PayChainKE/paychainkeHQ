import { safaricomFeeFor } from '../config/revenueRateCard.js';

// M-Pesa monetization engine — the single source of truth for what PayChain
// deducts from a merchant on every inbound M-Pesa collection (C2B paybill +
// STK Push payment links/invoices). Mirrors config/ncbaTariffCard.js's
// tiered-band approach (replacing NCBA's old flat-rate model), applied here
// to M-Pesa's 'inbound' revenue stream instead of a flat PAYCHAIN_TXN_RATE.
//
// Two independent numbers, per the business rule:
//   - calculateMerchantFee   → PayChain's own fee. Deducted from the merchant
//     before crediting their wallet. This is what pays for PayChain.
//   - calculateCustomerMpesaFee → Safaricom's own published tariff, charged
//     by Safaricom directly to the paying customer's M-Pesa account. PayChain
//     never touches this money — it's surfaced purely for transparency
//     (receipts, admin revenue dashboard "what the customer paid Safaricom").
//     Reuses the real tariff table already in config/revenueRateCard.js
//     rather than duplicating it.
//
// A third, separate layer below (getCheckoutTotal / processSplitTransaction)
// adds an optional PayChain-collected customer-side surcharge on top of the
// above — see "Dual-sided checkout model" further down. Do not confuse
// calculateCustomerMpesaFee (Safaricom's cut, pass-through) with
// calculateCustomerSurcharge (PayChain's cut, collected from the customer).

// Temporarily disabled — for now PayChain charges only the flat KES 5 (the
// customer surcharge on STK flows, RAW_C2B_FLAT_MARKUP_KES on raw C2B
// deposits) with no tiered/percentage merchant fee on top. calculateMerchantFee
// returns 0 while this is false, which automatically zeroes it out
// everywhere it's used (confirmationURL, processSplitTransaction, and the
// 'inbound' case in feeCalculator.js's Transaction pre-save hook) without
// touching any of those call sites. Flip back to true to resume charging
// the tiered bands below.
const MPESA_MERCHANT_FEE_ENABLED = false;

// ── Merchant fee tier matrix ─────────────────────────────────────────────
// Placeholder bands — adjust freely as PayChain's pricing is finalized.
// Each band is checked in order; `type` is either 'percentage' (value is a
// rate, e.g. 0.005 = 0.5%) or 'flat' (value is a fixed KES amount,
// regardless of where in the band the transaction falls).
export const MPESA_MERCHANT_FEE_BANDS = [
  { min: 0,     max: 500,      type: 'percentage', value: 0.005  }, // Tier 1: 0.50%
  { min: 501,   max: 1_000,    type: 'percentage', value: 0.0075 }, // Tier 2: 0.75%
  { min: 1_001, max: 2_500,    type: 'percentage', value: 0.010  }, // Tier 3: 1.00%
  { min: 2_501, max: 5_000,    type: 'flat',       value: 40     }, // Tier 4: flat KES 40
  { min: 5_001, max: 10_000,   type: 'percentage', value: 0.0125 }, // Tier 5: 1.25%
  { min: 10_001, max: Infinity, type: 'percentage', value: 0.015 }, // Tier 6: 1.50% (uncapped)
];

// Standard financial rounding: half away from zero, to 2dp — same
// convention as config/ncbaTariffCard.js's round2.
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function findBand(amount) {
  return (
    MPESA_MERCHANT_FEE_BANDS.find((b) => amount >= b.min && amount <= b.max) ||
    MPESA_MERCHANT_FEE_BANDS[MPESA_MERCHANT_FEE_BANDS.length - 1]
  );
}

/**
 * PayChain's own fee, deducted from the merchant's gross receipt before it
 * hits their available balance. Never throws — money has already left the
 * customer's M-Pesa account by the time this runs inside a webhook, so a bad
 * input here must degrade to "no fee charged" rather than abort the credit
 * entirely (see mpesaController.js's confirmationURL/stkCallback usage).
 *
 * @param {number} grossAmount
 * @returns {number} fee in KES, rounded to 2dp, never negative, never more
 *          than the gross amount itself.
 */
export function calculateMerchantFee(grossAmount) {
  if (!MPESA_MERCHANT_FEE_ENABLED) return 0;

  const amount = Number(grossAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error(`⚠️ calculateMerchantFee received an invalid amount (${grossAmount}) — charging KES 0 fee`);
    return 0;
  }

  const band = findBand(amount);
  const fee = band.type === 'flat' ? band.value : amount * band.value;

  // Sanity clamp — a misconfigured band (e.g. a >100% rate typo) must never
  // let the deducted fee exceed the gross amount being credited.
  return round2(Math.min(Math.max(fee, 0), amount));
}

// Flat markup PayChain collects on every raw C2B paybill deposit
// (mpesaController.js#confirmationURL) — a customer keying your paybill +
// account number directly into their own M-Pesa menu picks their own
// amount, so unlike STK Push there's no PayChain-controlled prompt to add a
// customer-facing surcharge to (see "Dual-sided checkout model" further
// down). This is PayChain's way of still collecting the same flat KES 5 on
// this rail — deducted from the merchant alongside calculateMerchantFee
// above, not billed to the payer. Same figure as
// CUSTOMER_SURCHARGE_FLAT_KES below, kept as its own constant since the two
// are collected through entirely different mechanisms and should be able to
// move independently.
export const RAW_C2B_FLAT_MARKUP_KES = 5;

/**
 * The Safaricom tariff a customer pays on a standard paybill/STK transaction
 * — a pure pass-through cost PayChain never collects or deducts from the
 * merchant. Delegates to the real published tariff table (SAFARICOM_TARIFF)
 * already used elsewhere for the same purpose, rather than a second
 * duplicate/placeholder table.
 *
 * @param {number} amount
 * @returns {number} fee in KES the customer is charged by Safaricom.
 */
export function calculateCustomerMpesaFee(amount) {
  return safaricomFeeFor(amount);
}

/**
 * MongoDB aggregation expression form of calculateMerchantFee, for
 * controllers/revenueController.js's per-transaction fee sum — mirrors
 * config/ncbaTariffCard.js#ncbaMarkupMongoExpr. `basisExpr` is whatever
 * Mongo expression yields the per-doc gross KES basis (see KES_BASIS in
 * revenueController.js). Mirrors calculateMerchantFee's
 * MPESA_MERCHANT_FEE_ENABLED gate — literal 0 while disabled, so the
 * dashboard's live-recomputed figure never diverges from what's actually
 * being deducted.
 */
export function mpesaMerchantFeeMongoExpr(basisExpr) {
  if (!MPESA_MERCHANT_FEE_ENABLED) return 0;

  return {
    $switch: {
      branches: MPESA_MERCHANT_FEE_BANDS.map((b) => ({
        case: Number.isFinite(b.max)
          ? { $and: [{ $gte: [basisExpr, b.min] }, { $lte: [basisExpr, b.max] }] }
          : { $gte: [basisExpr, b.min] }, // open-ended top tier
        then: b.type === 'flat' ? b.value : { $multiply: [basisExpr, b.value] },
      })),
      default: 0,
    },
  };
}

export class PricingEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PricingEngineError';
  }
}

// ── Dual-sided checkout model ────────────────────────────────────────────
// Only applies where PayChain itself sets the amount sent to Safaricom —
// i.e. any STK Push PayChain triggers on a payer's behalf: payment
// links/invoices (controllers/transactionController.js#processPaymentLink),
// Request Money's instant prompt, and pay-to-account
// (controllers/mpesaController.js#initiateSTKPush /
// controllers/transactionController.js#payToMerchantAccount), all settled
// through controllers/mpesaController.js#stkCallback. It does NOT apply to
// raw C2B/paybill deposits (mpesaController.js#confirmationURL): a customer
// keying an amount directly into their own M-Pesa paybill menu chooses that
// number themselves, so there is no "checkout total" PayChain can inflate —
// confirmationURL keeps its existing merchant-fee-only model untouched. It
// also does not apply to a merchant topping up their own wallet with their
// own phone — there's no external "sender" being charged in that case.
//
// Flat KES 5 per transaction, billed to the payer on top of whatever
// Safaricom's own tariff already charges them, and kept by PayChain as
// revenue (not shared with the merchant). Not a percentage — a KES 10
// transaction and a KES 10,000 transaction both carry the same flat KES 5.
export const CUSTOMER_SURCHARGE_FLAT_KES = 5;

/**
 * PayChain's own surcharge collected directly from the paying customer, on
 * top of the merchant's base bill — separate from calculateCustomerMpesaFee
 * (Safaricom's cut, which this is never added to or confused with).
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} surcharge in KES, rounded to 2dp.
 */
export function calculateCustomerSurcharge(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return round2(CUSTOMER_SURCHARGE_FLAT_KES);
}

/**
 * The exact amount to send as the STK Push `Amount` — the merchant's base
 * bill plus the customer surcharge. Called once, at checkout-initiation
 * time, before the prompt is fired to the customer's handset (so what they
 * see and approve on their phone already includes any surcharge — never
 * added silently afterward).
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} total in KES to request via STK Push.
 * @throws {PricingEngineError} if baseInvoiceAmount isn't a positive number.
 */
export function getCheckoutTotal(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) {
    throw new PricingEngineError(`baseInvoiceAmount must be a positive number, received "${baseInvoiceAmount}"`);
  }
  return round2(base + calculateCustomerSurcharge(base));
}

/**
 * Splits a completed STK Push settlement between the merchant and PayChain.
 * Called from mpesaController.js#stkCallback once Safaricom confirms
 * payment — `totalMpesaReceived` is what Safaricom actually credited
 * (STKRequest.amount, == getCheckoutTotal's earlier output), and
 * `baseInvoiceAmount` is the original PaymentLink/Invoice amount before any
 * surcharge (PaymentLink.amount).
 *
 * @param {number} totalMpesaReceived
 * @param {number} baseInvoiceAmount
 * @returns {{ customerFee: number, merchantFee: number, paychainTotalRevenue: number, merchantNetSettlement: number }}
 * @throws {PricingEngineError} on invalid input, or if the ledger identity
 *         (totalMpesaReceived === merchantNetSettlement + paychainTotalRevenue)
 *         fails to hold — a real customer's money is at stake here, so a
 *         drift must halt settlement rather than silently under/over-credit.
 */
export function processSplitTransaction(totalMpesaReceived, baseInvoiceAmount) {
  const total = Number(totalMpesaReceived);
  const base = Number(baseInvoiceAmount);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(base) || base <= 0) {
    throw new PricingEngineError(
      `processSplitTransaction requires positive numbers — received totalMpesaReceived="${totalMpesaReceived}", baseInvoiceAmount="${baseInvoiceAmount}"`
    );
  }

  // Customer Fee — whatever Safaricom credited beyond the merchant's base
  // bill. Exactly 0 today (CUSTOMER_SURCHARGE_RATE placeholder is 0);
  // becomes positive once a real surcharge rate is configured above.
  const customerFee = round2(total - base);

  // Merchant Fee — reuses the same tiered band engine already wired into
  // confirmationURL/stkCallback (calculateMerchantFee above). One
  // merchant-fee calculation for the whole app, never a second copy.
  const merchantFee = calculateMerchantFee(base);

  const paychainTotalRevenue = round2(customerFee + merchantFee);
  const merchantNetSettlement = round2(base - merchantFee);

  // Ledger integrity guard — every shilling Safaricom actually credited
  // must be accounted for by exactly one of "what the merchant keeps" or
  // "what PayChain keeps". A mismatch (rounding drift, a stale base amount,
  // a bad edit to the formulas above) must halt settlement, not silently
  // mis-credit real money.
  const reconciled = round2(merchantNetSettlement + paychainTotalRevenue);
  if (reconciled !== round2(total)) {
    throw new PricingEngineError(
      `Ledger integrity failure: totalMpesaReceived (KES ${total}) !== merchantNetSettlement + paychainTotalRevenue (KES ${reconciled}). Refusing to settle.`
    );
  }

  return { customerFee, merchantFee, paychainTotalRevenue, merchantNetSettlement };
}

/**
 * Same idea as processSplitTransaction, for STK flows that carry a customer
 * surcharge but have never had a merchant-side tiered fee applied to them
 * (Request Money's instant prompt, pay-to-account) — the merchant keeps
 * their full base amount; only the surcharge is PayChain's.
 *
 * @param {number} totalMpesaReceived
 * @param {number} baseAmount
 * @returns {{ customerFee: number, merchantNetSettlement: number }}
 * @throws {PricingEngineError} on invalid input, or if totalMpesaReceived is
 *         less than baseAmount — a real customer's money is at stake here,
 *         so a drift must halt settlement rather than silently mis-credit.
 */
export function splitCustomerSurcharge(totalMpesaReceived, baseAmount) {
  const total = Number(totalMpesaReceived);
  const base = Number(baseAmount);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(base) || base <= 0) {
    throw new PricingEngineError(
      `splitCustomerSurcharge requires positive numbers — received totalMpesaReceived="${totalMpesaReceived}", baseAmount="${baseAmount}"`
    );
  }

  const customerFee = round2(total - base);
  if (customerFee < 0) {
    throw new PricingEngineError(
      `Ledger integrity failure: totalMpesaReceived (KES ${total}) is less than baseAmount (KES ${base}). Refusing to settle.`
    );
  }

  return { customerFee, merchantNetSettlement: base };
}
