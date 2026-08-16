import mongoose from 'mongoose';

// Persisted record of every alert notifyAdmins() sends (see
// utils/securityAlerts.js) — until this model existed, these events only
// ever reached admins as an email with zero trace inside the app itself.
// Powers the admin dashboard's Security > Alerts feed.
const SecurityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['otp_lockout', 'pin_lockout', 'large_transaction', 'new_admin_account', 'new_officer_account'],
    required: true,
    index: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
    index: true,
  },
  subject: { type: String, required: true },
  heading: { type: String, required: true },
  // Same HTML fragment sent in the alert email (see sendSecurityAlertEmail)
  // — reused as-is here rather than a second plain-text copy.
  details: { type: String, required: true },
  // Free-form context specific to the alert type (e.g. { merchantId, amount }
  // for large_transaction, { email, role } for new_admin_account) — shown
  // in the drawer, not rendered directly into the table.
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  acknowledged: { type: Boolean, default: false, index: true },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true });

SecurityAlertSchema.index({ createdAt: -1 });

export default mongoose.model('SecurityAlert', SecurityAlertSchema);
