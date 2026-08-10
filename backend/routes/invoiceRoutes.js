import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  sendInvoice,
  deleteInvoice,
  getPublicInvoice,
  peekNextInvoiceNumber,
} from '../controllers/invoiceController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// invoice.customer.email is set freely by the merchant — it's not their own
// on-file account email — so this endpoint can email/notify an arbitrary
// third party. Without a dedicated throttle, a malicious/compromised
// merchant account could repeatedly re-send the same invoice to bomb a
// victim's inbox, bounded only by the shared 600/15min global backstop.
// Keyed per-merchant (not per-IP) since the abuse case is one account
// hammering one endpoint, not distributed traffic.
const sendInvoiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.merchant?._id ? String(req.merchant._id) : ipKeyGenerator(req.ip)),
  message: { error: 'Too many invoices sent in the past hour. Try again later.' },
});

// Public — the customer-facing invoice view/pay page reads this, no auth.
router.get('/public/:publicToken', getPublicInvoice);

router.get('/next-number', protectMerchant, peekNextInvoiceNumber);
router.get('/', protectMerchant, listInvoices);
router.post('/', protectMerchant, createInvoice);
router.put('/:id', protectMerchant, updateInvoice);
router.post('/:id/send', protectMerchant, sendInvoiceLimiter, sendInvoice);
router.delete('/:id', protectMerchant, deleteInvoice);

export default router;
