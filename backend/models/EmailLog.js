import mongoose from 'mongoose';

// One row per outbound merchant-facing email actually sent via
// utils/resend.js (through utils/emailLog.js#logEmail) — Resend's own
// dashboard remains the delivery-status source of truth (see
// contactController.js#getDeliveryStatus), this is PayChain's own durable
// record of what was sent, to whom, and why, so an admin following up on a
// KYC review — or any other merchant conversation — doesn't have to guess
// what the merchant already received.
//
// Deliberately NEVER written for one-time-code emails (sendOTP,
// sendAdminActionOTP) — a live OTP must never be persisted somewhere an
// admin can browse it later. Also not written for admin/officer-internal
// sends (team invites, officer credentials) or for bulk marketing
// (newsletter/waitlist, already tracked via NewsletterCampaign) — see
// utils/emailLog.js's own doc comment for the full scope decision.
const EmailLogSchema = new mongoose.Schema({
  to: { type: String, required: true, trim: true, lowercase: true, index: true },
  // Best-effort — resolved by email lookup at log time. Null for a
  // recipient who isn't a merchant (rare in this log's current scope, but
  // possible e.g. a KYC contact email that differs from the account email).
  // `to` is always present regardless, so the log stays useful either way.
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
  type: { type: String, required: true, index: true },
  subject: { type: String, required: true, trim: true },
  bodyHtml: { type: String, required: true },
  resendId: { type: String, default: null },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent', index: true },
  error: { type: String, default: null },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);

export default EmailLog;
