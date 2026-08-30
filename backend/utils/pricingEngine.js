import { safaricomFeeFor } from '../config/revenueRateCard.js';
import { getTariffBands, getTariffFlat } from '../services/tariffCardCache.js';

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

// Disabled platform-wide, permanently as of 2026-08-30: money IN is never
// charged to the merchant — only money OUT is (see ncbaTariffCard.js's
// header comment for the NCBA-rail side of this same rule). Whatever
// PayChain earns on an inbound collection comes entirely from the paying
// customer's surcharge instead (see "Dual-sided checkout model" below).
// calculateMerchantFee returns 0 while this is false, which automatically
// zeroes it out everywhere it's used (confirmationURL, processSplitTransaction,
// and the 'inbound' case in feeCalculator.js's Transaction pre-save hook)
// without touching any of those call sites.
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
 * entirely (see mpesaController.js's confirmationURL/resolveStkOutcome usage).
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
// through controllers/mpesaController.js#resolveStkOutcome. It does NOT apply to
// raw C2B/paybill deposits (mpesaController.js#confirmationURL): a customer
// keying an amount directly into their own M-Pesa paybill menu chooses that
// number themselves, so there is no "checkout total" PayChain can inflate —
// confirmationURL keeps its existing merchant-fee-only model untouched. It
// also does not apply to a merchant topping up their own wallet with their
// own phone — there's no external "sender" being charged in that case.
//
// PayChain Standard Transaction Tariff (Dynamic QR Code & STK Push
// Collections, 2026-08-12) — Zero-Merchant-Fee model: the merchant is
// billed KES 0 (MPESA_MERCHANT_FEE_ENABLED stays false), and this entire
// PayChain Service Fee is billed to the paying customer instead, on top of
// Safaricom's own tariff. Bands mirror SAFARICOM_TARIFF's own `max`
// boundaries exactly (config/revenueRateCard.js) — Total Charge to Customer
// in the tariff sheet is, band for band, safaricomFeeFor(amount) + the fee
// below, e.g. KES 501-1,000: safaricom 10 + service fee 5 = KES 15 total.
// The two highest bands (10,001-250,000) were given in the tariff sheet as
// a range per compressed row (e.g. "20,001-250,000: KES 25-35") — expanded
// here into SAFARICOM_TARIFF's real finer sub-bands, stepping evenly from
// the range's low end to its high end (confirmed against the sheet 2026-08-12).
// The 20,000 boundary was originally entered here as KES 23 per that first
// sheet, but the later Invoicing and Wallet Top-Up sheets both independently
// gave KES 25 for the same boundary (and only KES 25 keeps Total Charge =
// safaricomFeeFor + fee consistent with those sheets' own stated 77-87
// total range) — corrected to 25 on 2026-08-12 per explicit confirmation;
// the original sheet's "85" total (62+23) was the actual typo, not this one.
//
// Also serves as the "Hosted Payment Link Tariff Schedule" (Web & Social
// Checkout Links, 2026-08-12) and the "Wallet Top-Up Tariff Schedule"
// (Merchant Operating Float / Wallet Deposits, 2026-08-12) — verified
// band-for-band identical to both separate tariff sheets (after the 20,000
// boundary correction above), so the same table and functions cover all
// three products; getCheckoutTotal is already called from
// transactionController.js#processPaymentLink (Payment Links/Invoices) and
// mpesaController.js#initiateSTKPush (wallet top-ups, Request Money, pay-
// to-account) for these product lines, no separate code path needed.
const CUSTOMER_SURCHARGE_BANDS_DEFAULT = [
  { max: 100,      fee: 0  },
  { max: 500,      fee: 3  },
  { max: 1_000,    fee: 5  },
  { max: 1_500,    fee: 7  },
  { max: 2_500,    fee: 8  },
  { max: 3_500,    fee: 8  },
  { max: 5_000,    fee: 10 },
  { max: 7_500,    fee: 12 },
  { max: 10_000,   fee: 15 },
  { max: 15_000,   fee: 20 },
  { max: 20_000,   fee: 25 },
  { max: 25_000,   fee: 25 },
  { max: 30_000,   fee: 27 },
  { max: 35_000,   fee: 29 },
  { max: 40_000,   fee: 31 },
  { max: 45_000,   fee: 33 },
  { max: 50_000,   fee: 35 },
  { max: 70_000,   fee: 35 },
  { max: 250_000,  fee: 35 },
];

// Admin-editable (Transaction Tariffs page, OTP-gated) — see
// services/tariffCardCache.js. Falls back to the hardcoded default above
// if the DB-backed value is ever missing/malformed.
export function getCustomerSurchargeBands() {
  return getTariffBands('customer_surcharge', CUSTOMER_SURCHARGE_BANDS_DEFAULT);
}

// Amounts at or below this are exempt from every flat PayChain fee across
// the platform — the STK customer surcharge, the raw-C2B markup, and the
// NCBA collection markup (config/ncbaTariffCard.js, which imports
// FLAT_FEE_FREE_TIER_MAX_KES from here rather than duplicating it). A
// small top-up or micro-payment shouldn't carry the same flat fee as a
// KES 10,000 one. Amounts of exactly this value or below are free;
// anything above it carries the full flat fee.
export const FLAT_FEE_FREE_TIER_MAX_KES = 100;

/**
 * PayChain's own surcharge collected directly from the paying customer, on
 * top of the merchant's base bill — separate from calculateCustomerMpesaFee
 * (Safaricom's cut, which this is never added to or confused with). Free
 * for amounts at or below FLAT_FEE_FREE_TIER_MAX_KES. Tiered per
 * CUSTOMER_SURCHARGE_BANDS above (the Standard Transaction Tariff), not a
 * flat KES 5 regardless of amount.
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} surcharge in KES, rounded to 2dp.
 */
export function calculateCustomerSurcharge(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (base <= FLAT_FEE_FREE_TIER_MAX_KES) return 0;
  const bands = getCustomerSurchargeBands();
  const band = bands.find((b) => base <= b.max) || bands[bands.length - 1];
  return round2(band.fee);
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

// ── Electronic Invoicing tariff (Hybrid Pricing Architecture, 2026-08-12) ──
// Unlike every other product on this page, Invoicing monetizes BOTH sides
// of the transaction: a client-facing markup (added to the STK prompt, same
// mechanism as calculateCustomerSurcharge above) AND a merchant-facing
// "Invoice Service Fee" (deducted from the merchant's net settlement, to
// cover invoice generation/PDF delivery/tracking/ERP sync). Kept as its own
// pair of band tables rather than reusing CUSTOMER_SURCHARGE_BANDS /
// calculateMerchantFee above — the two schedules diverge in the
// 1,001-2,500 and 10,001-20,000 rows, and MPESA_MERCHANT_FEE_ENABLED must
// stay false for every other product's zero-merchant-fee model while
// Invoicing genuinely charges one. Both tables mirror SAFARICOM_TARIFF's
// own `max` boundaries, same convention as CUSTOMER_SURCHARGE_BANDS.
//
// The 20,001-250,000 Client Markup range (given in the sheet as "25-35")
// steps evenly across the same 8 real Safaricom sub-bands as the STK/QR
// tariff's identical range, per the same interpretation confirmed there
// (2026-08-12). The 10,001-20,000 range ("20-25") maps 1:1 onto its two
// real sub-bands (15,000/20,000) with no interpolation needed. The Invoice
// Service Fee is given as a single flat value per compressed row in the
// sheet (not a range) — repeated across each row's real sub-bands here
// purely so both tables share one boundary list.
export const INVOICE_CLIENT_MARKUP_BANDS_DEFAULT = [
  { max: 100,      fee: 0  },
  { max: 500,      fee: 3  },
  { max: 1_000,    fee: 5  },
  { max: 1_500,    fee: 5  },
  { max: 2_500,    fee: 7  },
  { max: 3_500,    fee: 8  },
  { max: 5_000,    fee: 10 },
  { max: 7_500,    fee: 12 },
  { max: 10_000,   fee: 15 },
  { max: 15_000,   fee: 20 },
  { max: 20_000,   fee: 25 },
  { max: 25_000,   fee: 25 },
  { max: 30_000,   fee: 27 },
  { max: 35_000,   fee: 29 },
  { max: 40_000,   fee: 31 },
  { max: 45_000,   fee: 33 },
  { max: 50_000,   fee: 35 },
  { max: 70_000,   fee: 35 },
  { max: 250_000,  fee: 35 },
];

// Admin-editable — see getCustomerSurchargeBands's identical convention above.
export function getInvoiceClientMarkupBands() {
  return getTariffBands('invoice_client_markup', INVOICE_CLIENT_MARKUP_BANDS_DEFAULT);
}

// Flat merchant-side Invoice Service Fee (Brandon, 2026-08-30) — replaces
// the old tiered INVOICE_MERCHANT_SERVICE_FEE_BANDS (KES 0-50, scaling with
// invoice size). Deliberately small and flat, on every invoice regardless
// of amount: the customer already pays the normal tiered markup via
// calculateInvoiceClientMarkup below (unchanged) — this is just PayChain's
// own small cut for the Invoicing workflow itself.
const INVOICE_MERCHANT_FLAT_FEE_KES_DEFAULT = 23;

// Admin-editable — see getCustomerSurchargeBands's identical convention above.
export function getInvoiceMerchantFlatFee() {
  return getTariffFlat('invoice_merchant_flat_fee', INVOICE_MERCHANT_FLAT_FEE_KES_DEFAULT);
}

/**
 * PayChain's client-facing markup on an Invoice STK prompt — the Invoicing
 * analogue of calculateCustomerSurcharge, with its own (slightly different)
 * band schedule. Free at or below FLAT_FEE_FREE_TIER_MAX_KES.
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} markup in KES, rounded to 2dp.
 */
export function calculateInvoiceClientMarkup(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (base <= FLAT_FEE_FREE_TIER_MAX_KES) return 0;
  const bands = getInvoiceClientMarkupBands();
  const band = bands.find((b) => base <= b.max) || bands[bands.length - 1];
  return round2(band.fee);
}

/**
 * PayChain's merchant-facing "Invoice Service Fee" — deducted from the
 * merchant's net settlement on a paid Invoice (software/workflow charge,
 * distinct from calculateMerchantFee's disabled general M-Pesa fee engine).
 * Flat KES 23 on every invoice, no free tier — the customer already pays
 * the normal tiered markup via calculateInvoiceClientMarkup above. Clamped
 * to never exceed the invoice's own base amount (same sanity-clamp
 * convention as calculateMerchantFee above), so a sub-KES-23 invoice can
 * never produce a negative merchant settlement.
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} fee in KES, rounded to 2dp.
 */
export function calculateInvoiceServiceFee(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return round2(Math.min(getInvoiceMerchantFlatFee(), base));
}

/**
 * Invoicing's version of getCheckoutTotal — the exact amount to send as the
 * STK Push `Amount` when the PaymentLink being paid is invoice-backed
 * (link.invoiceId set), using calculateInvoiceClientMarkup instead of the
 * generic calculateCustomerSurcharge.
 *
 * @param {number} baseInvoiceAmount
 * @returns {number} total in KES to request via STK Push.
 * @throws {PricingEngineError} if baseInvoiceAmount isn't a positive number.
 */
export function getInvoiceCheckoutTotal(baseInvoiceAmount) {
  const base = Number(baseInvoiceAmount);
  if (!Number.isFinite(base) || base <= 0) {
    throw new PricingEngineError(`baseInvoiceAmount must be a positive number, received "${baseInvoiceAmount}"`);
  }
  return round2(base + calculateInvoiceClientMarkup(base));
}

/**
 * Splits a completed STK Push settlement between the merchant and PayChain.
 * Called from mpesaController.js#resolveStkOutcome once the payment is
 * confirmed — `totalMpesaReceived` is what was actually credited
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
  // confirmationURL/resolveStkOutcome (calculateMerchantFee above). One
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
 * Invoicing's version of processSplitTransaction — settles a paid Invoice
 * (mpesaController.js#resolveStkOutcome, when the PaymentLink being
 * resolved has link.invoiceId set). Same shape and same ledger guard as
 * processSplitTransaction, but the merchant fee comes from
 * calculateInvoiceServiceFee (the Invoice Service Fee) instead of
 * calculateMerchantFee, which stays disabled for every other product.
 *
 * @param {number} totalMpesaReceived
 * @param {number} baseInvoiceAmount
 * @returns {{ customerFee: number, merchantFee: number, paychainTotalRevenue: number, merchantNetSettlement: number }}
 * @throws {PricingEngineError} on invalid input, or if the ledger identity
 *         fails to hold.
 */
export function processInvoiceSplitTransaction(totalMpesaReceived, baseInvoiceAmount) {
  const total = Number(totalMpesaReceived);
  const base = Number(baseInvoiceAmount);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(base) || base <= 0) {
    throw new PricingEngineError(
      `processInvoiceSplitTransaction requires positive numbers — received totalMpesaReceived="${totalMpesaReceived}", baseInvoiceAmount="${baseInvoiceAmount}"`
    );
  }

  // Client Fee — whatever was collected beyond the invoice's base bill
  // (calculateInvoiceClientMarkup, baked into the STK total at
  // getInvoiceCheckoutTotal time).
  const customerFee = round2(total - base);

  // Merchant Invoice Service Fee — the one place on this page a merchant is
  // actually charged a fee today (calculateMerchantFee stays disabled
  // everywhere else).
  const merchantFee = calculateInvoiceServiceFee(base);

  const paychainTotalRevenue = round2(customerFee + merchantFee);
  const merchantNetSettlement = round2(base - merchantFee);

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
