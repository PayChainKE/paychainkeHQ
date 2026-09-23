import STKRequest from '../models/STKRequest.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import MissedNcbaCollectionCandidate from '../models/MissedNcbaCollectionCandidate.js';
import Transaction from '../models/Transaction.js';
import AdminApproval from '../models/AdminApproval.js';
import CashAdvanceApplication from '../models/CashAdvanceApplication.js';
import Merchant from '../models/Merchant.js';
import { getNcbaAccountBalance } from '../services/ncbaOpenBankingService.js';

// One "is everything working right now" view, instead of an admin having to
// separately check StkMonitor, Pool Reconciliation, Developers, etc. to
// notice something's actually broken vs. just quiet. Every number here is a
// plain read (counts + one live NCBA ping) — nothing here mutates anything,
// so it's always safe to poll.
const STUCK_STK_MINUTES = 5;
const WINDOW_HOURS = 24;

function rate(part, whole) {
  return whole > 0 ? part / whole : 0;
}

// @desc    Aggregate operational health — rail reachability, STK/webhook
//          failure rates, and the backlogs that need an admin's attention.
// @route   GET /api/admin/ops-health
// @access  Private (Admin — owner/admin/analyst; read-only)
export const getOpsHealth = async (req, res) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
    const stuckCutoff = new Date(now.getTime() - STUCK_STK_MINUTES * 60 * 1000);

    const [
      stkStuck,
      stkSuccess,
      stkFailed,
      webhookFailed,
      webhookTotal,
      missedCollectionsPending,
      stuckPayouts,
      pendingApprovals,
      cashAdvancePending,
      kycPending,
      ncba,
    ] = await Promise.all([
      STKRequest.countDocuments({ status: 'pending', createdAt: { $lt: stuckCutoff } }),
      STKRequest.countDocuments({ status: 'success', createdAt: { $gte: since } }),
      STKRequest.countDocuments({ status: 'failed', createdAt: { $gte: since } }),
      WebhookDelivery.countDocuments({ status: { $in: ['failed', 'exhausted'] }, createdAt: { $gte: since } }),
      WebhookDelivery.countDocuments({ createdAt: { $gte: since } }),
      MissedNcbaCollectionCandidate.countDocuments({ status: 'pending' }),
      Transaction.countDocuments({ status: 'pending', pendingReason: 'stuck_timeout_needs_manual_review' }),
      AdminApproval.countDocuments({ status: 'pending' }),
      CashAdvanceApplication.countDocuments({ status: { $in: ['pending', 'reviewing'] } }),
      Merchant.countDocuments({ kybStatus: 'pending' }),
      (async () => {
        const startedAt = Date.now();
        try {
          const { balance } = await getNcbaAccountBalance();
          return { reachable: balance !== null, latencyMs: Date.now() - startedAt };
        } catch (e) {
          return { reachable: false, latencyMs: Date.now() - startedAt, error: e.message };
        }
      })(),
    ]);

    const stkFailureRate = rate(stkFailed, stkSuccess + stkFailed);
    const webhookFailureRate = rate(webhookFailed, webhookTotal);

    // Traffic-light severity per rail/backlog — worst of these drives the
    // page's overall banner. Thresholds are deliberately coarse: this is a
    // "does something need a look" signal, not a precision alerting system.
    const sev = (ok, warn) => (ok ? 'ok' : warn ? 'warn' : 'critical');
    const checks = {
      ncba: { status: ncba.reachable ? 'ok' : 'critical', ...ncba },
      stkStuck: { status: sev(stkStuck === 0, stkStuck <= 5), count: stkStuck, thresholdMinutes: STUCK_STK_MINUTES },
      stkFailureRate: { status: sev(stkFailureRate < 0.2, stkFailureRate < 0.5), rate: stkFailureRate, success: stkSuccess, failed: stkFailed, windowHours: WINDOW_HOURS },
      webhookFailureRate: { status: sev(webhookFailureRate < 0.2, webhookFailureRate < 0.5), rate: webhookFailureRate, failed: webhookFailed, total: webhookTotal, windowHours: WINDOW_HOURS },
      missedCollections: { status: sev(missedCollectionsPending === 0, missedCollectionsPending <= 3), count: missedCollectionsPending },
      stuckPayouts: { status: sev(stuckPayouts === 0, stuckPayouts <= 3), count: stuckPayouts },
    };
    const overall = Object.values(checks).some((c) => c.status === 'critical') ? 'critical'
      : Object.values(checks).some((c) => c.status === 'warn') ? 'warn' : 'ok';

    res.json({
      success: true,
      overall,
      checks,
      // Informational backlogs — not failures, just work waiting on an
      // admin. No severity: a high KYC queue on a growth day is expected.
      queues: {
        pendingApprovals,
        cashAdvancePending,
        kycPending,
      },
      checkedAt: now,
    });
  } catch (error) {
    console.error('Get Ops Health Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
