import mongoose from 'mongoose';

// One row per send. We don't store per-recipient delivery status (Resend
// owns that) — just the headline counts so admins can see what they sent
// and how many it reached.
const NewsletterCampaignSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 50000 },
  // Snapshot of recipient counts at send-time.
  recipientCount: { type: Number, required: true, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  sentByEmail: { type: String, required: true, trim: true, lowercase: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

const NewsletterCampaign = mongoose.model('NewsletterCampaign', NewsletterCampaignSchema);

export default NewsletterCampaign;
