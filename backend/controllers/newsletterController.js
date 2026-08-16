import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import NewsletterCampaign from '../models/NewsletterCampaign.js';
import NewsletterDraft from '../models/NewsletterDraft.js';
import { sendNewsletterConfirmation, sendNewsletterEmail } from '../utils/resend.js';
import { v2 as cloudinary } from 'cloudinary';

const EMAIL_RE = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

// ── Public ────────────────────────────────────────────────────────────

// @desc    Subscribe via the public landing page form.
// @route   POST /api/newsletter
// @access  Public
export const subscribe = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    const lower = String(email).trim().toLowerCase();
    let subscriber = await Subscription.findOne({ email: lower });
    if (subscriber) {
      if (!subscriber.active) {
        subscriber.active = true;
        await subscriber.save();
        return res.json({ message: 'Subscription reactivated!' });
      }
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    subscriber = await Subscription.create({ email: lower, source: 'public' });
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
    const { email } = req.body || {};
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

// @desc    Send a newsletter campaign to every active subscriber. Plain-text
//          body is auto-converted to <p> tags; HTML is passed through. Sends
//          in batches of 10 to stay under Resend's rate limits and so a
//          single bad address doesn't kill the whole run. Records the campaign.
// @route   POST /api/newsletter/send
// @access  Private (Admin)
export const sendCampaign = async (req, res) => {
  try {
    const { subject, body, htmlMode, draftId, recipientIds } = req.body || {};
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
    const query = hasSelection ? { _id: { $in: validRecipientIds }, active: true } : { active: true };
    const subscribers = await Subscription.find(query).select('email').lean();
    if (subscribers.length === 0) {
      return res.status(400).json({ error: hasSelection ? 'None of the selected subscribers are active.' : 'No active subscribers to send to.' });
    }

    // Plain text → paragraphs. HTML mode trusts the admin (it's our own UI).
    const htmlBody = htmlMode
      ? String(body)
      : String(body)
          .split(/\n\s*\n/)
          .map((p) => `<p style="margin:0 0 14px;">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
          .join('');

    let success = 0;
    let failure = 0;
    const BATCH = 10;
    for (let i = 0; i < subscribers.length; i += BATCH) {
      const slice = subscribers.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        slice.map((s) => sendNewsletterEmail(s.email, subject, htmlBody))
      );
      results.forEach((r) => { r.status === 'fulfilled' ? success++ : failure++; });
    }

    const campaign = await NewsletterCampaign.create({
      subject: String(subject).trim(),
      body: String(body),
      recipientCount: subscribers.length,
      successCount: success,
      failureCount: failure,
      sentByEmail: req.admin?.email || 'unknown',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
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
      message: `Campaign sent to ${success} of ${subscribers.length} subscribers${failure ? ` (${failure} failed)` : ''}.`,
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
      .select('subject updatedByEmail updatedAt createdAt body')
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
//          rather than piling up duplicates.
// @route   POST /api/newsletter/drafts
// @access  Private (Admin)
export const saveDraft = async (req, res) => {
  try {
    const { draftId, subject, body } = req.body || {};
    if (!String(subject || '').trim() && !String(body || '').trim()) {
      return res.status(400).json({ error: 'Nothing to save — write a subject or body first.' });
    }

    const fields = {
      subject: String(subject || '').trim(),
      body: String(body || ''),
      updatedByEmail: req.admin?.email || '',
      updatedBy: req.admin?._id || null,
    };

    let draft;
    if (draftId) {
      if (!mongoose.Types.ObjectId.isValid(draftId)) {
        return res.status(400).json({ error: 'Invalid draft id.' });
      }
      draft = await NewsletterDraft.findByIdAndUpdate(draftId, fields, { returnDocument: 'after', upsert: false });
      if (!draft) return res.status(404).json({ error: 'Draft not found.' });
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

// @desc    Delete a draft (discard).
// @route   DELETE /api/newsletter/drafts/:id
// @access  Private (Admin)
export const deleteDraft = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const result = await NewsletterDraft.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Draft not found.' });
    res.json({ success: true, message: 'Draft discarded.' });
  } catch (error) {
    console.error('Delete Draft Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
