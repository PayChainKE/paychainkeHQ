import { executeNcbaManualCredit } from '../controllers/ncbaAccountNotificationController.js';
import { executeRevenueWriteOff } from '../controllers/revenueController.js';

// One executor per AdminApproval.actionType, called only after a second,
// different admin approves (adminApprovalController.js#approveApproval).
// Each receives (payload, { req, requestedByAdmin }) — req.admin is the
// APPROVING admin, requestedByAdmin is who originally asked for it — and
// either returns the result to store, or throws. A thrown error leaves the
// approval in 'failed' with the message attached, rather than silently
// losing the request.
export const APPROVAL_EXECUTORS = {
  ncba_manual_credit: executeNcbaManualCredit,
  revenue_write_off: executeRevenueWriteOff,
};
