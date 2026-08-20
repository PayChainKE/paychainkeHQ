import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey } from '../middleware/authMiddleware.js';
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

// A wrong/guessed key still costs a DB lookup — throttle independent of
// the app-wide global limiter, keyed by IP same as every other public
// credential-validation route in this app.
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

// Payment-initiating calls get a tighter, separate limiter — each one
// either moves real money or costs a real NCBA call, unlike /ping.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Slow down.' },
});

router.get('/ping', publicApiLimiter, authenticateApiKey, ping);

router.post('/payments/collect', paymentLimiter, authenticateApiKey, collectPayment);
router.post('/payments/payout', paymentLimiter, authenticateApiKey, payoutPayment);
router.get('/payments/:id', publicApiLimiter, authenticateApiKey, getPaymentStatus);

// Hosted checkout — create a payment link to redirect a customer to
// (the public, unauthenticated /pay/:id page lives under
// /api/public/checkout, see publicCheckoutRoutes.js).
router.post('/checkout', paymentLimiter, authenticateApiKey, createCheckoutSession);
router.get('/checkout/:id', publicApiLimiter, authenticateApiKey, getCheckoutSession);

// Invoices — create/send a real, payable invoice. Not money-moving at
// creation time (only the customer actually paying it is), so these share
// the lighter publicApiLimiter rather than paymentLimiter.
router.post('/invoices', publicApiLimiter, authenticateApiKey, createDeveloperInvoice);
router.get('/invoices', publicApiLimiter, authenticateApiKey, listDeveloperInvoices);
router.get('/invoices/:id', publicApiLimiter, authenticateApiKey, getDeveloperInvoice);
router.post('/invoices/:id/send', paymentLimiter, authenticateApiKey, sendDeveloperInvoice);

// Bulk payments — many payouts (payroll and/or contract/vendor
// settlements) in one call. Real money movement, so it shares
// paymentLimiter same as a single payout.
router.post('/bulk-payments', paymentLimiter, authenticateApiKey, createDeveloperBulkPayment);
router.get('/bulk-payments/:batchId', publicApiLimiter, authenticateApiKey, getDeveloperBulkPaymentBatch);

export default router;
