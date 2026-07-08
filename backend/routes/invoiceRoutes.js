import express from 'express';
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  sendInvoice,
  deleteInvoice,
  getPublicInvoice,
} from '../controllers/invoiceController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public — the customer-facing invoice view/pay page reads this, no auth.
router.get('/public/:publicToken', getPublicInvoice);

router.get('/', protectMerchant, listInvoices);
router.post('/', protectMerchant, createInvoice);
router.put('/:id', protectMerchant, updateInvoice);
router.post('/:id/send', protectMerchant, sendInvoice);
router.delete('/:id', protectMerchant, deleteInvoice);

export default router;
