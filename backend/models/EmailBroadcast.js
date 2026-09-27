import mongoose from 'mongoose';

// One row per admin-initiated email blast (system maintenance notices,
// payout-rail outage notices, security reminders, etc.) — mirrors
// SmsBroadcast's exact shape (same categories, same audience/recipient
// bookkeeping), just with a subject line and no SMS-length cap since email
// has no per-segment cost to budget against.
const EmailBroadcastSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  category: {
    type: String,
    enum: ['maintenance', 'holiday', 'security', 'general', 'tips'],
    default: 'general',
  },
  audience: { type: String, enum: ['all', 'selected'], required: true },
  // Only populated when audience === 'selected' — the merchants targeted.
  merchantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' }],
  // Snapshot of recipient counts at send-time.
  recipientCount: { type: Number, required: true, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  // Sends run in the background (see sendEmailBroadcast) — successCount/
  // failureCount stay at 0 until every send finishes, same as SmsBroadcast.
  status: { type: String, enum: ['sending', 'completed'], default: 'sending' },
  sentByEmail: { type: String, required: true, trim: true, lowercase: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

const EmailBroadcast = mongoose.model('EmailBroadcast', EmailBroadcastSchema);

export default EmailBroadcast;
