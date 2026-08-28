import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';

// Transaction types that represent money arriving without the merchant
// themselves initiating anything (a customer paid them, or a webhook
// credited them) — shown with actor.type 'system' rather than 'self' in
// the merged feed below, matching how every other webhook-driven credit
// in this codebase is framed.
const INBOUND_TXN_TYPES = ['inbound', 'ncba_inbound', 'top_up'];

// A merchant's actual payment activity (send/receive money, M-Pesa/NCBA
// transfers) has never been written to AuditLog anywhere in this codebase
// — it only ever lived in the Transaction collection, so the Audit Log
// page could never show it no matter what an admin filtered for. Rather
// than double-write every transaction into AuditLog (2x write volume,
// duplicate storage, and TTL semantics that don't fit permanent financial
// records), this merges Transaction documents into the SAME query via
// MongoDB's $unionWith — reshaped on the fly into the exact field shape
// AuditLog rows already have, so the existing frontend renders them with
// no changes. Nothing is persisted; the merge happens per-request.
//
// Returns null when the current filters couldn't possibly match a
// transaction-shaped row (skips the union entirely rather than running a
// pipeline that would just return nothing) — the transaction branch is
// always category 'wallet', platform 'unknown', and actor.type is either
// 'self' or 'system', never 'admin'/'officer'.
function buildTransactionUnionStage({ merchantId, action, category, severity, actor, platform, q, from, to }) {
  if (category && category !== 'wallet') return null;
  if (platform && platform !== 'unknown') return null;
  if (actor && !['self', 'system'].includes(actor)) return null;
  if (action && !action.startsWith('merchant.transaction.')) return null;

  const match = {};
  if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
    match.merchantId = new mongoose.Types.ObjectId(merchantId);
  }
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const pipeline = [{ $match: match }];

  pipeline.push(
    { $lookup: { from: Merchant.collection.name, localField: 'merchantId', foreignField: '_id', as: 'merchantDoc' } },
    { $unwind: { path: '$merchantDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        merchantId: 1,
        merchantEmail: '$merchantDoc.email',
        merchantName: '$merchantDoc.businessName',
        actor: {
          type: { $cond: [{ $in: ['$type', INBOUND_TXN_TYPES] }, 'system', 'self'] },
          id: '$merchantId',
          email: '$merchantDoc.email',
          name: '$merchantDoc.businessName',
        },
        action: { $concat: ['merchant.transaction.', '$type'] },
        category: { $literal: 'wallet' },
        severity: {
          $switch: {
            branches: [
              { case: { $in: ['$status', ['completed', 'verified']] }, then: 'success' },
              { case: { $eq: ['$status', 'failed'] }, then: 'warning' },
            ],
            default: 'info',
          },
        },
        message: {
          $concat: [
            'Ksh ', { $toString: { $round: [{ $ifNull: ['$kesAmount', '$amount'] }, 2] } },
            ' · Ref ', '$reference',
          ],
        },
        ip: { $literal: null },
        userAgent: { $literal: null },
        platform: { $literal: 'unknown' },
        metadata: {
          reference: '$reference',
          transactionType: '$type',
          status: '$status',
          kesAmount: '$kesAmount',
          usdcAmount: '$usdcAmount',
          currency: '$currency',
          paychainFee: '$paychainFee',
          settlementRail: '$settlementRail',
          mobileNetwork: '$mobileNetwork',
          sender: '$sender',
          recipient: '$recipient',
        },
        createdAt: 1,
        updatedAt: '$createdAt',
      },
    },
  );

  const postMatch = {};
  if (severity) postMatch.severity = severity;
  if (action) postMatch.action = action;
  if (actor) postMatch['actor.type'] = actor;
  if (q && String(q).trim()) {
    const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    postMatch.$or = [
      { merchantEmail: rx },
      { merchantName: rx },
      { action: rx },
      { message: rx },
      { 'metadata.reference': rx },
      { 'metadata.sender.name': rx },
      { 'metadata.recipient.name': rx },
    ];
  }
  if (Object.keys(postMatch).length) pipeline.push({ $match: postMatch });

  return pipeline;
}

// @desc    Paginated audit log feed with filters. Powers both the global
//          /audit-log admin page and the per-merchant log panel in the KYB
//          drawer (just pass ?merchantId=...). Merges in the merchant's
//          real transaction activity (see buildTransactionUnionStage above)
//          so "all merchant activity" actually means all of it, not just
//          auth/security/admin events.
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
      // Aggregate()'s $match, unlike find(), does NOT auto-cast a string to
      // the schema's ObjectId type — an uncast string here would silently
      // match nothing once this ran through .aggregate() instead of .find().
      filter.merchantId = new mongoose.Types.ObjectId(merchantId);
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

    const txnUnionPipeline = buildTransactionUnionStage({ merchantId, action, category, severity, actor, platform, q, from, to });

    // Combined pipeline: real AuditLog rows (reshaped to drop internal-only
    // fields like expiresAt) unioned with the reshaped Transaction rows
    // above, sorted/paginated as one feed, plus a total count of the union.
    const combinedPipeline = [
      { $match: filter },
      {
        $project: {
          _id: 1, merchantId: 1, merchantEmail: 1, merchantName: 1, actor: 1,
          action: 1, category: 1, severity: 1, message: 1, ip: 1, userAgent: 1,
          platform: 1, metadata: 1, createdAt: 1, updatedAt: 1,
        },
      },
      ...(txnUnionPipeline ? [{ $unionWith: { coll: Transaction.collection.name, pipeline: txnUnionPipeline } }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: pageSize }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    // Run the merged feed and the KPI rollup in parallel. The KPI pulse
    // stays AuditLog-only (last-24h sign-ins/resets/admin-actions) — those
    // are specifically security/auth metrics, not transaction volume, so
    // merging Transaction into it wouldn't change what it's measuring.
    const [combined, kpis] = await Promise.all([
      // allowDiskUse: an unfiltered ("All time") view unions the full
      // AuditLog + Transaction collections before sorting — fine at
      // today's volume, but this is the honest way to avoid a hard error
      // once the in-memory sort would otherwise exceed Mongo's 100MB cap.
      AuditLog.aggregate(combinedPipeline).allowDiskUse(true),
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

    const rows  = combined[0]?.data || [];
    const total = combined[0]?.totalCount?.[0]?.count || 0;

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
