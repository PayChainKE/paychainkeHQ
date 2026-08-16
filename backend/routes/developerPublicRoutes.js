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

export default router;
