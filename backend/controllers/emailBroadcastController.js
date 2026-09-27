import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import EmailBroadcast from '../models/EmailBroadcast.js';
import { sendMerchantLifecycleEmail } from '../utils/resend.js';
import { escapeHtml } from '../utils/securityAlerts.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

const CATEGORIES = ['maintenance', 'holiday', 'security', 'general', 'tips'];
const MAX_LEN = 5000;
const MIN_LEN = 5;

// Plain text typed by an admin → the paragraphsHtml sendMerchantLifecycleEmail
// expects. A blank line starts a new <p>; a single line break within one
// becomes <br> — mirrors how a merchant would actually type this into the
// textarea, no markdown/HTML authoring expected of them.
function toParagraphsHtml(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin: 0 0 16px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Same pacing rationale as smsBroadcastController.js's sendBroadcastInBackground
// — run in the background so the admin's request doesn't hang for however
// long a large audience takes, but email has no per-account rate limit to
// stagger against (unlike Africa's Talking for SMS), so a plain Promise.all
// is enough.
async function sendBroadcastInBackground(broadcastId, recipients, subject, heading, paragraphsHtml) {
  const results = await Promise.all(
    recipients.map((r) =>
      sendMerchantLifecycleEmail(r.email, { subject, heading, paragraphsHtml }).then(
        () => ({ success: true }),
        () => ({ success: false })
      )
    )
  );
  const success = results.filter((r) => r.success).length;
  const failure = results.length - success;
  await EmailBroadcast.updateOne(
    { _id: broadcastId },
    { $set: { successCount: success, failureCount: failure, status: 'completed' } }
  );
}

// @desc    Send an email notification to merchants — system maintenance
//          notices (e.g. a bank-rail outage), holiday greetings, security
//          reminders, etc. Mirrors sendSmsBroadcast exactly, just on the
//          email channel and with a subject line.
// @route   POST /api/admin/email-broadcasts
// @access  Private (Admin — owner/admin only, see routes)
export const sendEmailBroadcast = async (req, res) => {
  try {
    const { subject, message, audience, merchantIds, category } = req.body || {};
    const trimmedSubject = String(subject || '').trim();
    const trimmed = String(message || '').trim();

    if (!trimmedSubject) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
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

    // "All Merchants" deliberately excludes locked accounts and demo/pilot
    // accounts — a locked merchant can't act on a payout-outage notice
    // anyway, and a demo account was never a real business to notify. A
    // deleted merchant is never a concern here: deleteMerchant hard-removes
    // the document (see adminController.js), so it can never match this
    // query in the first place. An admin can still explicitly pick a
    // locked merchant via "Select Specific" if they have a real reason to
    // (e.g. explaining why the account is locked).
    const query = audience === 'selected'
      ? { _id: { $in: merchantIds } }
      : { status: { $ne: 'locked' }, isDemoMerchant: { $ne: true } };
    const merchants = await Merchant.find(query).select('email name businessName').lean();
    const recipients = merchants.filter((m) => !!m.email);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No merchants with an email address on file matched.' });
    }

    const broadcast = await EmailBroadcast.create({
      subject: trimmedSubject,
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

    const paragraphsHtml = toParagraphsHtml(trimmed);
    sendBroadcastInBackground(broadcast._id, recipients, trimmedSubject, trimmedSubject, paragraphsHtml).catch((err) => {
      console.error('Email Broadcast background send failed:', err);
    });

    logAudit({
      action: 'admin.email_broadcast.sent', category: 'admin', severity: 'info',
      message: `Sent email broadcast "${trimmedSubject}" to ${recipients.length} merchant(s)`,
      actor: adminActor(req.admin), req,
      metadata: { broadcastId: String(broadcast._id), audience, recipientCount: recipients.length },
    });

    res.json({
      success: true,
      message: `Sending to ${recipients.length} merchant${recipients.length === 1 ? '' : 's'}…`,
      data: broadcast,
    });
  } catch (error) {
    console.error('Send Email Broadcast Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Paginated history of past email broadcasts.
// @route   GET /api/admin/email-broadcasts
// @access  Private (Admin)
export const getEmailBroadcasts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));

    const [total, rows] = await Promise.all([
      EmailBroadcast.countDocuments(),
      EmailBroadcast.find()
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
    console.error('Get Email Broadcasts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete one email broadcast history entry. Doesn't un-send the
//          email (already delivered or not) — this only removes the record.
// @route   DELETE /api/admin/email-broadcasts/:id
// @access  Private (Admin — owner/admin only, see routes)
export const deleteEmailBroadcast = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const broadcast = await EmailBroadcast.findById(req.params.id);
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found.' });

    logAudit({
      action: 'admin.email_broadcast.deleted', category: 'admin', severity: 'info',
      message: `Deleted email broadcast history entry — "${broadcast.subject}" (sent to ${broadcast.recipientCount})`,
      actor: adminActor(req.admin), req,
      metadata: { broadcastId: String(broadcast._id) },
    });

    await EmailBroadcast.deleteOne({ _id: broadcast._id });
    res.json({ success: true, message: 'Broadcast removed.' });
  } catch (error) {
    console.error('Delete Email Broadcast Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Clear email broadcast history — either every record, or a
//          specific set of ids. Never un-sends anything already delivered.
// @route   POST /api/admin/email-broadcasts/clear
// @access  Private (Admin — owner/admin only, see routes)
export const clearEmailBroadcasts = async (req, res) => {
  try {
    const { ids } = req.body || {};
    const clearingAll = !Array.isArray(ids) || ids.length === 0;

    const filter = clearingAll ? {} : { _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) } };
    const result = await EmailBroadcast.deleteMany(filter);

    logAudit({
      action: 'admin.email_broadcast.cleared', category: 'admin', severity: 'warning',
      message: clearingAll
        ? `Cleared entire email broadcast history (${result.deletedCount} entries)`
        : `Deleted ${result.deletedCount} selected email broadcast history entries`,
      actor: adminActor(req.admin), req,
      metadata: { deletedCount: result.deletedCount, clearingAll },
    });

    res.json({ success: true, message: `Removed ${result.deletedCount} broadcast${result.deletedCount === 1 ? '' : 's'}.`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Clear Email Broadcasts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
