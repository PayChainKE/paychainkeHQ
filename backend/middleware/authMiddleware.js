import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Merchant from '../models/Merchant.js';
import Developer from '../models/Developer.js';
import ApiKey from '../models/ApiKey.js';

// Auth guards. Always respond with { error, code } on failure so the admin/
// merchant frontends can surface a useful message instead of the generic
// "Could not send code" / "Failed to update" fallbacks. `code` lets clients
// distinguish session expiry (TOKEN_EXPIRED) from other auth problems so
// they can route to re-login vs show a banner.

const fail = (res, status, code, error) => res.status(status).json({ error, code });

const extractToken = (req) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
};

const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    const msg  = code === 'TOKEN_EXPIRED'
      ? 'Your session has expired. Please sign in again.'
      : 'Session invalid. Please sign in again.';
    return fail(res, 401, code, msg);
  }

  try {
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return fail(res, 401, 'ADMIN_NOT_FOUND', 'Admin account no longer exists. Please sign in again.');
    if (admin.status && admin.status !== 'active') {
      return fail(res, 403, 'ADMIN_INACTIVE', `Admin account is ${admin.status}. Contact an owner.`);
    }
    // Tokens issued before this field existed carry no tokenVersion claim —
    // treat that as version 0 so old sessions keep working until the first
    // password change bumps the account forward. Mirrors protectMerchant.
    if ((decoded.tokenVersion || 0) !== (admin.tokenVersion || 0)) {
      return fail(res, 401, 'SESSION_REVOKED', 'This session was signed out remotely. Please sign in again.');
    }
    req.admin = admin;
    return next();
  } catch (err) {
    console.error('protect() admin lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify admin session. Try again.');
  }
};

// SSE-only variant of protect() — EventSource can't set custom headers, so
// the admin dashboard's live-updates connection has to pass its token as a
// query param instead of Authorization. Deliberately not folded into
// extractToken()/protect() themselves: that would open a query-string auth
// path on every admin route, not just this one (URLs get logged/cached in
// more places than headers do — fine for this single long-lived read-only
// stream, not fine as a blanket auth mechanism).
const protectAdminSSE = async (req, res, next) => {
  const token = extractToken(req) || (typeof req.query.token === 'string' ? req.query.token : null);
  if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return fail(res, 401, code, 'Session invalid. Please sign in again.');
  }

  try {
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return fail(res, 401, 'ADMIN_NOT_FOUND', 'Admin account no longer exists. Please sign in again.');
    if (admin.status && admin.status !== 'active') {
      return fail(res, 403, 'ADMIN_INACTIVE', `Admin account is ${admin.status}. Contact an owner.`);
    }
    if ((decoded.tokenVersion || 0) !== (admin.tokenVersion || 0)) {
      return fail(res, 401, 'SESSION_REVOKED', 'This session was signed out remotely. Please sign in again.');
    }
    req.admin = admin;
    return next();
  } catch (err) {
    console.error('protectAdminSSE() admin lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify admin session. Try again.');
  }
};

const protectMerchant = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    const msg  = code === 'TOKEN_EXPIRED'
      ? 'Your session has expired. Please sign in again.'
      : 'Session invalid. Please sign in again.';
    return fail(res, 401, code, msg);
  }

  try {
    const merchant = await Merchant.findById(decoded.id).select('-password');
    if (!merchant) return fail(res, 401, 'MERCHANT_NOT_FOUND', 'Merchant account no longer exists. Please sign in again.');

    // Mirrors protect()'s admin.status check above — without this, an
    // account an admin locks (e.g. for suspected fraud) could keep using
    // its still-valid JWT to hit every merchant route, including money
    // movement like Bulk Pay's authorizeBatch, since locking previously
    // only blocked a *new* login rather than an existing session. Found
    // during a security review of the bulk-pay flow: adminController.js's
    // lock action sets status='locked' but never bumped tokenVersion, and
    // no route checked status on every request — so a lock had no actual
    // enforcement point once a merchant already held a token.
    if (merchant.status === 'locked') {
      return fail(res, 403, 'MERCHANT_LOCKED', 'This account has been locked. Contact support.');
    }

    // Tokens issued before this field existed carry no tokenVersion claim —
    // treat that as version 0 so old sessions keep working until the first
    // "Sign Out All Devices" bumps the account forward.
    if ((decoded.tokenVersion || 0) !== (merchant.tokenVersion || 0)) {
      return fail(res, 401, 'SESSION_REVOKED', 'This session was signed out remotely. Please sign in again.');
    }

    req.merchant = merchant;
    return next();
  } catch (err) {
    console.error('protectMerchant() lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify session. Try again.');
  }
};

// Same relaxation as protectAdminSSE above, for the exact same reason:
// EventSource can't set an Authorization header, so the merchant dashboard's
// live-events stream alone accepts the token as a query param too. Reuses
// protectMerchant's own status/tokenVersion checks rather than duplicating
// them, so a locked account or a revoked session can't keep an SSE
// connection open either.
const protectMerchantSSE = async (req, res, next) => {
  if (!extractToken(req) && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return protectMerchant(req, res, next);
};

const protectDeveloper = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    const msg  = code === 'TOKEN_EXPIRED'
      ? 'Your session has expired. Please sign in again.'
      : 'Session invalid. Please sign in again.';
    return fail(res, 401, code, msg);
  }

  try {
    const developer = await Developer.findById(decoded.id).select('-password');
    if (!developer) return fail(res, 401, 'DEVELOPER_NOT_FOUND', 'Developer account no longer exists. Please sign in again.');

    if (developer.status === 'suspended') {
      return fail(res, 403, 'DEVELOPER_SUSPENDED', 'This account has been suspended. Contact PayChain support.');
    }

    if ((decoded.tokenVersion || 0) !== (developer.tokenVersion || 0)) {
      return fail(res, 401, 'SESSION_REVOKED', 'This session was signed out remotely. Please sign in again.');
    }

    req.developer = developer;
    return next();
  } catch (err) {
    console.error('protectDeveloper() lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify session. Try again.');
  }
};

// Authenticates actual public-API traffic — a completely different shape
// from the JWT guards above. Callers send the raw API key as a bearer
// token (or X-API-Key header); it's SHA-256 hashed and looked up directly
// (a DB equality query, not a manual compare, so timing-safety isn't a
// concern the way it is for the OTP/password checks elsewhere in this app).
const extractApiKey = (req) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return String(headerKey).trim();
  return null;
};

const authenticateApiKey = async (req, res, next) => {
  const rawKey = extractApiKey(req);
  if (!rawKey) return fail(res, 401, 'NO_API_KEY', 'Missing API key. Pass it as "Authorization: Bearer <key>" or "X-API-Key".');

  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const apiKey = await ApiKey.findOne({ hashedKey, status: 'active' });
    if (!apiKey) return fail(res, 401, 'INVALID_API_KEY', 'Invalid or revoked API key.');

    const developer = await Developer.findById(apiKey.developerId).select('-password');
    if (!developer || developer.status !== 'active') {
      return fail(res, 401, 'INVALID_API_KEY', 'Invalid or revoked API key.');
    }

    // Fire-and-forget — never block or fail the actual API call on this.
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch((err) => {
      console.error('authenticateApiKey: failed to update lastUsedAt:', err?.message || err);
    });

    req.apiKey = apiKey;
    req.developer = developer;
    return next();
  } catch (err) {
    console.error('authenticateApiKey() lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify API key. Try again.');
  }
};

// Role gate for admin routes — must run after `protect` (relies on
// req.admin already being attached). `Admin.role` is 'owner'|'admin'|
// 'analyst' (models/Admin.js); analyst is meant to be a read-only reporting
// tier, but nothing enforced that beyond team management until now — every
// mutating admin route should list which roles may actually call it.
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.admin) {
    return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');
  }
  if (!allowedRoles.includes(req.admin.role)) {
    return fail(res, 403, 'INSUFFICIENT_ROLE', 'Your admin role does not have permission to perform this action.');
  }
  return next();
};

export { protect, protectAdminSSE, protectMerchant, protectMerchantSSE, protectDeveloper, authenticateApiKey, requireRole };
