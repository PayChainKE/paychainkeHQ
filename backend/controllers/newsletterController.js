import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import NewsletterCampaign from '../models/NewsletterCampaign.js';
import NewsletterDraft from '../models/NewsletterDraft.js';
import Merchant from '../models/Merchant.js';
import { sendNewsletterConfirmation } from '../utils/resend.js';
import {
  deliverCampaign, resolveAudience, sanitizeAudience, toHtmlBody,
} from '../services/newsletterService.js';
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken.js';
import { v2 as cloudinary } from 'cloudinary';

// Linear-time shape check — see models/Merchant.js's identical field for
// why the old \w+([\.-]?\w+)*@... pattern was a catastrophic-backtracking
// DoS. Reachable here from the public, unauthenticated POST /newsletter/subscribe.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Escapes for interpolating a subscriber-supplied name into email HTML —
// this is public, unauthenticated input (the landing-page form), so it must
// never be trusted verbatim inside a <div>.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function cleanName(name) {
  return typeof name === 'string' ? name.trim().slice(0, 100) : '';
}

// ── Public ────────────────────────────────────────────────────────────

// @desc    Subscribe via the public landing page form.
// @route   POST /api/newsletter
// @access  Public
export const subscribe = async (req, res) => {
  const { email, name } = req.body;
  try {
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    const lower = String(email).trim().toLowerCase();
    let subscriber = await Subscription.findOne({ email: lower });
    if (subscriber) {
      if (!subscriber.active) {
        subscriber.active = true;
        if (!subscriber.name && name) subscriber.name = cleanName(name);
        await subscriber.save();
        return res.json({ message: 'Subscription reactivated!' });
      }
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    subscriber = await Subscription.create({ email: lower, source: 'public', name: cleanName(name) });
    sendNewsletterConfirmation(lower).catch((err) =>
      console.error('Newsletter confirmation email failed:', err)
    );
    res.status(201).json({ success: true, message: 'Successfully subscribed to newsletter' });
  } catch (error) {
    console.error('Newsletter Error:', error);
    if (error.code === 11000) return res.status(400).json({ error: 'Email already subscribed' });
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Unsubscribe ───────────────────────────────────────────────────────
// Two-step on purpose: opening the emailed link (GET) only shows a confirm
// button — mail scanners and link-preview bots open every link in a message,
// and unsubscribing on GET would silently opt people out just for receiving
// an email. The state change is the POST, which is also what mail clients'
// one-click List-Unsubscribe button sends (RFC 8058).

function unsubscribePageHtml({ title, body, action = null, token = '' }) {
  const form = action
    ? `<form method="POST" action="/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">${escapeHtml(action)}</button></form>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · PayChain</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937}
.card{max-width:440px;margin:24px;padding:36px 32px;background:#fff;border:1px solid #e5ece8;border-radius:20px;text-align:center;box-shadow:0 10px 32px rgba(6,32,27,.08)}
.brand{font-weight:800;letter-spacing:-.3px;color:#06201B;font-size:22px;margin:0 0 18px}h1{font-size:20px;margin:0 0 10px;color:#06201B}p{margin:0 0 20px;line-height:1.6;color:#4b5563;font-size:15px}
button{background:#06201B;color:#fff;border:0;border-radius:12px;padding:13px 26px;font-size:14px;font-weight:800;cursor:pointer}a{color:#059669}</style></head>
<body><div class="card"><p class="brand">PayChain</p><h1>${escapeHtml(title)}</h1><p>${body}</p>${form}</div></body></html>`;
}

function noStore(res) {
  // The server-wide CSP is default-src 'none' (this API normally only returns
  // JSON). These two pages are the one place it serves HTML, so they get their
  // own minimal policy: inline styles and a same-origin form post, nothing else.
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
}

// @desc    Confirm page for the unsubscribe link in newsletter emails.
// @route   GET /api/newsletter/unsubscribe?t=<token>
// @access  Public (signed token)
export const unsubscribePage = (req, res) => {
  noStore(res);
  const token = String(req.query.t || '');
  if (!verifyUnsubscribeToken(token)) {
    return res.status(400).send(unsubscribePageHtml({ title: 'Link not valid', body: 'This unsubscribe link is invalid or incomplete. Please use the link from the latest email, or contact <a href="mailto:support@paychain.co.ke">support@paychain.co.ke</a>.' }));
  }
  res.send(unsubscribePageHtml({ title: 'Unsubscribe from PayChain emails?', body: 'You will stop receiving PayChain newsletters and updates. Important account, payment and security emails are not affected.', action: 'Yes, unsubscribe me', token }));
};

// @desc    Perform the unsubscribe (form button, or a mail client's one-click).
// @route   POST /api/newsletter/unsubscribe?t=<token>
// @access  Public (signed token)
export const unsubscribeConfirm = async (req, res) => {
  noStore(res);
  const parsed = verifyUnsubscribeToken(String(req.query.t || ''));
  if (!parsed) {
    return res.status(400).send(unsubscribePageHtml({ title: 'Link not valid', body: 'This unsubscribe link is invalid or incomplete.' }));
  }
  try {
    // Idempotent: unsubscribing twice, or an already-removed record, is still a success from the reader's side.
    if (parsed.kind === 's') {
      await Subscription.updateOne({ _id: parsed.id }, { $set: { active: false } });
    } else {
      await Merchant.updateOne({ _id: parsed.id }, { $set: { newsletterOptOut: true, newsletterOptOutAt: new Date() } });
    }
    res.send(unsubscribePageHtml({
      title: "You're unsubscribed",
      body: parsed.kind === 'm'
        ? "You won't receive PayChain newsletters any more. Your account is unaffected, and payment and security emails will still reach you."
        : 'You have been removed from the PayChain newsletter. Changed your mind? You can subscribe again any time at <a href="https://www.paychain.co.ke">paychain.co.ke</a>.',
    }));
  } catch (error) {
    console.error('Unsubscribe Error:', error);
    res.status(500).send(unsubscribePageHtml({ title: 'Something went wrong', body: 'We could not process that just now. Please try again in a moment.' }));
  }
};

// ── Admin ─────────────────────────────────────────────────────────────

// @desc    Admin list of subscribers.
// @route   GET /api/newsletter
// @access  Private (Admin)
export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscription.find({})
      .sort({ createdAt: -1 })
      .populate('addedBy', 'email')
      .lean();
    res.json(subscribers);
  } catch (error) {
    console.error('Get Subscribers Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin manually adds a subscriber. Duplicates rejected. No
//          confirmation email sent — assumption is the admin already has
//          consent for this address (CRM import, in-person signup, etc).
// @route   POST /api/newsletter/admin
// @access  Private (Admin)
export const adminAddSubscriber = async (req, res) => {
  try {
    const { email, name } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    const lower = String(email).trim().toLowerCase();
    const existing = await Subscription.findOne({ email: lower });
    if (existing) {
      return res.status(409).json({ error: 'This email is already subscribed.' });
    }
    const subscriber = await Subscription.create({
      email: lower,
      name: cleanName(name),
      source: 'admin',
      addedBy: req.admin?._id || null,
      active: true,
    });
    res.status(201).json({ success: true, data: subscriber });
  } catch (error) {
    console.error('Admin Add Subscriber Error:', error);
    if (error.code === 11000) return res.status(409).json({ error: 'This email is already subscribed.' });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle a subscriber active/inactive (lets admin pause a recipient
//          without losing the record).
// @route   PATCH /api/newsletter/:id/toggle
// @access  Private (Admin)
export const toggleSubscriber = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscriber not found.' });
    sub.active = !sub.active;
    await sub.save();
    res.json({ success: true, data: sub });
  } catch (error) {
    console.error('Toggle Subscriber Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Permanently delete a subscriber.
// @route   DELETE /api/newsletter/:id
// @access  Private (Admin)
export const deleteSubscriber = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const result = await Subscription.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Subscriber not found.' });
    res.json({ success: true, message: 'Subscriber removed.' });
  } catch (error) {
    console.error('Delete Subscriber Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a newsletter campaign now. Goes to the selected subscriber
//          rows if `recipientIds` is given, otherwise to the chosen `audience`
//          (default: every active subscriber; can instead target approved
//          merchants by activity / business type / county). Plain-text bodies
//          are auto-converted to <p> tags; HTML is passed through. Records the
//          campaign. Scheduling a send for later goes through the drafts
//          endpoints instead (see saveDraft).
// @route   POST /api/newsletter/send
// @access  Private (Admin)
export const sendCampaign = async (req, res) => {
  try {
    const { subject, body, htmlMode, draftId, recipientIds, audience } = req.body || {};
    if (!subject || String(subject).trim().length < 3) {
      return res.status(400).json({ error: 'Subject is required (min 3 chars).' });
    }
    if (!body || String(body).trim().length < 10) {
      return res.status(400).json({ error: 'Body is required (min 10 chars).' });
    }

    // Optional targeting — when the admin has selected specific rows in the
    // subscribers table, send only to those. Always re-filtered to
    // active:true here regardless of what was selected client-side, so a
    // stale/inactive id in the selection can never actually get emailed.
    const validRecipientIds = Array.isArray(recipientIds)
      ? recipientIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    const hasSelection = validRecipientIds.length > 0;
    let recipients;
    if (hasSelection) {
      const subs = await Subscription.find({ _id: { $in: validRecipientIds }, active: true }).select('email name').lean();
      recipients = subs.map((s) => ({ email: s.email, name: s.name, kind: 's', id: String(s._id) }));
    } else {
      recipients = await resolveAudience(audience);
    }
    if (recipients.length === 0) {
      return res.status(400).json({ error: hasSelection ? 'None of the selected subscribers are active.' : 'Nobody matches that audience.' });
    }

    // A draft that is already queued/being sent by the scheduler must not
    // also be sent by hand — that would email the list twice.
    if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {
      const claimed = await NewsletterDraft.findOneAndUpdate(
        { _id: draftId, state: { $ne: 'sending' } },
        { $set: { state: 'sending', sendingStartedAt: new Date() } }
      );
      if (!claimed) {
        return res.status(409).json({ error: 'This draft is already being sent.' });
      }
    }

    const campaign = await deliverCampaign({
      subject,
      htmlBody: toHtmlBody(body, htmlMode),
      rawBody: String(body),
      recipients,
      origin: 'manual',
      audience: hasSelection ? { source: 'subscribers' } : audience,
      sentByEmail: req.admin?.email || 'unknown',
      sentBy: req.admin?._id || null,
    }).catch(async (err) => {
      // Release the claim so the admin can retry from the same draft.
      if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {
        await NewsletterDraft.updateOne({ _id: draftId, state: 'sending' }, { $set: { state: 'draft', sendingStartedAt: null } }).catch(() => {});
      }
      throw err;
    });

    // The draft this campaign was composed from (if any) is now sent —
    // remove it so it doesn't linger in the drafts list as if still unsent.
    // Best-effort: a failure here must never affect the already-successful
    // send response.
    if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {
      NewsletterDraft.deleteOne({ _id: draftId }).catch((e) =>
        console.error('Failed to clean up draft after send:', e.message)
      );
    }

    res.json({
      success: true,
      message: `Campaign sent to ${campaign.successCount} of ${campaign.recipientCount} recipients${campaign.failureCount ? ` (${campaign.failureCount} failed)` : ''}.`,
      data: campaign,
    });
  } catch (error) {
    console.error('Send Campaign Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload an image for use inside a newsletter campaign.
//          The file is resized (max 800 px wide) and converted to WebP/JPEG by
//          Cloudinary before storage — only the resulting URL is kept.  No raw
//          binary data is persisted in MongoDB.
// @route   POST /api/newsletter/upload-image
// @access  Private (Admin)
export const uploadNewsletterImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // SVG deliberately excluded here (mirrors routes/newsletterRoutes.js's
    // multer fileFilter) — it can carry inline <script>/onload payloads and
    // isn't guaranteed to be rasterized by the transformation below if the
    // Cloudinary URL is ever opened directly rather than rendered as <img>.
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type. Use JPG, PNG, GIF or WebP.' });
    }

    // Upload to Cloudinary via a stream from the in-memory buffer.
    // Transformations applied server-side so we never store the full-size original:
    //   • max 800 px wide (limit — never upscale)
    //   • auto quality (Cloudinary picks the best quality/size trade-off)
    //   • fetch_format: auto → serves WebP to modern browsers, JPEG as fallback
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'paychain_newsletter_images',
          transformation: [
            { width: 800, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          resource_type: 'image',
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    console.log(`📸 Newsletter image uploaded: ${result.public_id} (${Math.round(result.bytes / 1024)} KB)`);

    res.json({
      success: true,
      url: result.secure_url,       // HTTPS Cloudinary URL — this is all that goes into the email HTML
      width: result.width,
      height: result.height,
      sizeKb: Math.round(result.bytes / 1024),
      format: result.format,
    });
  } catch (error) {
    console.error('Newsletter image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image. Try again.' });
  }
};

// @desc    List previously sent campaigns (most recent first).
// @route   GET /api/newsletter/campaigns
// @access  Private (Admin)
export const getCampaigns = async (req, res) => {
  try {
    const list = await NewsletterCampaign.find({})
      .sort({ sentAt: -1 })
      .limit(50)
      .populate('sentBy', 'email')
      .lean();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get Campaigns Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Drafts ────────────────────────────────────────────────────────────
// Any admin can see and continue any draft — this is a small internal
// team tool, not a multi-tenant workspace, so drafts aren't scoped to
// the admin who started them.

// @desc    List saved newsletter drafts (most recently edited first).
//          `body` is omitted here — the list view only needs a preview
//          snippet, not the full HTML, which can be large.
// @route   GET /api/newsletter/drafts
// @access  Private (Admin)
export const listDrafts = async (req, res) => {
  try {
    const drafts = await NewsletterDraft.find({})
      .sort({ updatedAt: -1 })
      .select('subject updatedByEmail updatedAt createdAt body state origin scheduledFor lastError audience')
      .lean();
    const withSnippet = drafts.map(({ body, ...d }) => ({
      ...d,
      snippet: String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140),
    }));
    res.json({ success: true, data: withSnippet });
  } catch (error) {
    console.error('List Drafts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Fetch one draft's full content, to load back into the composer.
// @route   GET /api/newsletter/drafts/:id
// @access  Private (Admin)
export const getDraft = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const draft = await NewsletterDraft.findById(req.params.id).lean();
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Get Draft Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Save a draft — creates a new one, or updates an existing one
//          when `draftId` is provided (upsert-by-id, not by content), so
//          repeated "Save Draft" clicks on the same email update in place
//          rather than piling up duplicates. Also carries the audience and,
//          if `scheduledFor` is a future time, queues the draft to be sent by
//          the scheduler at that time (state 'scheduled'). A null/omitted
//          `scheduledFor` on save returns it to a plain draft.
// @route   POST /api/newsletter/drafts
// @access  Private (Admin)
export const saveDraft = async (req, res) => {
  try {
    const { draftId, subject, body, audience, scheduledFor } = req.body || {};
    if (!String(subject || '').trim() && !String(body || '').trim()) {
      return res.status(400).json({ error: 'Nothing to save — write a subject or body first.' });
    }

    const fields = {
      subject: String(subject || '').trim(),
      body: String(body || ''),
      audience: sanitizeAudience(audience),
      updatedByEmail: req.admin?.email || '',
      updatedBy: req.admin?._id || null,
    };

    if (scheduledFor) {
      const at = new Date(scheduledFor);
      if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'Invalid schedule time.' });
      if (at.getTime() <= Date.now()) return res.status(400).json({ error: 'The send time must be in the future.' });
      if (fields.subject.length < 3) return res.status(400).json({ error: 'A scheduled newsletter needs a subject (min 3 chars).' });
      if (fields.body.replace(/<[^>]+>/g, '').trim().length < 10) return res.status(400).json({ error: 'A scheduled newsletter needs a body (min 10 chars).' });
      fields.state = 'scheduled';
      fields.scheduledFor = at;
      fields.lastError = '';
    } else {
      fields.state = 'draft';
      fields.scheduledFor = null;
      fields.lastError = '';
    }

    let draft;
    if (draftId) {
      if (!mongoose.Types.ObjectId.isValid(draftId)) {
        return res.status(400).json({ error: 'Invalid draft id.' });
      }
      // A draft the scheduler is sending right now can't be edited under it.
      draft = await NewsletterDraft.findOneAndUpdate(
        { _id: draftId, state: { $ne: 'sending' } },
        fields,
        { returnDocument: 'after', upsert: false }
      );
      if (!draft) {
        const exists = await NewsletterDraft.exists({ _id: draftId });
        return exists
          ? res.status(409).json({ error: 'This draft is being sent right now and can no longer be edited.' })
          : res.status(404).json({ error: 'Draft not found.' });
      }
    } else {
      draft = await NewsletterDraft.create(fields);
    }

    res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Save Draft Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Take a scheduled / failed draft out of the send queue and return it
//          to a plain draft (it is kept, not deleted). Refuses if the send has
//          already started.
// @route   POST /api/newsletter/drafts/:id/unschedule
// @access  Private (Admin)
export const unscheduleDraft = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const draft = await NewsletterDraft.findOneAndUpdate(
      { _id: req.params.id, state: { $in: ['scheduled', 'failed'] } },
      { $set: { state: 'draft', scheduledFor: null, lastError: '' } },
      { returnDocument: 'after' }
    );
    if (!draft) return res.status(409).json({ error: 'That draft is not scheduled (it may already be sending).' });
    res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Unschedule Draft Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    How many recipients an audience resolves to — powers the live
//          "Sends N emails" count in the composer and the Automations page.
// @route   POST /api/newsletter/audience-count
// @access  Private (Admin)
export const audienceCount = async (req, res) => {
  try {
    const recipients = await resolveAudience(req.body?.audience);
    res.json({ success: true, count: recipients.length });
  } catch (error) {
    console.error('Audience Count Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    The business types and counties that actually exist on merchant
//          records, for the audience pickers.
// @route   GET /api/newsletter/audience-options
// @access  Private (Admin)
export const audienceOptions = async (req, res) => {
  try {
    const [businessTypes, counties] = await Promise.all([
      Merchant.distinct('businessType', { businessType: { $nin: [null, ''] } }),
      Merchant.distinct('county', { county: { $nin: [null, ''] } }),
    ]);
    res.json({ success: true, businessTypes: businessTypes.sort(), counties: counties.sort() });
  } catch (error) {
    console.error('Audience Options Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete a draft (discard).
// @route   DELETE /api/newsletter/drafts/:id
// @access  Private (Admin)
export const deleteDraft = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const result = await NewsletterDraft.deleteOne({ _id: req.params.id, state: { $ne: 'sending' } });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Draft not found, or it is being sent right now.' });
    res.json({ success: true, message: 'Draft discarded.' });
  } catch (error) {
    console.error('Delete Draft Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
