import { isDbReady, startBackgroundDbRetry } from '../config/database.js';

/**
 * Block DB-dependent routes until Mongo is connected. Avoids the opaque
 * "buffering timed out after 10000ms" error surfacing in login forms.
 */
export function requireDb(req, res, next) {
  if (isDbReady()) return next();

  startBackgroundDbRetry();
  return res.status(503).json({
    error: 'Database is temporarily unavailable. Please try again in a moment.',
  });
}
