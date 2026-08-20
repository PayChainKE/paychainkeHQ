import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { getConfig, initDevice, syncItems, signInvoice, issueCreditNote, dailyZReport } from '../controllers/etimsController.js';

const router = express.Router();

// Signing/credit-note calls hit KRA's live tax infrastructure and consume
// an ascending, unrepeatable invcNo sequence — a runaway retry loop here
// isn't just wasted quota, it burns real sequence numbers KRA will never
// let be reused. Keyed per-merchant, mirroring routes/invoiceRoutes.js's
// sendInvoiceLimiter.
const signLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.merchant?._id ? String(req.merchant._id) : ipKeyGenerator(req.ip)),
  message: { success: false, error: 'Too many eTIMS signing requests. Slow down.' },
});

router.get('/config', protectMerchant, getConfig);
router.post('/init', protectMerchant, initDevice);
router.post('/items/sync', protectMerchant, syncItems);
router.post('/invoices/sign', protectMerchant, signLimiter, signInvoice);
router.post('/invoices/credit-note', protectMerchant, signLimiter, issueCreditNote);
router.get('/reports/daily-z', protectMerchant, dailyZReport);

export default router;
