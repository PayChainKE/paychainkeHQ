import express from 'express';
import { getTransactions, simulateIncomingPayment, swapKesToUsdc, activateWallet, getLiveRate, sendMoney, syncWalletBalance } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/simulate', simulateIncomingPayment);
router.post('/swap', protectMerchant, swapKesToUsdc);
router.post('/activate-wallet', protectMerchant, activateWallet);
router.post('/sync-wallet', protectMerchant, syncWalletBalance);
router.post('/send-money', protectMerchant, sendMoney);
router.get('/live-rate', protectMerchant, getLiveRate);
router.get('/', protectMerchant, getTransactions);

export default router;
