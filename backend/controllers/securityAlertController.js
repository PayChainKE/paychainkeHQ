import mongoose from 'mongoose';
import SecurityAlert from '../models/SecurityAlert.js';

// @desc    Paginated, filterable feed of persisted security alerts (OTP/PIN
//          lockouts, large transfers, new privileged-account creation) —
//          same events utils/securityAlerts.js emails to admins, now with
//          an in-app record and an acknowledge workflow.
// @route   GET /api/admin/security-alerts
//          Query: ?type=&severity=&acknowledged=&q=&from=&to=&page=&limit=
// @access  Private (Admin — owner/admin/analyst)
export const getSecurityAlerts = async (req, res) => {
  try {
    const {
      type, severity, acknowledged, q, from, to,
      page = 1, limit = 25,
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (acknowledged === 'true') filter.acknowledged = true;
    if (acknowledged === 'false') filter.acknowledged = false;

    // Same regex-escape pattern as auditLogController.js's getAuditLog —
    // a "." in a search term shouldn't act as a wildcard.
    if (q && String(q).trim()) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ subject: rx }, { heading: rx }, { details: rx }];
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * pageSize;

    const [rows, total, kpis] = await Promise.all([
      SecurityAlert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('acknowledgedBy', 'name email')
        .lean(),
      SecurityAlert.countDocuments(filter),
      // Last-24h pulse, independent of the current filter — mirrors
      // getAuditLog's KPI pattern.
      SecurityAlert.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            warnings: { $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] } },
            unacknowledged: { $sum: { $cond: [{ $eq: ['$acknowledged', false] }, 1, 0] } },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: rows,
      page: pageNum,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      kpis: kpis[0] || { total: 0, critical: 0, warnings: 0, unacknowledged: 0 },
    });
  } catch (error) {
    console.error('Security Alerts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark an alert as reviewed. Doesn't delete anything — the record
//          (and who acknowledged it, and when) stays for the audit trail.
// @route   PATCH /api/admin/security-alerts/:id/acknowledge
// @access  Private (Admin — owner/admin only, via requireMutator)
export const acknowledgeSecurityAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid alert id.' });
    }

    const alert = await SecurityAlert.findByIdAndUpdate(
      id,
      { acknowledged: true, acknowledgedBy: req.admin._id, acknowledgedAt: new Date() },
      { new: true }
    ).populate('acknowledgedBy', 'name email');

    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('Acknowledge Security Alert Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Unacknowledged count only — cheap enough to poll from the
//          sidebar for a badge, same pattern as system-status.
// @route   GET /api/admin/security-alerts/unacknowledged-count
// @access  Private (Admin — owner/admin/analyst)
export const getUnacknowledgedCount = async (req, res) => {
  try {
    const count = await SecurityAlert.countDocuments({ acknowledged: false });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Unacknowledged Count Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
