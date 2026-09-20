import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { authenticateApiKey, extractApiKey } from '../middleware/authMiddleware.js';
import { ping } from '../controllers/developerPublicController.js';
import {
  collectPayment,
  payoutPayment,
  getPaymentStatus,
} from '../controllers/developerPaymentController.js';
import {
  createCheckoutSession,
  getCheckoutSession,
} from '../controllers/developerCheckoutController.js';
import {
  createDeveloperInvoice,
  sendDeveloperInvoice,
  getDeveloperInvoice,
  listDeveloperInvoices,
} from '../controllers/developerInvoiceController.js';
import {
  createDeveloperBulkPayment,
  getDeveloperBulkPaymentBatch,
} from '../controllers/developerBulkPayController.js';

const router = express.Router();

// Rate limits. Payment traffic from a real integration (an e-shop, a ticketing
// site) all arrives from ONE server IP, so limiting by IP would throttle every
// one of that developer's customers together. The real limits are therefore
// per API key and run AFTER authentication; the IP-keyed limiter below only
// counts failed key lookups, so it blocks key-guessing without ever slowing
// down a valid integration.
const WINDOW_MS = 15 * 60 * 1000;
const perKey = (req) => String(req.apiKey._id);
const envInt = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Keys that authenticated successfully in the last minute. The bad-key limiter
// skips them, so one misconfigured client hammering a wrong key can't lock a
// working integration out of a shared server IP. Key-guessing traffic never
// authenticates, so it never gets into this list.
const RECENTLY_VALID_MS = 60 * 1000;
const recentlyValid = new Map(); // hashedKey -> expiry timestamp
function rememberValidKey(req, res, next) {
  const now = Date.now();
  if (recentlyValid.size > 5000) {
    for (const [k, exp] of recentlyValid) if (exp < now) recentlyValid.delete(k);
  }
  recentlyValid.set(req.apiKey.hashedKey, now + RECENTLY_VALID_MS);
  next();
}
function isRecentlyValidKey(req) {
  const raw = extractApiKey(req);
  if (!raw) return false;
  const exp = recentlyValid.get(crypto.createHash('sha256').update(raw).digest('hex'));
  return Boolean(exp && exp > Date.now());
}

const badKeyLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: envInt('DEV_API_BAD_KEY_LIMIT', 100),
  standardHeaders: true,
  legacyHeaders: false,
  // Only responses to a rejected key (401) count towards this limit.
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  skip: isRecentlyValidKey,
  message: { error: 'Too many failed authentication attempts. Try again later.' },
});

// Reads and status polling.
const readLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: envInt('DEV_API_READ_LIMIT', 900),
  keyGenerator: perKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this API key. Slow down.' },
});

// Customer-initiated collections (STK push, hosted checkout sessions). These
// spike with real traffic (a ticket sale, a flash sale), so the ceiling is
// generous: about 40 a minute per key. Each one is still idempotent-keyed.
const collectLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: envInt('DEV_API_COLLECT_LIMIT', 600),
  keyGenerator: perKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests for this API key. Slow down.' },
});

// Money leaving the wallet (payouts, bulk payments) or sending email
// (invoices). Deliberately tight: these are merchant-initiated, never
// customer-driven spikes.
const payoutLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: envInt('DEV_API_PAYOUT_LIMIT', 60),
  keyGenerator: perKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payout requests for this API key. Slow down.' },
});

router.get('/ping', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, ping);

router.post('/payments/collect', badKeyLimiter, authenticateApiKey, rememberValidKey, collectLimiter, collectPayment);
router.post('/payments/payout', badKeyLimiter, authenticateApiKey, rememberValidKey, payoutLimiter, payoutPayment);
router.get('/payments/:id', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, getPaymentStatus);

// Hosted checkout — create a payment link to redirect a customer to
// (the public, unauthenticated /pay/:id page lives under
// /api/public/checkout, see publicCheckoutRoutes.js).
router.post('/checkout', badKeyLimiter, authenticateApiKey, rememberValidKey, collectLimiter, createCheckoutSession);
router.get('/checkout/:id', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, getCheckoutSession);

// Invoices — create/send a real, payable invoice. Creating one moves no
// money (only the customer paying it does), so it shares the read limit;
// sending one emails the customer, so that shares the tight one.
router.post('/invoices', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, createDeveloperInvoice);
router.get('/invoices', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, listDeveloperInvoices);
router.get('/invoices/:id', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, getDeveloperInvoice);
router.post('/invoices/:id/send', badKeyLimiter, authenticateApiKey, rememberValidKey, payoutLimiter, sendDeveloperInvoice);

// Bulk payments — many payouts (payroll and/or contract/vendor
// settlements) in one call. Real money movement.
router.post('/bulk-payments', badKeyLimiter, authenticateApiKey, rememberValidKey, payoutLimiter, createDeveloperBulkPayment);
router.get('/bulk-payments/:batchId', badKeyLimiter, authenticateApiKey, rememberValidKey, readLimiter, getDeveloperBulkPaymentBatch);

export default router;
