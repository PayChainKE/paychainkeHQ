import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import NewsletterCampaign from '../models/NewsletterCampaign.js';
import { sendNewsletterConfirmation, sendNewsletterEmail } from '../utils/resend.js';

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
    const { subject, body, htmlMode } = req.body || {};
    if (!subject || String(subject).trim().length < 3) {
      return res.status(400).json({ error: 'Subject is required (min 3 chars).' });
    }
    if (!body || String(body).trim().length < 10) {
      return res.status(400).json({ error: 'Body is required (min 10 chars).' });
    }

    const subscribers = await Subscription.find({ active: true }).select('email').lean();
    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'No active subscribers to send to.' });
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
