import express from 'express';
import authRoutes from './authRoutes.js';
import { getMerchants, getMerchantAnalytics } from '../controllers/adminController.js';
import { runWalletAudit } from '../controllers/walletAuditController.js';

const router = express.Router();

// Admin Auth Routes
router.use('/auth', authRoutes);

// Merchant Management Routes
router.get('/merchants', getMerchants);
router.get('/merchants/analytics', getMerchantAnalytics);

// Stellar Wallet Audit (live Horizon cross-reference)
router.get('/wallet-audit', runWalletAudit);

export default router;
