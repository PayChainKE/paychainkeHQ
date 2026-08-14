import Merchant from '../models/Merchant.js';
import SmsBroadcast from '../models/SmsBroadcast.js';
import { sendSMS } from '../utils/sms.js';

const CATEGORIES = ['maintenance', 'holiday', 'security', 'general'];
// ~6 concatenated SMS segments (153 chars/part once concatenated) — a
// generous ceiling for what's meant to stay a short notification, not an
// admin accidentally pasting in a full newsletter body.
const MAX_LEN = 918;
const MIN_LEN = 5;

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

    // Same batching convention as newsletterController.sendCampaign — bound
    // concurrency rather than firing every send at once.
    let success = 0;
    let failure = 0;
    const BATCH = 10;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const slice = recipients.slice(i, i + BATCH);
      const results = await Promise.allSettled(slice.map((m) => sendSMS(m.phone, trimmed)));
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.success) success++;
        else failure++;
      });
    }

    const broadcast = await SmsBroadcast.create({
      message: trimmed,
      category: CATEGORIES.includes(category) ? category : 'general',
      audience,
      merchantIds: audience === 'selected' ? merchantIds : [],
      recipientCount: recipients.length,
      successCount: success,
      failureCount: failure,
      sentByEmail: req.admin?.email || 'unknown',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
    });

    res.json({
      success: true,
      message: `SMS sent to ${success} of ${recipients.length} merchant${recipients.length === 1 ? '' : 's'}${failure ? ` (${failure} failed)` : ''}.`,
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
