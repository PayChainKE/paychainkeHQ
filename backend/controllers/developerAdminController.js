import Developer from '../models/Developer.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { logAudit } from '../utils/auditLog.js';

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
