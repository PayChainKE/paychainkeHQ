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
  updateMerchantFeatures,
  getInsights,
  getLedger,
  getSystemStatus,
} from '../controllers/adminController.js';
import {
  getCommunications,
  updateCommunication,
  addCommunicationNote,
  deleteCommunication,
} from '../controllers/communicationController.js';
import {
  getAuditLog,
  getMerchantAuditLog,
} from '../controllers/auditLogController.js';
import {
  listTeam,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  resendInvite,
} from '../controllers/teamController.js';
import { runWalletAudit } from '../controllers/walletAuditController.js';
import { adminListInvoices } from '../controllers/invoiceController.js';
import { getRevenue, getRevenueSweeps, triggerRevenueSweep } from '../controllers/revenueController.js';
import { adminListCashAdvanceRequests, adminUpdateCashAdvanceRequest } from '../controllers/cashAdvanceController.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBookkeepingSummary,
} from '../controllers/bookkeepingController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// analyst is a read-only reporting tier (models/Admin.js) — every mutating
// route below requires owner/admin; GET routes stay open to all roles.
const requireMutator = requireRole('owner', 'admin');

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
router.post('/merchants', protect, requireMutator, merchantCreateLimiter, createMerchant);
router.get('/merchants/analytics', protect, getMerchantAnalytics);
// IMPORTANT: keep `/merchants/:id` AFTER `/merchants/analytics` so Express
// matches the literal path first instead of treating "analytics" as :id.
router.get('/merchants/:id', protect, getMerchantDetail);
router.post('/merchants/:id/request-action', protect, requireMutator, sensitiveActionLimiter, requestMerchantAction);
router.post('/merchants/:id/confirm-action', protect, requireMutator, sensitiveActionLimiter, confirmMerchantAction);
router.post('/merchants/:id/flag', protect, requireMutator, sensitiveActionLimiter, flagMerchant);
router.post('/merchants/:id/unflag', protect, requireMutator, sensitiveActionLimiter, unflagMerchant);
router.patch('/merchants/:id/features', protect, requireMutator, sensitiveActionLimiter, updateMerchantFeatures);
router.get('/merchants/:id/audit-log', protect, getMerchantAuditLog);

// Executive insights — aggregated KPIs / GTV / funnel / leaderboards.
router.get('/insights', protect, getInsights);

// Wallet ledger — paginated transaction trail + KPIs + asset mix + series.
router.get('/ledger', protect, getLedger);

// Revenue dashboard — per-stream fee aggregation, stacked time series,
// top fee-generating merchants, projected ARR.
router.get('/revenue', protect, getRevenue);

// Real weekly sweep history (actual PesaLink transfers of accrued fee
// revenue to PayChain's own account) + a manual "run now" trigger.
router.get('/revenue/sweeps', protect, getRevenueSweeps);
router.post('/revenue/sweeps/run', protect, requireMutator, sensitiveActionLimiter, triggerRevenueSweep);

// Stellar Wallet Audit (live Horizon cross-reference)
router.get('/wallet-audit', protect, runWalletAudit);

// Platform-wide invoice oversight — every merchant's invoices, paginated/searchable.
router.get('/invoices', protect, adminListInvoices);

// Cash advance review queue — list every merchant's application, move a
// request between pending/reviewing/approved/declined.
router.get('/cash-advance/requests', protect, adminListCashAdvanceRequests);
router.patch('/cash-advance/requests/:id', protect, requireMutator, sensitiveActionLimiter, adminUpdateCashAdvanceRequest);

// Bookkeeping — expense ledger + P&L summary for KRA-ready record keeping.
router.get('/bookkeeping/summary',        protect, getBookkeepingSummary);
router.get('/bookkeeping/expenses',       protect, listExpenses);
router.post('/bookkeeping/expenses',      protect, requireMutator, createExpense);
router.put('/bookkeeping/expenses/:id',   protect, requireMutator, updateExpense);
router.delete('/bookkeeping/expenses/:id',protect, requireMutator, deleteExpense);

// Compact health pulse for the sidebar widget.
router.get('/system-status', protect, getSystemStatus);

// Global audit log (filterable, paginated).
router.get('/audit-log', protect, getAuditLog);

// Call-centre / inbound communications console.
router.get('/communications',                protect, getCommunications);
router.patch('/communications/:id',          protect, requireMutator, updateCommunication);
router.post('/communications/:id/notes',     protect, requireMutator, addCommunicationNote);
router.delete('/communications/:id',         protect, requireMutator, deleteCommunication);

// Team management (owner-only mutations enforced inside the controller).
router.get('/team',                          protect, listTeam);
router.post('/team',                         protect, sensitiveActionLimiter, inviteTeamMember);
router.patch('/team/:id',                    protect, updateTeamMember);
router.delete('/team/:id',                   protect, removeTeamMember);
router.post('/team/:id/resend-invite',       protect, sensitiveActionLimiter, resendInvite);

export default router;
