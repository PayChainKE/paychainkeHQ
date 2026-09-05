import Developer from '../models/Developer.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import Contact from '../models/Contact.js';
import { logAudit } from '../utils/auditLog.js';
import { runIntegrationTestForDeveloper } from '../services/developerIntegrationTestService.js';
import { sendSupportReply } from '../utils/resend.js';

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

// @desc    Runs two live checks of a developer's integration before an
//          admin approves live access — see
//          services/developerIntegrationTestService.js for what they check
//          and why. Same test the developer's own live-access request
//          already auto-runs (developerController.js#requestLiveAccess);
//          this route lets an admin re-run it on demand — e.g. after
//          telling a developer to fix something and waiting for them to
//          confirm.
// @route   POST /api/admin/developers/:id/run-integration-test
// @access  Private (Admin — owner/admin/analyst)
export const runIntegrationTest = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const result = await runIntegrationTestForDeveloper(developer);

    logAudit({
      action: 'admin.developer.integration_test_run', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} ran an integration test for ${developer.companyName}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: {
        developerId: String(developer._id),
        companyName: developer.companyName,
        collectTestPassed: result.collectTest.passed,
        webhookCount: result.webhookTests.length,
        webhookTestsPassed: result.webhookTests.filter((w) => w.passed).length,
      },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Run Integration Test Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get the admin↔developer email conversation for one developer.
//          One running thread per developer (a single Contact document,
//          re-used across every email sent to them — see sendDeveloperEmail
//          below), not a fresh thread per message. Returns null when
//          nothing has ever been sent to this developer yet.
// @route   GET /api/admin/developers/:id/messages
// @access  Private (Admin — owner/admin/analyst)
export const getDeveloperMessages = async (req, res) => {
  try {
    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    const thread = await Contact.findOne({ developerId: developer._id }).lean();
    res.json({ success: true, data: thread || null });
  } catch (error) {
    console.error('Get Developer Messages Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a real email to a developer (approval/rejection notice, a
//          nudge to link their merchant account, or any custom message —
//          the admin frontend supplies canned templates, this endpoint
//          just sends whatever subject/body it's given) and record it in
//          that developer's conversation thread. Reuses the exact same
//          Resend-backed send + delivery-id tracking the merchant-facing
//          Contact/Messages feature already uses (sendSupportReply), so
//          delivery failures are surfaced rather than silently "sent".
//
//          Note: unlike a real two-way inbox, a developer hitting "Reply"
//          in their email client does NOT appear here automatically — this
//          codebase has no inbound-email webhook anywhere yet (the
//          Contact/Messages reply_to already points at the sending admin's
//          own address, not a monitored inbox). This endpoint only records
//          what PayChain sends, not what comes back.
// @route   POST /api/admin/developers/:id/messages
// @access  Private (Admin — owner/admin)
export const sendDeveloperEmail = async (req, res) => {
  try {
    const { subject, body } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    if (!body || String(body).trim().length < 2) {
      return res.status(400).json({ error: 'Message body cannot be empty.' });
    }
    if (String(body).length > 10000) {
      return res.status(400).json({ error: 'Message body too long.' });
    }

    const developer = await Developer.findById(req.params.id);
    if (!developer) return res.status(404).json({ error: 'Developer not found.' });

    let resendId = null;
    try {
      const sent = await sendSupportReply(developer.email, developer.name, subject, body, req.admin?.email, []);
      resendId = sent?.data?.id || sent?.id || null;
    } catch (mailErr) {
      return res.status(502).json({ error: 'Failed to send the email. Nothing was recorded.' });
    }

    const entry = {
      body: String(body).trim(),
      subject: String(subject).trim(),
      attachments: [],
      sentByEmail: req.admin?.email || 'support@paychain.co.ke',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
      resendId,
    };

    let thread = await Contact.findOne({ developerId: developer._id });
    if (!thread) {
      // First email ever sent to this developer — the Contact schema
      // requires a top-level subject/message, but the frontend renders
      // this thread purely from `replies` (see entry pushed below), so
      // these top-level fields exist only to satisfy the schema/for
      // searchability in the general Messages inbox, not for display here.
      thread = await Contact.create({
        name: developer.name,
        email: developer.email,
        contactType: 'developer',
        developerId: developer._id,
        subject: entry.subject,
        message: entry.body,
        isRead: true,
        status: 'in_progress',
        replies: [entry],
        lastRepliedAt: entry.sentAt,
      });
    } else {
      thread.replies.push(entry);
      thread.lastRepliedAt = entry.sentAt;
      thread.isRead = true;
      if (thread.status === 'open') thread.status = 'in_progress';
      await thread.save();
    }

    logAudit({
      action: 'admin.developer.email_sent', category: 'admin', severity: 'info',
      message: `${req.admin?.name || req.admin?.email} emailed ${developer.companyName}: "${entry.subject}"`,
      req, actor: { type: 'admin', id: req.admin?._id, email: req.admin?.email, name: req.admin?.name },
      metadata: { developerId: String(developer._id), companyName: developer.companyName, subject: entry.subject },
    });

    res.json({ success: true, data: thread });
  } catch (error) {
    console.error('Send Developer Email Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
