import express from 'express';
import rateLimit from 'express-rate-limit';
import { getTransactions, simulateIncomingPayment, swapKesToUsdc, activateWallet, getLiveRate, sendMoney, syncWalletBalance, generatePaymentLink, listPaymentLinks, getPaymentLink, processPaymentLink, getMerchantByAccount, payToMerchantAccount, emailStatement } from '../controllers/transactionController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { generateToken } from '../controllers/mpesaController.js';

const router = express.Router();

// sendMoney checks a 4-digit PIN inline — same brute-force exposure as
// every other PIN-guarded endpoint in the app.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

router.post('/simulate', protectMerchant, simulateIncomingPayment);
router.post('/swap', protectMerchant, swapKesToUsdc);
router.post('/activate-wallet', protectMerchant, activateWallet);
router.post('/sync-wallet', protectMerchant, syncWalletBalance);
router.post('/send-money', protectMerchant, pinLimiter, sendMoney);
router.post('/payment-link', protectMerchant, generatePaymentLink);
router.get('/payment-link', protectMerchant, listPaymentLinks);

// Public payment routes — unauthenticated by design (a customer paying a
// link/QR has no PayChain account), so both get the same throttle: without
// it, a public caller could trigger unlimited STK pushes (and SMS sends)
// to any phone number they type in.
const payAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts. Try again in 15 minutes.' },
});

// Public Payment Link Routes
router.get('/payment-link/:linkId', getPaymentLink);
router.post('/payment-link/:linkId/pay', payAccountLimiter, generateToken, processPaymentLink);

// Public direct-account payment — powers the static "Settlement QR" on a
// merchant's Wallet page (open amount, no pre-generated link), as opposed
// to the fixed-amount PaymentLink routes above.
router.get('/pay-account/:account', getMerchantByAccount);
router.post('/pay-account/:account', payAccountLimiter, generateToken, payToMerchantAccount);

router.post('/statement/email', protectMerchant, emailStatement);

router.get('/live-rate', protectMerchant, getLiveRate);
router.get('/', protectMerchant, getTransactions);

export default router;
