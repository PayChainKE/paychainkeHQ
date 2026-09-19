import mongoose from 'mongoose';

// A developer account can be linked to several merchants, and each API key is
// tied to one of them. These helpers are the only place that knows how links
// are stored, including the legacy single `linkedMerchant` field that older
// developers still have.

// Every merchant the developer is linked to, as ObjectIds, de-duplicated.
export function linkedMerchantIds(developer) {
  const seen = new Set();
  const out = [];
  const add = (id) => {
    if (!id) return;
    const key = String(id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(key));
  };
  for (const l of developer?.linkedMerchants || []) add(l?.merchantId);
  add(developer?.linkedMerchant?.merchantId);
  return out;
}

export function isMerchantLinked(developer, merchantId) {
  const target = String(merchantId);
  return linkedMerchantIds(developer).some((id) => String(id) === target);
}

// The merchant an API key acts for, or null (a pure sandbox key).
//  - A key tied to a merchant uses it, but only while that merchant is still
//    linked (unlinking revokes the keys as well; this is the safety net).
//  - A key that predates per-key merchants is unambiguous only when the
//    developer has exactly one merchant, which is what it always meant.
export function resolveKeyMerchantId(apiKey, developer) {
  const ids = linkedMerchantIds(developer);
  if (apiKey?.merchantId) {
    return ids.some((id) => String(id) === String(apiKey.merchantId)) ? apiKey.merchantId : null;
  }
  return ids.length === 1 ? ids[0] : null;
}

// Extra query filter for read endpoints. A key tied to a merchant only sees
// that merchant's records, so a key handed to one client can never read
// another client's payments. Keys with no merchant keep seeing everything the
// developer account owns, as before.
export function keyScope(apiKey) {
  return apiKey?.merchantId ? { merchantId: apiKey.merchantId } : {};
}

// Idempotency keys are chosen by the caller. Once one developer account
// serves several merchants, two shops can legitimately both send "order-1001",
// so the key is namespaced by merchant, otherwise the second shop would get
// the first shop's payment back as a "replay". Developers with a single
// merchant keep their raw key, so nothing changes for them.
export function scopedIdempotencyKey(developer, merchantId, rawKey) {
  if (linkedMerchantIds(developer).length <= 1) return rawKey;
  return `${merchantId ? String(merchantId) : 'sandbox'}:${rawKey}`;
}

// Live access is approved per merchant. Returns the state for one linked
// merchant: { approved, requestedAt, approvedAt, autoTest }.
//  - A merchant in the linkedMerchants list is authoritative.
//  - A developer approved at developer level, before approval became per
//    merchant, keeps that approval for the merchant that was their sole link,
//    until it is migrated into the list (services/developerMerchantLinkService.js).
export function liveAccessFor(developer, merchantId) {
  const target = String(merchantId);
  const entry = (developer?.linkedMerchants || []).find((l) => String(l.merchantId) === target);
  if (entry) {
    const la = entry.liveAccess || {};
    return { approved: !!la.approved, requestedAt: la.requestedAt || null, approvedAt: la.approvedAt || null, autoTest: la.autoTest || null };
  }
  const legacyId = developer?.linkedMerchant?.merchantId;
  if (legacyId && String(legacyId) === target) {
    const la = developer.liveAccess || {};
    return { approved: !!la.approved, requestedAt: la.requestedAt || null, approvedAt: la.approvedAt || null, autoTest: la.autoTest || null };
  }
  return { approved: false, requestedAt: null, approvedAt: null, autoTest: null };
}

// One-line summary across all of a developer's merchants, for lists and for
// older clients that only knew a single developer-level state.
export function liveAccessSummary(developer) {
  const states = linkedMerchantIds(developer).map((id) => liveAccessFor(developer, id));
  const approved = states.filter((s) => s.approved);
  const pending = states.filter((s) => !s.approved && s.requestedAt);
  return {
    approved: approved.length > 0,
    requestedAt: pending.length ? pending[0].requestedAt : null,
    approvedAt: approved.length ? approved[0].approvedAt : null,
    approvedCount: approved.length,
    pendingCount: pending.length,
  };
}
