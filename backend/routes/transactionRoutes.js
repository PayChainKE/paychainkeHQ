import express from 'express';
import { getTransactions, simulateIncomingPayment } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/simulate', simulateIncomingPayment);
router.get('/', protectMerchant, getTransactions);

export default router;
