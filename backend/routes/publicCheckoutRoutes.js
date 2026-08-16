import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import {
  getPublicCheckoutSession,
  payCheckoutSession,
  getCheckoutSessionStatus,
} from '../controllers/publicCheckoutController.js';

const router = express.Router();

// This whole router is unauthenticated by design — a malformed/garbage :id
// (a typo'd link, a bot probing paths, a truncated copy-paste) is expected,
// routine traffic here in a way it isn't on an API-key-gated route. Without
// this guard, Mongoose throws a CastError on the query itself and every
// controller's catch-all turns that into a scary "Server Error" 500 for
// what's really just "this link doesn't exist" — a clean 404 instead.
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Checkout link not found or no longer valid.' });
  }
  next();
});

// Unauthenticated and money-adjacent — the session id is effectively a
// bearer token (same trust model as any hosted-checkout link), so this
// gets its own IP-keyed limiter independent of the API-key-authenticated
// Developer API's. Status polling gets a looser cap than pay/details since
// the hosted page calls it repeatedly while waiting on an STK response.
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

const statusPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

router.get('/:id', checkoutLimiter, getPublicCheckoutSession);
router.post('/:id/pay', checkoutLimiter, payCheckoutSession);
router.get('/:id/status', statusPollLimiter, getCheckoutSessionStatus);

export default router;
