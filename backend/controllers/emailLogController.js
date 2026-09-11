import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// Human-readable labels for the `type` values written by utils/emailLog.js —
// kept here (not in the model) since this is presentation, not data shape.
export const EMAIL_TYPE_LABELS = {
  wallet_activation: 'Wallet Activation',
  welcome: 'Welcome',
  security_alert: 'Security Alert',
  merchant_invite: 'Merchant Invite',
  kyb_revision_request: 'KYC Revision Requested',
  kyb_rejection: 'KYC Rejected',
  password_reset_confirmation: 'Password Reset',
  contact_details_changed: 'Contact Details Changed',
  batch_receipt: 'Bulk Pay Receipt',
  statement: 'Transaction Statement',
  dormancy_reminder: 'Dormancy Reminder',
  dormancy_final_warning: 'Dormancy Final Warning',
  dormant_account_reminder_manual: 'Dormant Account Reminder (Manual)',
};

// @desc    Paginated, filterable list of every logged outbound email — the
//          admin's single place to see what PayChain has told a merchant
//          (KYC outcomes, security alerts, receipts, dormancy nudges, etc.)
//          without guessing from scratch during a follow-up conversation.
// @route   GET /api/admin/email-log
// @access  Private (Admin)
export const getEmailLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 25));

    const filter = {};
    if (req.query.merchantId && mongoose.Types.ObjectId.isValid(req.query.merchantId)) {
      filter.merchantId = req.query.merchantId;
    }
    if (req.query.type && EMAIL_TYPE_LABELS[req.query.type]) {
      filter.type = req.query.type;
    }
    if (req.query.status && ['sent', 'failed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const q = String(req.query.q || '').trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ to: re }, { subject: re }];
    }

    const [total, rows] = await Promise.all([
      EmailLog.countDocuments(filter),
      EmailLog.find(filter)
        .sort('-sentAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchantId', 'businessName name')
        .select('-bodyHtml') // list view — full body fetched on demand via getEmailLogDetail
        .lean(),
    ]);

    res.json({
      success: true,
      data: rows,
      types: EMAIL_TYPE_LABELS,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Get Email Logs Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Full record for one logged email, including the body HTML —
//          split from the list endpoint since bodyHtml can be sizeable and
//          the list view doesn't need it for every row on the page.
// @route   GET /api/admin/email-log/:id
// @access  Private (Admin)
export const getEmailLogDetail = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const row = await EmailLog.findById(req.params.id)
      .populate('merchantId', 'businessName name email phone')
      .lean();
    if (!row) return res.status(404).json({ error: 'Email log entry not found.' });
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('Get Email Log Detail Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Clear email log entries — either every record, or a specific set
//          of ids (matches the "select rows, delete selected" pattern used
//          by the SMS broadcast history). Only removes the log record; it
//          cannot un-send an email that already went out.
// @route   POST /api/admin/email-log/clear
// @access  Private (Admin — owner/admin only, see routes)
export const clearEmailLogs = async (req, res) => {
  try {
    const { ids } = req.body || {};
    const clearingAll = !Array.isArray(ids) || ids.length === 0;

    const filter = clearingAll ? {} : { _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) } };
    const result = await EmailLog.deleteMany(filter);

    logAudit({
      action: 'admin.email_log.cleared', category: 'admin', severity: 'warning',
      message: clearingAll
        ? `Cleared entire email log (${result.deletedCount} entries)`
        : `Deleted ${result.deletedCount} selected email log entries`,
      actor: adminActor(req.admin), req,
      metadata: { deletedCount: result.deletedCount, clearingAll },
    });

    res.json({ success: true, message: `Removed ${result.deletedCount} entr${result.deletedCount === 1 ? 'y' : 'ies'}.`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Clear Email Logs Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
