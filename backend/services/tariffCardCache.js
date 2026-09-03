import { AsyncLocalStorage } from 'async_hooks';
import TariffCard from '../models/TariffCard.js';
import Merchant from '../models/Merchant.js';

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

// Grandfathering (Brandon, 2026-09-03): while code is running inside
// withMerchantTariffLock(merchant, fn) below, getTariffFlat/getTariffBands
// transparently read that merchant's own locked snapshot (Merchant.tariffLock)
// instead of the live global cache above — with zero signature changes to any
// of the ~15 pricing functions in config/*TariffCard.js / pricingEngine.js
// that call them. AsyncLocalStorage propagates through every `await` in the
// chain started by .run() (nested service calls, Transaction.create/.save(),
// its pre-save hook), so wrapping once at a controller's entry point is
// enough — no need to pass a merchant/lock parameter down through every
// intermediate function. If the store is ever empty (not wrapped, or a
// merchant with no lock yet), both getters simply fall through to the
// existing live-cache/fallback behavior below — same as before this feature
// existed, so an unwrapped call site never breaks, it just isn't grandfathered.
const merchantTariffContext = new AsyncLocalStorage();

/**
 * Materializes the CURRENT live tariff sheet (global cache, falling back to
 * each key's own seeded default) as a plain snapshot object suitable for
 * storing on Merchant.tariffLock. Called once at signup (locks in whatever is
 * live at that moment) and once by the one-time backfill migration (locks in
 * today's rates for every merchant who already existed before this feature).
 *
 * @returns {Record<string, {shape:'flat'|'tiered', flatFee:number|null, bands:{max:number,fee:number}[]}>}
 */
export function snapshotCurrentTariffs() {
  const snapshot = {};
  for (const [key, doc] of cache.entries()) {
    snapshot[key] = {
      shape: doc.shape,
      flatFee: typeof doc.flatFee === 'number' ? doc.flatFee : null,
      bands: Array.isArray(doc.bands) ? doc.bands.map((b) => ({ max: b.max, fee: b.fee })) : [],
    };
  }
  return snapshot;
}

/**
 * Runs `fn` with every getTariffFlat/getTariffBands call inside it (however
 * deeply nested, across however many awaited calls) reading `merchantOrId`'s
 * locked tariff snapshot instead of the live global cache. Accepts either an
 * already-loaded merchant doc (uses its `tariffLock` directly, no extra
 * query) or a bare merchantId/ObjectId (looked up here) — every known call
 * site has one or the other in scope, so callers never need to fetch a
 * merchant doc solely to grandfather its pricing. Silently falls through to
 * `fn()` un-wrapped (live global cache) if no id is given, the merchant can't
 * be found, or it has no lock yet — never throws, since a pricing lookup can
 * never be allowed to break a real payment.
 *
 * @template T
 * @param {import('mongoose').Document|string|import('mongoose').Types.ObjectId|null|undefined} merchantOrId
 * @param {() => T} fn
 * @returns {Promise<T>}
 */
export async function withMerchantTariffLock(merchantOrId, fn) {
  if (!merchantOrId) return fn();

  // Duck-types "a loaded merchant doc" (has `_id`) vs. "a bare id" (a string
  // or an ObjectId instance, neither of which carries an `_id` field of its
  // own) — covers every shape any real call site passes in.
  const hasIdField = typeof merchantOrId === 'object' && merchantOrId._id != null;
  let lock = hasIdField ? merchantOrId.tariffLock : null;

  if (!lock || typeof lock !== 'object' || Object.keys(lock).length === 0) {
    const id = hasIdField ? merchantOrId._id : merchantOrId;
    try {
      const doc = await Merchant.findById(id).select('tariffLock').lean();
      lock = doc?.tariffLock || null;
    } catch {
      return fn();
    }
  }

  if (!lock || typeof lock !== 'object' || Object.keys(lock).length === 0) return fn();
  return merchantTariffContext.run(lock, fn);
}

/**
 * Flat-fee read — returns the cached value if a valid 'flat' card exists
 * under `key`, else `fallback` (the code's own hardcoded default constant).
 * Never throws, never returns undefined.
 */
export function getTariffFlat(key, fallback) {
  const lock = merchantTariffContext.getStore();
  const lockedCard = lock?.[key];
  if (lockedCard && lockedCard.shape === 'flat' && typeof lockedCard.flatFee === 'number' && Number.isFinite(lockedCard.flatFee)) {
    return lockedCard.flatFee;
  }

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
function bandsMatchShape(bands, fallbackBands) {
  if (!Array.isArray(bands) || bands.length !== fallbackBands.length) return false;
  for (let i = 0; i < fallbackBands.length; i++) {
    if (bands[i]?.max !== fallbackBands[i].max || typeof bands[i]?.fee !== 'number' || !Number.isFinite(bands[i].fee)) {
      return false;
    }
  }
  return true;
}

export function getTariffBands(key, fallbackBands) {
  const lock = merchantTariffContext.getStore();
  const lockedCard = lock?.[key];
  if (lockedCard && lockedCard.shape === 'tiered' && bandsMatchShape(lockedCard.bands, fallbackBands)) {
    return lockedCard.bands;
  }

  const doc = cache.get(key);
  if (!doc || doc.shape !== 'tiered' || !bandsMatchShape(doc.bands, fallbackBands)) {
    return fallbackBands;
  }
  return doc.bands;
}
