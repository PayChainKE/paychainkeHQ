import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Merchant from '../models/Merchant.js';

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
    decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    req.admin = admin;
    return next();
  } catch (err) {
    console.error('protect() admin lookup failed:', err);
    return fail(res, 500, 'AUTH_LOOKUP_FAILED', 'Could not verify admin session. Try again.');
  }
};

const protectMerchant = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
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

export { protect, protectMerchant };
