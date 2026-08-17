import Developer from '../models/Developer.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import ApiKey from '../models/ApiKey.js';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { initiateCollectPayment, CollectValidationError } from '../services/developerCollectService.js';
import { sendTestWebhook } from '../services/webhookDeliveryService.js';

// @desc    List developer accounts (filterable by live-access review state)
// @route   GET /api/admin/developers
// @access  Private (Admin — owner/admin/analyst)
export const listDevelopers = async (req, res) => {
  try {
    const { liveAccessStatus, page = 1, pageSize = 25 } = req.query;
    const filter = {};
    if (liveAccessStatus === 'requested') {
      filter['liveAccess.approved'] = false;
      filter['liveAccess.requestedAt'] = { $ne: null };
    } else if (liveAccessStatus === 'approved') {
      filter['liveAccess.approved'] = true;
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const [developers, total] = await Promise.all([
      Developer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
      Developer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: developers,
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.max(1, Math.ceil(total / Number(pageSize))),
    });
  } catch (error) {
    console.error('List Developers Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve a developer for live (real-money) API keys
// @route   PATCH /api/admin/developers/:id/approve-live
// @access  Private (Admin — owner/admin)
export const approveLiveAccess = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    developer.liveAccess = developer.liveAccess || {};
    developer.liveAccess.approved = true;
    developer.liveAccess.approvedAt = new Date();
    developer.liveAccess.approvedBy = req.admin._id;
    await developer.save();

    logAudit({
      action: 'admin.developer.live_access_approved', category: 'admin', severity: 'warning',
      message: `${req.admin.name || req.admin.email} approved live API access for ${developer.companyName}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName },
    });

    res.json({ success: true, developer });
  } catch (error) {
    console.error('Approve Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    A developer's registered webhook endpoints, with delivery health
//          — lets support/ops see at a glance whether an integration (an
//          ISP's reconnection system, a CRM sync) is actually receiving
//          events, without needing DB access. Never exposes the signing
//          secret (`-secret`) — admins don't need it, only PayChain's own
//          delivery worker does.
// @route   GET /api/admin/developers/:id/webhooks
// @access  Private (Admin — owner/admin/analyst)
export const getDeveloperWebhooks = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const webhooks = await DeveloperWebhook.find({ developerId: developer._id }).select('-secret').sort({ createdAt: -1 });

    const data = await Promise.all(webhooks.map(async (webhook) => {
      const [statusCounts, recentDeliveries] = await Promise.all([
        WebhookDelivery.aggregate([
          { $match: { webhookId: webhook._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        WebhookDelivery.find({ webhookId: webhook._id }).sort({ createdAt: -1 }).limit(10),
      ]);

      const deliveryStats = { pending: 0, success: 0, failed: 0, exhausted: 0 };
      statusCounts.forEach((row) => { deliveryStats[row._id] = row.count; });

      return {
        _id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        lastDeliveryAt: webhook.lastDeliveryAt,
        lastDeliveryStatus: webhook.lastDeliveryStatus,
        createdAt: webhook.createdAt,
        deliveryStats,
        recentDeliveries: recentDeliveries.map((d) => ({
          _id: d._id,
          event: d.event,
          status: d.status,
          attempts: d.attempts,
          lastResponseCode: d.lastResponseCode,
          lastError: d.lastError,
          createdAt: d.createdAt,
        })),
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get Developer Webhooks Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reject a developer's live-access request (leaves sandbox access untouched)
// @route   PATCH /api/admin/developers/:id/reject-live
// @access  Private (Admin — owner/admin)
export const rejectLiveAccess = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    developer.liveAccess = developer.liveAccess || {};
    developer.liveAccess.approved = false;
    developer.liveAccess.requestedAt = null;
    await developer.save();

    logAudit({
      action: 'admin.developer.live_access_rejected', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} rejected live API access for ${developer.companyName}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName },
    });

    res.json({ success: true, developer });
  } catch (error) {
    console.error('Reject Live Access Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Matches developerCollectService.js's own SIMULATED_SETTLE_MS (4000) — a
// simulated test-mode collect flips 'pending' -> 'success' on that timer,
// so this must wait at least that long before re-reading the payment to
// report a real result instead of a premature 'pending'.
const COLLECT_TEST_WAIT_MS = 4500;

// @desc    Runs two live checks of a developer's integration before an
//          admin approves live access — the same two things a real
//          integration actually depends on:
//            1. A simulated test-mode collect resolves end-to-end (proves
//               the developer has a linked merchant, an active test API
//               key, and the collect pipeline genuinely works for their
//               account) — zero real money, same simulate path every
//               test-mode API call already uses.
//            2. Every one of the developer's registered webhook endpoints
//               actually receives and acks a delivery (proves THEIR server
//               is correctly implemented, reachable, and returns 2xx) —
//               reuses the exact same sendTestWebhook the developer's own
//               "Send test event" dashboard button uses, just admin-
//               triggered so this can be checked before, not after, live
//               access is granted.
//          A developer with no registered webhook isn't treated as a
//          failure — polling GET /payments/:id is a documented, valid
//          alternative — but it's called out so the admin knows to expect
//          that integration to poll rather than assume something's broken.
// @route   POST /api/admin/developers/:id/run-integration-test
// @access  Private (Admin — owner/admin/analyst)
export const runIntegrationTest = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const merchantId = developer.linkedMerchant?.merchantId || null;
    const merchant = merchantId ? await Merchant.findById(merchantId).select('businessName status') : null;

    // ── Test 1: simulated collect ──────────────────────────────────────
    let collectTest;
    if (!merchantId || !merchant) {
      collectTest = { passed: false, message: 'No merchant account linked yet — complete /api/developer/link-merchant first.' };
    } else {
      const testKey = await ApiKey.findOne({ developerId: developer._id, mode: 'test', status: 'active' }).sort({ createdAt: -1 });
      if (!testKey) {
        collectTest = { passed: false, message: 'No active test-mode API key found — the developer needs to create one from their dashboard.' };
      } else {
        try {
          const idempotencyKey = `admin-integration-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const payment = await initiateCollectPayment({
            developerId: developer._id,
            apiKeyId: testKey._id,
            merchantId,
            mode: 'test',
            amount: 10,
            phone: '0712345678',
            reference: 'paychain-admin-integration-test',
            idempotencyKey,
          });
          await new Promise((resolve) => setTimeout(resolve, COLLECT_TEST_WAIT_MS));
          const settled = await DeveloperPayment.findById(payment._id);
          collectTest = settled?.status === 'success'
            ? { passed: true, message: 'Simulated test-mode collect resolved to success.', paymentId: settled._id }
            : { passed: false, message: `Simulated collect did not resolve to success (status: ${settled?.status || 'unknown'}).`, paymentId: settled?._id || null };
        } catch (err) {
          const message = err instanceof CollectValidationError ? err.message : (err.message || 'Unexpected error running the simulated collect.');
          collectTest = { passed: false, message };
        }
      }
    }

    // ── Test 2: webhook delivery ───────────────────────────────────────
    const webhooks = await DeveloperWebhook.find({ developerId: developer._id, status: 'active' });
    let webhookTests = [];
    if (webhooks.length > 0) {
      webhookTests = await Promise.all(webhooks.map(async (webhook) => {
        try {
          const delivery = await sendTestWebhook(webhook._id);
          return {
            webhookId: webhook._id,
            url: webhook.url,
            passed: delivery.status === 'success',
            responseCode: delivery.lastResponseCode,
            error: delivery.lastError,
          };
        } catch (err) {
          return { webhookId: webhook._id, url: webhook.url, passed: false, responseCode: null, error: err.message };
        }
      }));
    }

    logAudit({
      action: 'admin.developer.integration_test_run', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} ran an integration test for ${developer.companyName}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: {
        developerId: String(developer._id),
        companyName: developer.companyName,
        collectTestPassed: collectTest.passed,
        webhookCount: webhooks.length,
        webhookTestsPassed: webhookTests.filter((w) => w.passed).length,
      },
    });

    res.json({
      success: true,
      data: {
        merchant: merchant ? { _id: merchant._id, businessName: merchant.businessName, status: merchant.status } : null,
        collectTest,
        webhookTests,
        noWebhooksRegistered: webhooks.length === 0,
        ranAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Run Integration Test Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
