import express from 'express';
import { getTransactions, simulateIncomingPayment, swapKesToUsdc } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/simulate', simulateIncomingPayment);
router.post('/swap', protectMerchant, swapKesToUsdc);
router.get('/', protectMerchant, getTransactions);

export default router;
