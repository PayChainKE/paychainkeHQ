import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { initiateSTKPush, getSTKStatus, initiateB2C, initiateB2B, generateQrCheckout, generateAccountQr } from '../controllers/mpesaController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

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

// /stk-push sends a real prompt to whatever phone number is given ("Request
// Money" targets a third party, not just the merchant's own number) — with
// no limiter here, an authenticated merchant account (a low bar — just a
// signup) could be used to spam unlimited STK prompts at any Kenyan number,
// the same harassment vector transactionRoutes.js's payAccountLimiter
// already guards against on the public payment-link/pay-account routes.
// Keyed per-merchant (not per-IP) so the limit follows the account rather
// than being trivially bypassed by rotating networks.
const stkPushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.merchant?._id ? String(req.merchant._id) : ipKeyGenerator(req.ip)),
  message: { error: 'Too many STK Push requests. Try again in 15 minutes.' },
});

// STK Push Routes (Inbound, via NCBA)
router.post('/stk-push', protectMerchant, stkPushLimiter, initiateSTKPush);
router.get('/stk-status/:checkoutId', protectMerchant, getSTKStatus);

// Dynamic QR Code collection (Inbound, via NCBA) — same abuse shape as STK
// (a real NCBA API call an authenticated account could otherwise spam),
// same limiter.
router.post('/generate-qr', protectMerchant, stkPushLimiter, generateQrCheckout);
// Open-amount "my account" QR (Wallet page, MyAccounts modal) — same
// abuse shape, lighter limiter since it's just a standing display code a
// page might regenerate on load rather than a per-checkout action.
router.get('/account-qr', protectMerchant, stkPushLimiter, generateAccountQr);

// B2C Routes (Outbound to a phone number, via NCBA Mobile B2W)
router.post('/b2c-request', protectMerchant, pinLimiter, initiateB2C);

// B2B Routes (Outbound to a Paybill/Till, via NCBA Lipa na M-Pesa)
router.post('/b2b-request', protectMerchant, pinLimiter, initiateB2B);

export default router;
