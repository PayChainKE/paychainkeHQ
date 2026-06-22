import express from 'express';
import { getTransactions, simulateIncomingPayment } from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/simulate', simulateIncomingPayment);
router.get('/', protect, getTransactions);

export default router;
