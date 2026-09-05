import express from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './authRoutes.js';
import {
  getMerchants,
  getMerchantBalances,
  exportMerchantBalances,
  getMerchantDetail,
  getMerchantAnalytics,
  createMerchant,
  requestMerchantAction,
  confirmMerchantAction,
  flagMerchant,
  unflagMerchant,
  updateMerchantFeatures,
  getPlatformSettings,
  updatePlatformSettings,
  sendInstallReminder,
  updateMerchantVerification,
  updateMerchantKycDocument,
  updateMerchantBusinessName,
  updateMerchantContactName,
  updateMerchantCertificate,
  downloadMerchantQrCode,
  getMerchantsMap,
  geocodeSearch,
  setMerchantLocation,
  removeMerchantLocation,
  downloadMerchantSticker,
  downloadBulkStickers,
  getInsights,
  getLedger,
  getSystemStatus,
  getStkRequests,
  searchTransactionAudit,
  exportPayoutAuditCsv,
  getTransactionAuditDetail,
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
  getDeveloperAuditLog,
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
  getDeveloperWebhooks,
  runIntegrationTest,
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
import { getRevenue, getRevenueSweeps, archiveRevenueSweep, unarchiveRevenueSweep, exportRevenueSweeps, triggerRevenueSweep, getReconciliations, submitReconciliation, archiveReconciliation, unarchiveReconciliation, bulkArchiveReconciliations, getExpectedPoolBalance, getLivePoolBalance, getPoolAccountStatement, getBankCharges, recordBankCharge, updateBankCharge, archiveBankCharge, writeOffRevenueDeficit, getRevenueTransactions } from '../controllers/revenueController.js';
import { getApiTransactions, getApiTransactionsSummary } from '../controllers/apiTransactionsController.js';
import { getTariffs, requestTariffUpdate, confirmTariffUpdate } from '../controllers/tariffController.js';
import { adminListStuckOpenBankingPayouts, adminResolveStuckOpenBankingPayout, adminDeleteStuckOpenBankingPayout } from '../controllers/ncbaOpenBankingController.js';
import { adminManualCreditNcbaCollection, adminListMissedNcbaCollections, adminDismissMissedNcbaCollection } from '../controllers/ncbaAccountNotificationController.js';
import { getTrash, restoreTrashItem } from '../controllers/trashController.js';
import { adminListCashAdvanceRequests, adminUpdateCashAdvanceRequest } from '../controllers/cashAdvanceController.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  updateExpenseReceipt,
  getBookkeepingSummary,
  exportKraRevenueCsv,
} from '../controllers/bookkeepingController.js';
import {
  listTaxDeadlines,
  createTaxDeadline,
  updateTaxDeadline,
  deleteTaxDeadline,
} from '../controllers/taxDeadlineController.js';
import { protect, protectAdminSSE, requireRole } from '../middleware/authMiddleware.js';
import { upload, uploadReceipt } from '../utils/cloudinary.js';
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
// Must be registered before /merchants/:id below, or Express would match
// "balances" as an :id.
router.get('/merchants/balances', protect, excludeOfficer, getMerchantBalances);
router.get('/merchants/balances/export', protect, excludeOfficer, exportMerchantBalances);
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
router.post('/merchants/:id/send-install-reminder', protect, requireMutator, sensitiveActionLimiter, sendInstallReminder);
router.get('/platform-settings', protect, excludeOfficer, getPlatformSettings);
router.patch('/platform-settings', protect, requireMutator, sensitiveActionLimiter, updatePlatformSettings);
router.patch('/merchants/:id/verification', protect, requireMutator, sensitiveActionLimiter, updateMerchantVerification);
router.patch('/merchants/:id/kyc-documents', protect, requireMutator, sensitiveActionLimiter, upload.single('document'), updateMerchantKycDocument);
router.patch('/merchants/:id/business-name', protect, requireMutator, sensitiveActionLimiter, updateMerchantBusinessName);
router.patch('/merchants/:id/contact-name', protect, requireMutator, sensitiveActionLimiter, updateMerchantContactName);
router.patch('/merchants/:id/certificate', protect, requireMutator, sensitiveActionLimiter, upload.single('certificate'), updateMerchantCertificate);
router.patch('/merchants/:id/location', protect, requireMutator, sensitiveActionLimiter, setMerchantLocation);
router.delete('/merchants/:id/location', protect, requireMutator, sensitiveActionLimiter, removeMerchantLocation);
router.get('/merchants/:id/sticker', protect, excludeOfficer, downloadMerchantSticker);
router.get('/merchants/:id/qr-code', protect, excludeOfficer, downloadMerchantQrCode);
router.get('/merchants/:id/audit-log', protect, excludeOfficer, getMerchantAuditLog);

// Executive insights — aggregated KPIs / GTV / funnel / leaderboards.
router.get('/insights', protect, excludeOfficer, getInsights);

// Wallet ledger — paginated transaction trail + KPIs + asset mix + series.
router.get('/ledger', protect, excludeOfficer, getLedger);

// Revenue dashboard — per-stream fee aggregation, stacked time series,
// top fee-generating merchants, projected ARR.
router.get('/revenue', protect, excludeOfficer, getRevenue);
router.get('/revenue/transactions', protect, excludeOfficer, getRevenueTransactions);
router.get('/api-transactions', protect, excludeOfficer, getApiTransactions);
router.get('/api-transactions/summary', protect, excludeOfficer, getApiTransactionsSummary);

// Real weekly sweep history (actual PesaLink transfers of accrued fee
// revenue to PayChain's own account) + a manual "run now" trigger.
router.get('/revenue/sweeps', protect, excludeOfficer, getRevenueSweeps);
router.get('/revenue/sweeps/export', protect, excludeOfficer, exportRevenueSweeps);
router.post('/revenue/sweeps/run', protect, requireMutator, sensitiveActionLimiter, triggerRevenueSweep);
router.patch('/revenue/sweeps/:id/archive', protect, requireMutator, sensitiveActionLimiter, archiveRevenueSweep);
router.patch('/revenue/sweeps/:id/unarchive', protect, requireMutator, sensitiveActionLimiter, unarchiveRevenueSweep);

// Pool reconciliation — what the pooled NCBA account should contain per
// PayChain's own ledger (read-only, always available) vs. a live pull from
// NCBA's own AccountDetails endpoint (best-effort — unconfirmed response
// shape, may report unavailable) vs. the manual paste-in-and-compare flow
// that predates the live pull and remains the proven fallback.
router.get('/tariffs', protect, excludeOfficer, getTariffs);
router.post('/tariffs/request-update', protect, requireMutator, sensitiveActionLimiter, requestTariffUpdate);
router.post('/tariffs/confirm-update', protect, requireMutator, sensitiveActionLimiter, confirmTariffUpdate);
router.get('/revenue/pool-balance/expected', protect, excludeOfficer, getExpectedPoolBalance);
router.get('/revenue/pool-balance/live', protect, excludeOfficer, getLivePoolBalance);
router.get('/revenue/pool-account/statement', protect, excludeOfficer, getPoolAccountStatement);
router.get('/revenue/pool-account/charges', protect, excludeOfficer, getBankCharges);
router.post('/revenue/pool-account/charges', protect, requireMutator, sensitiveActionLimiter, recordBankCharge);
router.patch('/revenue/pool-account/charges/:id', protect, requireMutator, sensitiveActionLimiter, updateBankCharge);
router.patch('/revenue/pool-account/charges/:id/archive', protect, requireMutator, sensitiveActionLimiter, archiveBankCharge);
router.post('/revenue/pool-account/write-off-deficit', protect, requireMutator, sensitiveActionLimiter, writeOffRevenueDeficit);
router.get('/revenue/reconciliations', protect, excludeOfficer, getReconciliations);
router.post('/revenue/reconciliations', protect, requireMutator, sensitiveActionLimiter, submitReconciliation);
router.post('/revenue/reconciliations/bulk-archive', protect, requireMutator, sensitiveActionLimiter, bulkArchiveReconciliations);
router.patch('/revenue/reconciliations/:id/archive', protect, requireMutator, sensitiveActionLimiter, archiveReconciliation);
router.patch('/revenue/reconciliations/:id/unarchive', protect, requireMutator, sensitiveActionLimiter, unarchiveReconciliation);

// NCBA async-rail payouts stuck 'pending' past the reconciliation sweep's
// timeout (see services/ncbaOpenBankingReconciliationService.js) — flagged
// for manual review rather than auto-refunded, since NCBA's status-check
// endpoint is confirmed broken. An admin checks NCBA's portal directly,
// then resolves it here.
router.get('/ncba-payouts/stuck-review', protect, excludeOfficer, adminListStuckOpenBankingPayouts);
router.post('/ncba-payouts/:reference/resolve', protect, requireMutator, sensitiveActionLimiter, adminResolveStuckOpenBankingPayout);
// Permanently wipes a stuck row without a succeeded/failed decision — for
// rows that were never real customer money (e.g. live-test payouts), not a
// substitute for "Failed" when a real refund is owed. See
// adminDeleteStuckOpenBankingPayout's doc comment.
router.delete('/ncba-payouts/:reference', protect, requireMutator, sensitiveActionLimiter, adminDeleteStuckOpenBankingPayout);

// Manually credit a real NCBA collection that landed on NCBA's own
// statement but this webhook never fired for — see
// adminManualCreditNcbaCollection's doc comment.
router.post('/ncba-collections/manual-credit', protect, requireMutator, sensitiveActionLimiter, adminManualCreditNcbaCollection);
// Proactive detection — services/ncbaCollectionReconciliationService.js's
// hourly sweep flags real statement credits with no matching Transaction.
router.get('/ncba-collections/missed', protect, excludeOfficer, adminListMissedNcbaCollections);
router.post('/ncba-collections/missed/:id/dismiss', protect, requireMutator, sensitiveActionLimiter, adminDismissMissedNcbaCollection);

// Trash — snapshots of the handful of significant admin-initiated
// deletions (Merchant, Transaction/stuck-payout, Admin/officer-or-team,
// Expense), restorable within a 90-day window. See models/DeletedRecord.js.
router.get('/trash', protect, requireMutator, getTrash);
router.post('/trash/:id/restore', protect, requireMutator, sensitiveActionLimiter, restoreTrashItem);

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
router.get('/bookkeeping/kra-export',     protect, excludeOfficer, exportKraRevenueCsv);

router.get('/tax-deadlines',        protect, excludeOfficer, listTaxDeadlines);
router.post('/tax-deadlines',       protect, requireMutator, createTaxDeadline);
router.put('/tax-deadlines/:id',    protect, requireMutator, updateTaxDeadline);
router.delete('/tax-deadlines/:id', protect, requireMutator, deleteTaxDeadline);
router.get('/bookkeeping/expenses',       protect, excludeOfficer, listExpenses);
router.post('/bookkeeping/expenses',      protect, requireMutator, uploadReceipt.single('receipt'), createExpense);
router.put('/bookkeeping/expenses/:id',   protect, requireMutator, updateExpense);
router.patch('/bookkeeping/expenses/:id/receipt', protect, requireMutator, uploadReceipt.single('receipt'), updateExpenseReceipt);
router.delete('/bookkeeping/expenses/:id',protect, requireMutator, deleteExpense);

// Compact health pulse for the sidebar widget.
router.get('/system-status', protect, excludeOfficer, getSystemStatus);
router.get('/stk-requests', protect, excludeOfficer, getStkRequests);

// Transaction Audit — search any transaction across every merchant and drill
// into a full forensic detail view (related STK Push attempt + SMS receipts),
// for resolving merchant/customer disputes.
router.get('/transaction-audit', protect, excludeOfficer, searchTransactionAudit);
router.get('/transaction-audit/export', protect, excludeOfficer, exportPayoutAuditCsv);
router.get('/transaction-audit/:id', protect, excludeOfficer, getTransactionAuditDetail);

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
router.get('/developers/:id/webhooks', protect, excludeOfficer, getDeveloperWebhooks);
router.get('/developers/:id/audit-log', protect, excludeOfficer, getDeveloperAuditLog);
router.patch('/developers/:id/approve-live', protect, requireMutator, approveLiveAccess);
router.patch('/developers/:id/reject-live', protect, requireMutator, rejectLiveAccess);

// Runs a live check of a developer's integration (simulated test-mode
// collect + a real ping of every registered webhook) — lets an admin verify
// everything actually works before approving a live-access request.
router.post('/developers/:id/run-integration-test', protect, requireMutator, sensitiveActionLimiter, runIntegrationTest);

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
