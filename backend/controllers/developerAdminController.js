import Developer from '../models/Developer.js';
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
