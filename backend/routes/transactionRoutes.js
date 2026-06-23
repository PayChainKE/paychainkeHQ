import express from 'express';
import { getTransactions, simulateIncomingPayment, swapKesToUsdc, activateWallet, getLiveRate, sendMoney, syncWalletBalance, generatePaymentLink, getPaymentLink, processPaymentLink } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { generateToken } from '../controllers/mpesaController.js';

const router = express.Router();

router.post('/simulate', simulateIncomingPayment);
router.post('/swap', protectMerchant, swapKesToUsdc);
router.post('/activate-wallet', protectMerchant, activateWallet);
router.post('/sync-wallet', protectMerchant, syncWalletBalance);
router.post('/send-money', protectMerchant, sendMoney);
router.post('/payment-link', protectMerchant, generatePaymentLink);

// Public Payment Link Routes
router.get('/payment-link/:linkId', getPaymentLink);
router.post('/payment-link/:linkId/pay', generateToken, processPaymentLink);

router.get('/live-rate', protectMerchant, getLiveRate);
router.get('/', protectMerchant, getTransactions);

export default router;
