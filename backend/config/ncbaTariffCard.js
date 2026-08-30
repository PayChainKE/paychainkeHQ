// NCBA Virtual Account collection tariff.
//
// Platform-wide pricing rule (Brandon, 2026-08-30): money IN is never
// charged to the merchant — only money OUT is. The merchant is always
// credited the full grossAmount for an inbound NCBA collection (raw Paybill
// deposit, bank transfer, or any other NCBA account-notification credit),
// regardless of amount. This mirrors the STK Push / QR / Payment Link /
// Wallet Top-Up flows, which already bill their entire fee to the paying
// customer via the checkout-total surcharge (pricingEngine.js's
// splitCustomerSurcharge) rather than the merchant.
//
// Extended the same day: PayChain also does not compute, track, or deduct
// a "Safaricom fee" for this rail anymore. Under the Business Bouquet
// Paybill tariff PayChain operates under, Safaricom's own cut is collected
// automatically from the paying customer's M-Pesa account as part of their
// send — PayChain never sees that money, never pays it away, and never
// touches it. Modeling a `safaricomFee` here (as an earlier version of this
// file did, as a "cost PayChain absorbs") double-counted a third-party fee
// that Safaricom already deducts on its own, invisibly to PayChain's ledger
// — so it's gone entirely rather than just excluded from the merchant's
// deduction. If PayChain ever needs a real, PayChain-borne network cost
// line for this rail in the future, it should come from an actual NCBA/
// Safaricom settlement statement, not a guessed tariff band.
export const MAX_NCBA_COLLECTION_AMOUNT = 250_000;

export class NcbaTariffBoundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaTariffBoundsError';
  }
}

/**
 * Look up the NCBA collection cost for a given gross amount. Money IN is
 * never charged to the merchant, and PayChain does not model a third-party
 * Safaricom fee for this rail (see this file's header comment) — every
 * field here is always 0. Kept as a function (rather than removed outright)
 * purely so callers don't need special-casing, and so a future real,
 * PayChain-borne cost for this rail has a single place to be reintroduced.
 *
 * @param {number} grossAmount
 * @returns {{ safaricomFee: number, markup: number, totalFee: number }}
 * @throws {NcbaTariffBoundsError} if grossAmount is non-positive, non-finite,
 *         or exceeds MAX_NCBA_COLLECTION_AMOUNT.
 */
export function getNcbaTariffBand(grossAmount) {
  const amount = Number(grossAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new NcbaTariffBoundsError(`grossAmount must be a positive number, received "${grossAmount}"`);
  }
  if (amount > MAX_NCBA_COLLECTION_AMOUNT) {
    throw new NcbaTariffBoundsError(
      `grossAmount KES ${amount} exceeds the maximum NCBA collection limit of KES ${MAX_NCBA_COLLECTION_AMOUNT}`
    );
  }

  return { safaricomFee: 0, markup: 0, totalFee: 0 };
}
