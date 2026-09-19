import mongoose from 'mongoose';

// An unsent newsletter. Starts life as a plain in-progress draft — lets an
// admin save a partially written campaign and come back to finish it later,
// instead of losing it the moment the compose modal is closed — and can also
// be:
//   'awaiting_approval' — prepared by an automation (the weekly digest) and
//                         waiting for an admin to review and send it
//   'scheduled'         — queued to go out at `scheduledFor`
//   'sending'           — claimed by the scheduler; a send is in flight
//   'failed'            — a scheduled send threw; `lastError` says why
// Deleted once its campaign actually sends (see newsletterService.js#deliverCampaign)
// — a sent campaign lives on in NewsletterCampaign instead.
export const DRAFT_STATES = ['draft', 'awaiting_approval', 'scheduled', 'sending', 'failed'];

// Who a campaign goes to. 'subscribers' = the public newsletter list;
// 'merchants' = approved merchant accounts, optionally narrowed by activity,
// business type and county (see newsletterService.js#resolveAudience).
export const AudienceSchema = new mongoose.Schema({
  source: { type: String, enum: ['subscribers', 'merchants'], default: 'subscribers' },
  activity: { type: String, enum: ['all', 'active', 'dormant'], default: 'all' },
  businessType: { type: String, trim: true, maxlength: 60, default: '' },
  county: { type: String, trim: true, maxlength: 60, default: '' },
}, { _id: false });

const NewsletterDraftSchema = new mongoose.Schema({
  subject: { type: String, default: '', trim: true, maxlength: 200 },
  body: { type: String, default: '', maxlength: 50000 }, // HTML from the rich text editor
  audience: { type: AudienceSchema, default: () => ({}) },
  state: { type: String, enum: DRAFT_STATES, default: 'draft', index: true },
  origin: { type: String, enum: ['manual', 'digest'], default: 'manual' },
  scheduledFor: { type: Date, default: null },
  sendingStartedAt: { type: Date, default: null },
  lastError: { type: String, default: '', maxlength: 500 },
  updatedByEmail: { type: String, trim: true, lowercase: true, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

NewsletterDraftSchema.index({ updatedAt: -1 });
NewsletterDraftSchema.index({ state: 1, scheduledFor: 1 });

const NewsletterDraft = mongoose.model('NewsletterDraft', NewsletterDraftSchema);

export default NewsletterDraft;
