import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateToken, registerURLs, validationURL, confirmationURL, initiateSTKPush, stkCallback, getSTKStatus, initiateB2C, initiateB2B, b2cCallback } from '../controllers/mpesaController.js';
import { protect, protectMerchant, requireRole } from '../middleware/authMiddleware.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const router = express.Router();

// initiateB2C checks a 4-digit PIN inline — same brute-force exposure as
// every other PIN-guarded endpoint in the app.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

// Daraja has no native webhook signature — the standard practical mitigation
// is a shared secret embedded in the callback URL itself, since we control
// every URL string handed to Safaricom (see mpesaController.js's
// CallBackURL/ResultURL/QueueTimeOutURL construction). Without this, these
// routes were public+unauthenticated and confirmationURL could be used to
// fabricate a merchant's balance from the open internet. Fails closed if
// the secret isn't configured at all, matching the NCBA webhook convention
// (verifyNcbaBasicAuth in ncbaRoutes.js).
function verifyMpesaWebhookSecret(req, res, next) {
  const expected = process.env.MPESA_WEBHOOK_SECRET;
  if (!expected) {
    console.error(JSON.stringify({ level: 'error', event: 'mpesa_webhook_auth_misconfigured', path: req.path }));
    return res.status(500).json({ error: 'Webhook authentication is not configured' });
  }
  const provided = req.query.key;
  if (!provided || !timingSafeStringEqual(String(provided), expected)) {
    console.warn(JSON.stringify({ level: 'warn', event: 'mpesa_webhook_auth_failed', path: req.path }));
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

// Reconfigures where Safaricom sends confirmations for the whole platform —
// not merchant-scoped, so admin-only (owner-only: this is platform routing,
// not a day-to-day admin action).
router.post('/register-urls', protect, requireRole('owner'), generateToken, registerURLs);

// Public webhook routes that Safaricom will ping — gated by the shared
// secret embedded in the URL registered with Safaricom (see registerURLs
// caller and the CallBackURL/ResultURL builders below).
router.post('/validation', verifyMpesaWebhookSecret, validationURL);
router.post('/confirmation', verifyMpesaWebhookSecret, confirmationURL);

// STK Push Routes (Inbound)
router.post('/stk-push', protectMerchant, generateToken, initiateSTKPush);
router.post('/stk-callback', verifyMpesaWebhookSecret, stkCallback); // Public webhook for Safaricom
router.get('/stk-status/:checkoutId', protectMerchant, getSTKStatus);

// B2C Routes (Outbound)
router.post('/b2c-request', protectMerchant, pinLimiter, generateToken, initiateB2C);
router.post('/b2c-callback', verifyMpesaWebhookSecret, b2cCallback); // Public webhook
router.post('/b2c-timeout', verifyMpesaWebhookSecret, b2cCallback); // Timeout webhook

// B2B Routes (Outbound — Paybill/Till) — reconciled by the same b2c-callback
// and b2c-timeout webhooks above (Daraja's B2B result payload has the same
// shape as B2C's).
router.post('/b2b-request', protectMerchant, pinLimiter, generateToken, initiateB2B);

export default router;
