import mongoose from 'mongoose';

// Second-admin (maker-checker) gate for money-moving admin actions. An admin
// with mutator rights can REQUEST one of these actions but never execute it
// alone — a different owner/admin must approve before the underlying credit,
// write-off, etc. actually runs. Enforced server-side (approveApproval /
// rejectApproval reject a requester approving their own request), not just
// hidden in the UI.
const adminApprovalSchema = new mongoose.Schema({
  // Registered in services/adminApprovalExecutors.js — add a new gated
  // action by adding both an enum value here and an executor there.
  actionType: {
    type: String,
    required: true,
    enum: ['ncba_manual_credit', 'revenue_write_off'],
  },
  // Human-readable one-liner shown in the approval queue, e.g. "Manually
  // credit KES 5,000 to Acme Traders (ref FT24...)". Built once at request
  // time so the queue never needs to re-derive it from raw payload fields.
  summary: { type: String, required: true },
  // Exactly what the executor needs to run the action — re-validated fresh
  // at approval time (not just trusted from request time), since real time
  // can pass between the two steps.
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'executed', 'failed'],
    default: 'pending',
  },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  decidedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  // Whatever the executor returned, once it actually ran successfully.
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  executionError: { type: String, default: null },
  // A stale request (nobody reviewed it) should not be approvable forever —
  // a 24h window forces a fresh request instead of executing against
  // conditions from days ago.
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

adminApprovalSchema.index({ status: 1, createdAt: -1 });

const AdminApproval = mongoose.model('AdminApproval', adminApprovalSchema);

export default AdminApproval;
