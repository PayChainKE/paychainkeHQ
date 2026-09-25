import AdminApproval from '../models/AdminApproval.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from '../controllers/adminController.js';

// A stale, unreviewed request shouldn't be approvable forever — force a
// fresh request (re-validated against current state) instead.
const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Queues a money-moving action for a second, different admin to approve
// instead of running it immediately. Called by a gated controller once its
// own input validation (and any fail-fast duplicate/sanity checks) already
// passed — payload is exactly what the matching executor in
// adminApprovalExecutors.js needs to re-validate and run the action later.
export async function requestAdminApproval({ actionType, summary, payload, admin, req, auditAction, auditMessage }) {
  const approval = await AdminApproval.create({
    actionType,
    summary,
    payload,
    requestedBy: admin._id,
    expiresAt: new Date(Date.now() + APPROVAL_WINDOW_MS),
  });
  logAudit({
    action: auditAction, category: 'admin', severity: 'warning',
    message: auditMessage,
    actor: adminActor(admin), req,
    metadata: { approvalId: String(approval._id), actionType, summary },
  });
  return approval;
}
