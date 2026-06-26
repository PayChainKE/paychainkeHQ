import express from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './authRoutes.js';
import {
  getMerchants,
  getMerchantDetail,
  getMerchantAnalytics,
  createMerchant,
  requestMerchantAction,
  confirmMerchantAction,
  flagMerchant,
  unflagMerchant,
  getInsights,
  getLedger,
} from '../controllers/adminController.js';
import { runWalletAudit } from '../controllers/walletAuditController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin Auth Routes
router.use('/auth', authRoutes);

// Throttle merchant-onboarding to defend against accidental loops or abuse.
const merchantCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many merchants created. Slow down and try again later.' },
});

// Throttle OTP minting + confirmation per IP to harden against abuse.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Try again in 15 minutes.' },
});

// Merchant Management Routes (admin-only)
router.get('/merchants', protect, getMerchants);
router.post('/merchants', protect, merchantCreateLimiter, createMerchant);
router.get('/merchants/analytics', protect, getMerchantAnalytics);
// IMPORTANT: keep `/merchants/:id` AFTER `/merchants/analytics` so Express
// matches the literal path first instead of treating "analytics" as :id.
router.get('/merchants/:id', protect, getMerchantDetail);
router.post('/merchants/:id/request-action', protect, sensitiveActionLimiter, requestMerchantAction);
router.post('/merchants/:id/confirm-action', protect, sensitiveActionLimiter, confirmMerchantAction);
router.post('/merchants/:id/flag', protect, sensitiveActionLimiter, flagMerchant);
router.post('/merchants/:id/unflag', protect, sensitiveActionLimiter, unflagMerchant);

// Executive insights — aggregated KPIs / GTV / funnel / leaderboards.
router.get('/insights', protect, getInsights);

// Wallet ledger — paginated transaction trail + KPIs + asset mix + series.
router.get('/ledger', protect, getLedger);

// Stellar Wallet Audit (live Horizon cross-reference)
router.get('/wallet-audit', protect, runWalletAudit);

export default router;
