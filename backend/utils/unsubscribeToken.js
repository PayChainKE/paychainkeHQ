import crypto from 'crypto';

// Signed, non-expiring tokens for the newsletter unsubscribe link. An
// unsubscribe link must keep working for as long as the email sits in an
// inbox, so there is deliberately no expiry — the token only ever lets its
// holder opt ONE address out of newsletters, nothing more, so a leaked one
// has no useful abuse. Signed (HMAC) so nobody can forge a token for an
// arbitrary subscriber/merchant id and unsubscribe people at will.
//
// Token shape: "<kind>.<id>.<signature>" where kind is 's' (newsletter
// subscriber) or 'm' (merchant account).
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || 'https://api.paychain.co.ke').replace(/\/+$/, '');

function secret() {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET or JWT_SECRET must be set to sign unsubscribe links.');
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(`unsubscribe:${payload}`).digest('base64url');
}

export function makeUnsubscribeToken(kind, id) {
  const payload = `${kind}.${id}`;
  return `${payload}.${sign(payload)}`;
}

// Returns { kind, id } for a genuine token, or null for anything else.
export function verifyUnsubscribeToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [kind, id, sig] = parts;
  if (!['s', 'm'].includes(kind) || !/^[a-f0-9]{24}$/i.test(id)) return null;
  const expected = Buffer.from(sign(`${kind}.${id}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return { kind, id };
}

export function unsubscribeUrl(kind, id) {
  return `${PUBLIC_API_URL}/api/newsletter/unsubscribe?t=${encodeURIComponent(makeUnsubscribeToken(kind, id))}`;
}
