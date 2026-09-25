import mongoose from 'mongoose';
import AdminApproval from '../models/AdminApproval.js';
import Admin from '../models/Admin.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { APPROVAL_EXECUTORS } from '../services/adminApprovalExecutors.js';

// Maker-checker (dual-control) approval queue for money-moving admin
// actions. A gated controller (e.g. adminManualCreditNcbaCollection,
// writeOffRevenueDeficit) validates its own input and queues an
// AdminApproval instead of executing directly; this controller is the only
// place that ever runs the matching executor, and only once a DIFFERENT
// owner/admin approves — never the admin who requested it.
const ACTION_LABELS = {
  ncba_manual_credit: 'Manual NCBA collection credit',
  revenue_write_off: 'Revenue deficit write-off',
};

function publicAdmin(a) {
  return a ? { id: a._id, name: a.name || null, email: a.email || null } : null;
}

function publicApproval(a) {
  return {
    id: a._id,
    actionType: a.actionType,
    actionLabel: ACTION_LABELS[a.actionType] || a.actionType,
    summary: a.summary,
    status: a.status,
    requestedBy: publicAdmin(a.requestedBy),
    decidedBy: publicAdmin(a.decidedBy),
    decidedAt: a.decidedAt,
    rejectionReason: a.rejectionReason,
    result: a.result,
    executionError: a.executionError,
    expiresAt: a.expiresAt,
    isExpired: a.status === 'pending' && a.expiresAt < new Date(),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// @desc    Pending requests (any admin) plus the last 20 decided ones, for
//          the admin Approvals queue page.
// @route   GET /api/admin/approvals
// @access  Private (Admin — owner/admin)
export const listApprovals = async (req, res) => {
  try {
    const [pending, recent] = await Promise.all([
      AdminApproval.find({ status: 'pending' }).sort({ createdAt: -1 })
        .populate('requestedBy', 'name email').populate('decidedBy', 'name email'),
      AdminApproval.find({ status: { $ne: 'pending' } }).sort({ updatedAt: -1 }).limit(20)
        .populate('requestedBy', 'name email').populate('decidedBy', 'name email'),
    ]);
    res.json({ success: true, pending: pending.map(publicApproval), recent: recent.map(publicApproval) });
  } catch (error) {
    console.error('List Approvals Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve a pending request — runs the underlying action
//          immediately. A requester can never approve their own request
//          (enforced here, not just hidden in the UI); an expired request
//          must be re-submitted rather than approved against stale
//          conditions.
// @route   POST /api/admin/approvals/:id/approve
// @access  Private (Admin — owner/admin)
export const approveApproval = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Approval not found.' });
    const approval = await AdminApproval.findById(req.params.id);
    if (!approval) return res.status(404).json({ error: 'Approval not found.' });
    if (approval.status !== 'pending') return res.status(409).json({ error: `This request is already ${approval.status}.` });
    if (String(approval.requestedBy) === String(req.admin._id)) {
      return res.status(403).json({ error: 'You requested this action — a different admin must approve it.' });
    }
    if (approval.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This request has expired. Ask the requester to submit it again.' });
    }

    const executor = APPROVAL_EXECUTORS[approval.actionType];
    if (!executor) return res.status(500).json({ error: `No executor registered for "${approval.actionType}".` });

    const requestedByAdmin = await Admin.findById(approval.requestedBy).select('name email');

    approval.status = 'approved';
    approval.decidedBy = req.admin._id;
    approval.decidedAt = new Date();
    await approval.save();

    try {
      const result = await executor(approval.payload, { req, requestedByAdmin });
      approval.status = 'executed';
      approval.result = result;
      await approval.save();

      logAudit({
        action: 'admin.approval.approved', category: 'admin', severity: 'warning',
        message: `${req.admin.name || req.admin.email} approved and ran "${approval.summary}" (requested by ${requestedByAdmin?.name || requestedByAdmin?.email || 'an admin'}).`,
        actor: adminActor(req.admin), req,
        metadata: { approvalId: String(approval._id), actionType: approval.actionType, requestedBy: String(approval.requestedBy) },
      });

      return res.json({ success: true, approval: publicApproval(approval) });
    } catch (execErr) {
      approval.status = 'failed';
      approval.executionError = (execErr?.message || 'Execution failed.').slice(0, 500);
      await approval.save();

      logAudit({
        action: 'admin.approval.execution_failed', category: 'admin', severity: 'warning',
        message: `Approved "${approval.summary}" but it failed to run: ${approval.executionError}`,
        actor: adminActor(req.admin), req,
        metadata: { approvalId: String(approval._id), actionType: approval.actionType },
      });

      return res.status(500).json({ error: `Approved, but it failed to run: ${approval.executionError}` });
    }
  } catch (error) {
    console.error('Approve Approval Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reject a pending request — nothing runs.
// @route   POST /api/admin/approvals/:id/reject   body: { reason? }
// @access  Private (Admin — owner/admin)
export const rejectApproval = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Approval not found.' });
    const approval = await AdminApproval.findById(req.params.id);
    if (!approval) return res.status(404).json({ error: 'Approval not found.' });
    if (approval.status !== 'pending') return res.status(409).json({ error: `This request is already ${approval.status}.` });
    if (String(approval.requestedBy) === String(req.admin._id)) {
      return res.status(403).json({ error: 'You requested this action — a different admin must decide on it.' });
    }

    approval.status = 'rejected';
    approval.decidedBy = req.admin._id;
    approval.decidedAt = new Date();
    approval.rejectionReason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : null;
    await approval.save();

    logAudit({
      action: 'admin.approval.rejected', category: 'admin', severity: 'info',
      message: `${req.admin.name || req.admin.email} rejected "${approval.summary}"${approval.rejectionReason ? `: ${approval.rejectionReason}` : ''}.`,
      actor: adminActor(req.admin), req,
      metadata: { approvalId: String(approval._id), actionType: approval.actionType, requestedBy: String(approval.requestedBy) },
    });

    res.json({ success: true, approval: publicApproval(approval) });
  } catch (error) {
    console.error('Reject Approval Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
