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
  getMerchantsMap,
  geocodeSearch,
  setMerchantLocation,
  removeMerchantLocation,
  downloadMerchantSticker,
  downloadBulkStickers,
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
  getSecurityAlerts,
  acknowledgeSecurityAlert,
  getUnacknowledgedCount,
} from '../controllers/securityAlertController.js';
import { getSentryOverview } from '../controllers/sentryMonitoringController.js';
import {
  listDevelopers,
  approveLiveAccess,
  rejectLiveAccess,
} from '../controllers/developerAdminController.js';
import {
  listTeam,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  resendInvite,
} from '../controllers/teamController.js';
import {
  listOfficers,
  createOfficer,
  updateOfficer,
  resetOfficerPassword,
  deleteOfficer,
} from '../controllers/officerAccountController.js';
import { runWalletAudit } from '../controllers/walletAuditController.js';
import { adminListInvoices } from '../controllers/invoiceController.js';
import { sendSmsBroadcast, getSmsBroadcasts, deleteSmsBroadcast, clearSmsBroadcasts } from '../controllers/smsBroadcastController.js';
import { getRevenue, getRevenueSweeps, triggerRevenueSweep, getReconciliations, submitReconciliation } from '../controllers/revenueController.js';
import { adminListCashAdvanceRequests, adminUpdateCashAdvanceRequest } from '../controllers/cashAdvanceController.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBookkeepingSummary,
} from '../controllers/bookkeepingController.js';
import { protect, protectAdminSSE, requireRole } from '../middleware/authMiddleware.js';
import { registerAdminEventClient } from '../utils/adminEventStream.js';

const router = express.Router();

// analyst is a read-only reporting tier (models/Admin.js) — every mutating
// route below requires owner/admin; GET routes stay open to all roles.
const requireMutator = requireRole('owner', 'admin');

// officer is scoped to only the merchants they personally onboarded
// (enforced inside officerController.js via scopedToOfficer) — the
// platform-wide GET routes below are a completely separate surface that
// `protect` alone doesn't restrict by role, so without this an officer's
// own valid token could read every merchant's KYB detail, revenue, ledger,
// and wallet-audit data, defeating that isolation entirely.
const excludeOfficer = requireRole('owner', 'admin', 'analyst');

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

// Debounced client-side typing naturally stays well under this — mainly a
// backstop against something looping, out of courtesy to Nominatim's free
// public instance (which this proxies to, see geocodeSearch).
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many place searches. Wait a moment and try again.' },
});

// Merchant Management Routes (admin-only)
router.get('/merchants', protect, excludeOfficer, getMerchants);
router.post('/merchants', protect, requireMutator, merchantCreateLimiter, createMerchant);
router.get('/merchants/analytics', protect, excludeOfficer, getMerchantAnalytics);
// Same reason as /merchants/analytics above — literal paths before :id.
router.get('/merchants/map', protect, excludeOfficer, getMerchantsMap);
router.get('/geocode', protect, excludeOfficer, geocodeLimiter, geocodeSearch);
// Same reason again — literal path before /merchants/:id below.
router.get('/merchants/stickers/bulk', protect, excludeOfficer, downloadBulkStickers);
// IMPORTANT: keep `/merchants/:id` AFTER `/merchants/analytics` so Express
// matches the literal path first instead of treating "analytics" as :id.
router.get('/merchants/:id', protect, excludeOfficer, getMerchantDetail);
router.post('/merchants/:id/request-action', protect, requireMutator, sensitiveActionLimiter, requestMerchantAction);
router.post('/merchants/:id/confirm-action', protect, requireMutator, sensitiveActionLimiter, confirmMerchantAction);
router.post('/merchants/:id/flag', protect, requireMutator, sensitiveActionLimiter, flagMerchant);
router.post('/merchants/:id/unflag', protect, requireMutator, sensitiveActionLimiter, unflagMerchant);
router.patch('/merchants/:id/features', protect, requireMutator, sensitiveActionLimiter, updateMerchantFeatures);
router.patch('/merchants/:id/location', protect, requireMutator, sensitiveActionLimiter, setMerchantLocation);
router.delete('/merchants/:id/location', protect, requireMutator, sensitiveActionLimiter, removeMerchantLocation);
router.get('/merchants/:id/sticker', protect, excludeOfficer, downloadMerchantSticker);
router.get('/merchants/:id/audit-log', protect, excludeOfficer, getMerchantAuditLog);

// Executive insights — aggregated KPIs / GTV / funnel / leaderboards.
router.get('/insights', protect, excludeOfficer, getInsights);

// Wallet ledger — paginated transaction trail + KPIs + asset mix + series.
router.get('/ledger', protect, excludeOfficer, getLedger);

// Revenue dashboard — per-stream fee aggregation, stacked time series,
// top fee-generating merchants, projected ARR.
router.get('/revenue', protect, excludeOfficer, getRevenue);

// Real weekly sweep history (actual PesaLink transfers of accrued fee
// revenue to PayChain's own account) + a manual "run now" trigger.
router.get('/revenue/sweeps', protect, excludeOfficer, getRevenueSweeps);
router.post('/revenue/sweeps/run', protect, requireMutator, sensitiveActionLimiter, triggerRevenueSweep);

// Manual bank reconciliation — no NCBA API exists to pull the real pooled
// account balance automatically, so an admin pastes it in periodically and
// this flags any gap against what the ledger expects.
router.get('/revenue/reconciliations', protect, excludeOfficer, getReconciliations);
router.post('/revenue/reconciliations', protect, requireMutator, sensitiveActionLimiter, submitReconciliation);

// Stellar Wallet Audit (live Horizon cross-reference)
router.get('/wallet-audit', protect, excludeOfficer, runWalletAudit);

// Platform-wide invoice oversight — every merchant's invoices, paginated/searchable.
router.get('/invoices', protect, excludeOfficer, adminListInvoices);

// Cash advance review queue — list every merchant's application, move a
// request between pending/reviewing/approved/declined.
router.get('/cash-advance/requests', protect, excludeOfficer, adminListCashAdvanceRequests);
router.patch('/cash-advance/requests/:id', protect, requireMutator, sensitiveActionLimiter, adminUpdateCashAdvanceRequest);

// Bookkeeping — expense ledger + P&L summary for KRA-ready record keeping.
router.get('/bookkeeping/summary',        protect, excludeOfficer, getBookkeepingSummary);
router.get('/bookkeeping/expenses',       protect, excludeOfficer, listExpenses);
router.post('/bookkeeping/expenses',      protect, requireMutator, createExpense);
router.put('/bookkeeping/expenses/:id',   protect, requireMutator, updateExpense);
router.delete('/bookkeeping/expenses/:id',protect, requireMutator, deleteExpense);

// Compact health pulse for the sidebar widget.
router.get('/system-status', protect, excludeOfficer, getSystemStatus);

// Global audit log (filterable, paginated).
router.get('/audit-log', protect, excludeOfficer, getAuditLog);

// Security alerts (OTP/PIN lockouts, large transfers, new privileged
// accounts) — persisted record of what utils/securityAlerts.js emails out.
router.get('/security-alerts', protect, excludeOfficer, getSecurityAlerts);
router.get('/security-alerts/unacknowledged-count', protect, excludeOfficer, getUnacknowledgedCount);
router.patch('/security-alerts/:id/acknowledge', protect, requireMutator, acknowledgeSecurityAlert);

// Sentry error-monitoring proxy — see sentryMonitoringController.js for why
// this isn't called directly from the browser.
router.get('/monitoring/sentry', protect, excludeOfficer, getSentryOverview);

// Developer API account review — self-serve signup gets sandbox/test keys
// instantly; live (real-money) keys need an admin to approve the account
// first, same shape as merchant KYB. See developerAdminController.js.
router.get('/developers', protect, excludeOfficer, listDevelopers);
router.patch('/developers/:id/approve-live', protect, requireMutator, approveLiveAccess);
router.patch('/developers/:id/reject-live', protect, requireMutator, rejectLiveAccess);

// Admin → merchant SMS broadcasts (system maintenance notices, public
// holiday greetings, security reminders, etc). Sending is rate-limited with
// the same limiter used for other sensitive bulk/admin actions.
router.get('/sms-broadcasts',        protect, excludeOfficer, getSmsBroadcasts);
router.post('/sms-broadcasts',       protect, requireMutator, sensitiveActionLimiter, sendSmsBroadcast);
router.delete('/sms-broadcasts/:id', protect, requireMutator, sensitiveActionLimiter, deleteSmsBroadcast);
router.post('/sms-broadcasts/clear', protect, requireMutator, sensitiveActionLimiter, clearSmsBroadcasts);

// Live dashboard updates (Server-Sent Events) — the admin frontend opens
// one long-lived connection per session (see AuthContext.jsx) and gets a
// `transaction` event pushed the instant any transaction completes
// anywhere in PayChain (see models/Transaction.js's post-save/post-update
// hooks), which it turns back into the existing paychain:sync refresh bus.
// EventSource can't set an Authorization header, so this route alone
// accepts the token as a query param (protectAdminSSE) rather than only
// the header everything else uses.
router.get('/events/stream', protectAdminSSE, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx/proxy response buffering, if any sits in front
  });
  res.write('\n');
  const unregister = registerAdminEventClient(res);
  // res.on('close'), not req.on('close') — the request stream (no body on
  // a GET) reports 'close' as soon as it's done being read, essentially
  // immediately, long before the client actually disconnects. res's
  // 'close' event is the one that actually reflects the response
  // connection closing.
  res.on('close', unregister);
});

// Call-centre / inbound communications console.
router.get('/communications',                protect, excludeOfficer, getCommunications);
router.patch('/communications/:id',          protect, requireMutator, updateCommunication);
router.post('/communications/:id/notes',     protect, requireMutator, addCommunicationNote);
router.delete('/communications/:id',         protect, requireMutator, deleteCommunication);

// Team management (owner-only mutations enforced inside the controller).
// Mutating routes are owner-only in teamController.js itself (requireOwner
// as the first line of each handler) — requireRole('owner') here is
// route-level defense-in-depth so a future edit that drops/forgets that
// controller-level check doesn't silently open these up. listTeam has no
// such check by design (any admin can view the roster, only owners can
// change it), so it stays at the plain requireMutator-equivalent `protect`.
router.get('/team',                          protect, listTeam);
router.post('/team',                         protect, requireRole('owner'), sensitiveActionLimiter, inviteTeamMember);
router.patch('/team/:id',                    protect, requireRole('owner'), updateTeamMember);
router.delete('/team/:id',                   protect, requireRole('owner'), removeTeamMember);
router.post('/team/:id/resend-invite',       protect, requireRole('owner'), sensitiveActionLimiter, resendInvite);

// Onboarding officer account management (owner/admin only — officers can
// never manage their own or each other's accounts).
router.get('/officers',                      protect, requireMutator, listOfficers);
router.post('/officers',                     protect, requireMutator, sensitiveActionLimiter, createOfficer);
router.patch('/officers/:id',                protect, requireMutator, updateOfficer);
router.post('/officers/:id/reset-password',  protect, requireMutator, sensitiveActionLimiter, resetOfficerPassword);
router.delete('/officers/:id',               protect, requireMutator, deleteOfficer);

export default router;
