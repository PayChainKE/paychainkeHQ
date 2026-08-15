import Merchant from '../models/Merchant.js';
import SmsBroadcast from '../models/SmsBroadcast.js';
import { sendSMS } from '../utils/sms.js';

const CATEGORIES = ['maintenance', 'holiday', 'security', 'general'];
// ~6 concatenated SMS segments (153 chars/part once concatenated) — a
// generous ceiling for what's meant to stay a short notification, not an
// admin accidentally pasting in a full newsletter body.
const MAX_LEN = 918;
const MIN_LEN = 5;

// Pacing and priority both live in utils/sms.js#sendSMS's own global send
// queue now — every broadcast recipient here is 'low' priority, so the
// queue paces them out on its own AND automatically pauses the broadcast
// the instant a real payment/OTP SMS needs to go out, resuming once that
// urgent traffic clears. Run in the background (not awaited by the
// request handler) so the admin's request doesn't hang for however long a
// large audience takes to drain.
async function sendBroadcastInBackground(broadcastId, recipients, trimmed) {
  const results = await Promise.all(
    recipients.map((r) => sendSMS(r.phone, trimmed, { priority: 'low' }).catch(() => ({ success: false })))
  );
  const success = results.filter((r) => r?.success).length;
  const failure = results.length - success;
  await SmsBroadcast.updateOne(
    { _id: broadcastId },
    { $set: { successCount: success, failureCount: failure, status: 'completed' } }
  );
}

// @desc    Send a short SMS notification to merchants — system maintenance
//          notices, public holiday greetings, security reminders, etc.
// @route   POST /api/admin/sms-broadcasts
// @access  Private (Admin — owner/admin only, see routes)
export const sendSmsBroadcast = async (req, res) => {
  try {
    const { message, audience, merchantIds, category } = req.body || {};
    const trimmed = String(message || '').trim();

    if (trimmed.length < MIN_LEN) {
      return res.status(400).json({ error: `Message is required (min ${MIN_LEN} characters).` });
    }
    if (trimmed.length > MAX_LEN) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_LEN} characters).` });
    }
    if (!['all', 'selected'].includes(audience)) {
      return res.status(400).json({ error: 'audience must be "all" or "selected".' });
    }
    if (audience === 'selected' && (!Array.isArray(merchantIds) || merchantIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one merchant.' });
    }

    const query = audience === 'selected' ? { _id: { $in: merchantIds } } : {};
    const merchants = await Merchant.find(query).select('phone').lean();
    const recipients = merchants.filter((m) => !!m.phone);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No merchants with a phone number on file matched.' });
    }

    const broadcast = await SmsBroadcast.create({
      message: trimmed,
      category: CATEGORIES.includes(category) ? category : 'general',
      audience,
      merchantIds: audience === 'selected' ? merchantIds : [],
      recipientCount: recipients.length,
      status: 'sending',
      sentByEmail: req.admin?.email || 'unknown',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
    });

    // Detached — never block this response on however long the staggered
    // send takes (same "webhook acks immediately, SMS dispatch happens
    // after" convention used everywhere else in this codebase).
    sendBroadcastInBackground(broadcast._id, recipients, trimmed).catch((err) => {
      console.error('SMS Broadcast background send failed:', err);
    });

    res.json({
      success: true,
      message: `Sending to ${recipients.length} merchant${recipients.length === 1 ? '' : 's'}…`,
      data: broadcast,
    });
  } catch (error) {
    console.error('Send SMS Broadcast Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Paginated history of past SMS broadcasts.
// @route   GET /api/admin/sms-broadcasts
// @access  Private (Admin)
export const getSmsBroadcasts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));

    const [total, rows] = await Promise.all([
      SmsBroadcast.countDocuments(),
      SmsBroadcast.find()
        .sort('-sentAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Get SMS Broadcasts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
