import mongoose from 'mongoose';

// An in-progress, unsent newsletter — lets an admin save a partially
// written campaign and come back to finish it later, instead of losing
// it the moment the compose modal is closed. Deleted once its campaign
// actually sends (see newsletterController.js#sendCampaign) — a sent
// campaign lives on in NewsletterCampaign instead.
const NewsletterDraftSchema = new mongoose.Schema({
  subject: { type: String, default: '', trim: true, maxlength: 200 },
  body: { type: String, default: '', maxlength: 50000 }, // HTML from the rich text editor
  updatedByEmail: { type: String, trim: true, lowercase: true, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

NewsletterDraftSchema.index({ updatedAt: -1 });

const NewsletterDraft = mongoose.model('NewsletterDraft', NewsletterDraftSchema);

export default NewsletterDraft;
