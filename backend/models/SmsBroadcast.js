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
  sentByEmail: { type: String, required: true, trim: true, lowercase: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

const SmsBroadcast = mongoose.model('SmsBroadcast', SmsBroadcastSchema);

export default SmsBroadcast;
