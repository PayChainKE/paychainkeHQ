import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';

// @desc    Paginated audit log feed with filters. Powers both the global
//          /audit-log admin page and the per-merchant log panel in the KYB
//          drawer (just pass ?merchantId=...).
//
// @route   GET /api/admin/audit-log
//          Query: ?merchantId=&action=&category=&severity=&actor=&q=&from=&to=&page=&limit=
// @access  Private (Admin)
export const getAuditLog = async (req, res) => {
  try {
    const {
      merchantId, action, category, severity, actor, platform,
      q, from, to,
      page = 1, limit = 25,
    } = req.query;

    const filter = {};

    if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
      filter.merchantId = merchantId;
    }
    if (action)   filter.action   = action;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (actor)    filter['actor.type'] = actor;
    if (platform) filter.platform = platform;

    // Free-text search across merchant email/name and the action verb. We
    // escape regex specials so a "." in an email doesn't act as wildcard.
    if (q && String(q).trim()) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [
        { merchantEmail: rx },
        { merchantName: rx },
        { action: rx },
        { message: rx },
        { ip: rx },
      ];
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    // Capped at 5000 (not the usual ~100) so the admin CSV export can pull a
    // full filtered range in one request. Still bounded, and this route is
    // admin-only, so there's no public abuse vector.
    const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 25));
    const skip     = (pageNum - 1) * pageSize;

    // Run the data fetch and the KPI rollup in parallel.
    const [rows, total, kpis] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      AuditLog.countDocuments(filter),
      // Last-24h health pulse — independent of the filter so the header
      // KPIs reflect overall platform activity, not the filtered view.
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            critical:  { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            warnings:  { $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] } },
            logins:    { $sum: { $cond: [{ $eq: ['$action', 'merchant.login.success'] }, 1, 0] } },
            failedLogins: { $sum: { $cond: [{ $eq: ['$action', 'merchant.login.failed'] }, 1, 0] } },
            resets:    { $sum: { $cond: [{ $eq: ['$action', 'merchant.password.reset_completed'] }, 1, 0] } },
            adminActions: { $sum: { $cond: [{ $eq: ['$actor.type', 'admin'] }, 1, 0] } },
            // Platform split — counted across ALL events, not just logins,
            // so the admin sees which surface is more active overall.
            webEvents:    { $sum: { $cond: [{ $eq: ['$platform', 'web'] }, 1, 0] } },
            mobileEvents: { $sum: { $cond: [{ $eq: ['$platform', 'mobile'] }, 1, 0] } },
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
      kpis: kpis[0] || {
        total: 0, critical: 0, warnings: 0, logins: 0, failedLogins: 0, resets: 0, adminActions: 0,
        webEvents: 0, mobileEvents: 0,
      },
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Per-merchant log convenience endpoint. Same shape as above but
//          forces the merchantId filter from the URL param so the admin
//          frontend doesn't have to construct query strings.
// @route   GET /api/admin/merchants/:id/audit-log
// @access  Private (Admin)
export const getMerchantAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    const { limit = 50 } = req.query;
    const cap = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const rows = await AuditLog.find({ merchantId: id })
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean();
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Merchant Audit Log Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
