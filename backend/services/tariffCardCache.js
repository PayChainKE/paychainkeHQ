import TariffCard from '../models/TariffCard.js';

// In-memory read path for every admin-editable tariff value — deliberately
// kept synchronous so none of the ~15 pricing functions across
// config/*TariffCard.js / utils/pricingEngine.js that consume it need to
// become async, and none of their real callers (bulkPayController.js,
// mpesaController.js, ncbaOpenBankingController.js, the Transaction
// pre-save hook) need any change at all.
//
// Populated at boot (server.js's bootstrap, after seedTariffCards.js has
// run), refreshed immediately in-process after every confirmed admin edit
// (tariffController.js#confirmTariffUpdate), and re-loaded on a 5-minute
// interval as a defensive fallback (mirrors
// services/ncbaOpenBankingReconciliationService.js's own 5-min sweep
// convention) in case this ever runs as more than one instance.
let cache = new Map();

export async function loadTariffCache() {
  const docs = await TariffCard.find({}).lean();
  const next = new Map();
  for (const doc of docs) next.set(doc.key, doc);
  cache = next;
}

export function startTariffCacheRefreshInterval() {
  setInterval(() => {
    loadTariffCache().catch((e) => console.error('Tariff cache refresh failed:', e));
  }, 5 * 60 * 1000);
}

/**
 * Flat-fee read — returns the cached value if a valid 'flat' card exists
 * under `key`, else `fallback` (the code's own hardcoded default constant).
 * Never throws, never returns undefined.
 */
export function getTariffFlat(key, fallback) {
  const doc = cache.get(key);
  if (!doc || doc.shape !== 'flat' || typeof doc.flatFee !== 'number' || !Number.isFinite(doc.flatFee)) {
    return fallback;
  }
  return doc.flatFee;
}

/**
 * Tiered-band read — returns the cached `bands` array if a valid 'tiered'
 * card exists under `key` AND its shape (band count + each band's `max`,
 * in order) exactly matches `fallbackBands`, else `fallbackBands` itself.
 * The shape check is the real safety net: even if a bad write ever slipped
 * past request-time validation, a shape-mismatched cache entry is simply
 * never trusted for pricing — callers always get a well-formed band list
 * they can safely `.find(b => amount <= b.max)` over.
 *
 * @param {string} key
 * @param {{max:number, fee:number}[]} fallbackBands
 * @returns {{max:number, fee:number}[]}
 */
export function getTariffBands(key, fallbackBands) {
  const doc = cache.get(key);
  if (!doc || doc.shape !== 'tiered' || !Array.isArray(doc.bands) || doc.bands.length !== fallbackBands.length) {
    return fallbackBands;
  }
  for (let i = 0; i < fallbackBands.length; i++) {
    if (doc.bands[i]?.max !== fallbackBands[i].max || typeof doc.bands[i]?.fee !== 'number' || !Number.isFinite(doc.bands[i].fee)) {
      return fallbackBands;
    }
  }
  return doc.bands;
}
