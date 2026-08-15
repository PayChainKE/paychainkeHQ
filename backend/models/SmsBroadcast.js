import mongoose from 'mongoose';

// One row per admin-initiated SMS blast (system maintenance notices, public
// holiday greetings, security reminders, etc.) — mirrors NewsletterCampaign's
// "one row per send, headline counts only" shape. Per-recipient delivery
// detail already lives in SmsLog (see utils/sms.js); this is just what was
// sent, to whom, and how many of those sends succeeded.
const SmsBroadcastSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true, maxlength: 918 },
  category: {
    type: String,
    enum: ['maintenance', 'holiday', 'security', 'general'],
    default: 'general',
  },
  audience: { type: String, enum: ['all', 'selected'], required: true },
  // Only populated when audience === 'selected' — the merchants targeted.
  merchantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' }],
  // Snapshot of recipient counts at send-time.
  recipientCount: { type: Number, required: true, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  // Sends are staggered in the background (see sendSmsBroadcast) rather than
  // fired all at once, to avoid tripping Africa's Talking's per-account send
  // rate limit — the same throttle documented in
  // utils/smsSanitizer.js#sendStaggeredSms, which delays queued messages by
  // minutes when several fire back-to-back. successCount/failureCount stay
  // at 0 until every send finishes.
  status: { type: String, enum: ['sending', 'completed'], default: 'sending' },
  sentByEmail: { type: String, required: true, trim: true, lowercase: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

const SmsBroadcast = mongoose.model('SmsBroadcast', SmsBroadcastSchema);

export default SmsBroadcast;
