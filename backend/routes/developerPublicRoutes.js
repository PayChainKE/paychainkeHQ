import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey } from '../middleware/authMiddleware.js';
import { ping } from '../controllers/developerPublicController.js';

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

router.get('/ping', publicApiLimiter, authenticateApiKey, ping);

export default router;
