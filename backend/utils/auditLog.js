import AuditLog from '../models/AuditLog.js';

// Pull the real client IP off the request — Render sits behind Cloudflare so
// req.ip is the proxy unless we honour the X-Forwarded-For chain. We take the
// first hop (left-most entry) which is always the original client.
export function extractIp(req) {
  if (!req) return null;
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

// Trim long UAs so we don't bloat the collection.
function clipUa(req) {
  return String(req?.headers?.['user-agent'] || '').slice(0, 220) || null;
}

// Detect which client a request came from. Two-pronged:
//   1. Explicit X-Client-Platform header sent by our own apps (most reliable).
//   2. UA-pattern fallback for legacy builds or third-party callers.
// Returns 'web' | 'mobile' | 'unknown'.
export function detectPlatform(req) {
  if (!req) return 'unknown';
  const hdr = String(req.headers?.['x-client-platform'] || '').toLowerCase().trim();
  if (hdr === 'mobile' || hdr === 'web') return hdr;
  const ua = String(req.headers?.['user-agent'] || '').toLowerCase();
  if (!ua) return 'unknown';
  // Native HTTP clients used by React Native / Expo on iOS + Android.
  if (/okhttp|cfnetwork|darwin|expo|reactnative|paychain.?mobile/i.test(ua)) return 'mobile';
  // Standard browsers.
  if (/mozilla|chrome|safari|firefox|edg\/|opr\//i.test(ua)) return 'web';
  return 'unknown';
}

// Retention windows by severity.
// critical/warning events are kept longer because they are security-relevant.
const RETENTION_MS = {
  critical: 21 * 24 * 60 * 60 * 1000,  // 21 days
  warning:  21 * 24 * 60 * 60 * 1000,  // 21 days
  success:  14 * 24 * 60 * 60 * 1000,  // 14 days
  info:     14 * 24 * 60 * 60 * 1000,  // 14 days
};

// Fire-and-forget audit write. Never throws — if Mongo is down or the schema
// rejects something we just log and move on; never block the user's request.
//
// Required: action.  Recommended: merchant, message, category, severity, req.
// `merchant` can be the Mongoose doc or a plain object with { _id, email, name|businessName }.
// `actor` defaults to 'self' (merchant did it themselves) when omitted.
export function logAudit({
  action,
  category = 'auth',
  severity = 'info',
  message = '',
  merchant = null,
  actor = null,
  req = null,
  metadata = {},
}) {
  // Don't await — caller fires and forgets. Guard against silent in-process
  // crashes by catching the promise locally.
  (async () => {
    try {
      const subject = merchant
        ? {
            merchantId: merchant._id || null,
            merchantEmail: merchant.email || null,
            merchantName: merchant.businessName || merchant.name || null,
          }
        : { merchantId: null, merchantEmail: null, merchantName: null };

      const resolvedActor = actor || (merchant
        ? { type: 'self', id: merchant._id || null, email: merchant.email || null, name: merchant.name || merchant.businessName || null }
        : { type: 'system', id: null, email: null, name: 'system' });

      const safeMeta = {};
      if (metadata && typeof metadata === 'object') {
        for (const [k, v] of Object.entries(metadata)) {
          // Drop anything that looks like a credential or token — defence in
          // depth so a careless caller can't accidentally persist secrets.
          if (/password|secret|token|otp|pin|signature|seed/i.test(k)) continue;
          safeMeta[k] = typeof v === 'string' ? v.slice(0, 500) : v;
        }
      }

      await AuditLog.create({
        ...subject,
        actor: resolvedActor,
        action,
        category,
        severity,
        message: String(message || '').slice(0, 280),
        ip: extractIp(req),
        userAgent: clipUa(req),
        platform: detectPlatform(req),
        metadata: safeMeta,
        expiresAt: new Date(Date.now() + (RETENTION_MS[severity] ?? RETENTION_MS.info)),
      });
    } catch (err) {
      // Never surface audit failures — log to stderr and continue.
      console.error('audit log write failed:', err?.message || err);
    }
  })();
}
