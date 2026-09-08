import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { sendDormantAccountReminderEmail } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// Admin-editable subject/message, shared across whichever channel(s) are
// selected — same MIN/MAX convention as SmsBroadcast (smsBroadcastController.js)
// so a custom message can never go out blank or absurdly long. Two merge
// tags, resolved per recipient just before send: {{business}} (falls back
// to "there") and {{days}} (falls back to "a while" for a merchant who's
// never been active at all, so daysDormant is null).
const MIN_LEN = 5;
const MAX_LEN = 918;
const DEFAULT_SUBJECT = 'We miss you at PayChain!';
const DEFAULT_MESSAGE = "Hi {{business}}, we miss you at PayChain! It's been {{days}} since we last saw you — sign in or take a payment anytime to keep your account active and earning. We're here if you need anything.";

function personalizeText(text, businessName, daysDormant) {
  const biz = (businessName || '').trim() || 'there';
  const days = Number.isFinite(daysDormant) ? `${daysDormant} day${daysDormant === 1 ? '' : 's'}` : 'a while';
  return String(text)
    .replace(/\{\{\s*business\s*\}\}/gi, biz)
    .replace(/\{\{\s*days\s*\}\}/gi, days);
}

// Escaped AFTER merge-tag substitution, not before — businessName is
// merchant-supplied data (untrusted for HTML), while the admin's own typed
// message is trusted the same way the Newsletter composer trusts its admin
// author. Escaping the fully-resolved string once covers both at once, the
// same order newsletterController.js's personalizeHtml uses.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function textToHtmlParagraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px; color:#4b5563; font-size:15px; line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Same activity tiers as adminController.js's own tierFor (the
// Active/Idle/Dormant badges already shown on the Merchants page) —
// lastActivityAt = max(lastLogin, last transaction, createdAt as a floor for
// a merchant who's never done either). Everyone NOT in the "active" bucket
// (idle AND dormant) is surfaced here — an admin reaching out to re-engage
// quiet merchants wants both "gone a bit quiet" and "long gone", not only
// the strictest tier, which is often empty. Deliberately independent of
// services/dormancyReminderService.js's stricter 60-day automated
// email-only cycle: that one is a one-shot, system-triggered notice per
// dormancy period; this is a manual, admin-discretionary outreach tool the
// admin can re-run any time across email AND SMS, so it never reads or
// writes Merchant.dormancyReminderSentAt/dormancyFinalWarningSentAt —
// running this never suppresses, and is never suppressed by, that system.
const ACTIVE_WITHIN_DAYS = 7;
const IDLE_WITHIN_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH = 10;

function tierFor(daysSinceActivity) {
  if (daysSinceActivity == null) return 'dormant';
  if (daysSinceActivity <= ACTIVE_WITHIN_DAYS) return 'active';
  if (daysSinceActivity <= IDLE_WITHIN_DAYS) return 'idle';
  return 'dormant';
}

async function computeDormantMerchants() {
  const merchants = await Merchant.find({ status: { $ne: 'locked' } })
    .select('email phone name businessName createdAt lastLogin')
    .lean();

  const lastTxnAgg = await Transaction.aggregate([
    { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
  ]);
  const lastTxnByMerchant = new Map(lastTxnAgg.map((r) => [String(r._id), r.lastTxnAt]));

  const now = Date.now();
  const results = [];
  for (const m of merchants) {
    const lastActivityMs = [m.lastLogin, lastTxnByMerchant.get(String(m._id)), m.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0);
    const daysDormant = lastActivityMs ? Math.floor((now - lastActivityMs) / MS_PER_DAY) : null;
    const tier = tierFor(daysDormant);

    if (tier !== 'active') {
      results.push({
        _id: m._id,
        email: m.email,
        phone: m.phone,
        name: m.name,
        businessName: m.businessName,
        lastActivityAt: lastActivityMs ? new Date(lastActivityMs) : null,
        daysDormant,
        tier,
      });
    }
  }
  results.sort((a, b) => (b.daysDormant ?? Infinity) - (a.daysDormant ?? Infinity));
  return results;
}

// @desc    List merchants who aren't "active" — idle (8-30 days since last
//          login/transaction) AND dormant (30+ days, or never active) —
//          the same tiers already shown on the Merchants page, surfaced
//          together as one targeted list for re-engagement outreach.
// @route   GET /api/admin/dormant-accounts
// @access  Private (Admin)
export const getDormantMerchants = async (req, res) => {
  try {
    const data = await computeDormantMerchants();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get Dormant Merchants Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a re-engagement reminder — email and/or SMS — to dormant
//          merchants, personalized per recipient with {{business}}/{{days}}
//          merge tags. Subject/message are admin-editable (defaults used
//          when omitted) — see DormantAccounts.jsx's Preview panel for how
//          the admin sees the resolved copy before sending. Re-verifies
//          every target is still actually idle/dormant server-side before
//          sending — the same "never trust a client-selected id blindly"
//          pattern used by sendSmsBroadcast/sendCampaign.
// @route   POST /api/admin/dormant-accounts/remind
// @access  Private (Admin — owner/admin only, see routes)
export const sendDormantReminders = async (req, res) => {
  try {
    const { audience, merchantIds, channels, subject, message } = req.body || {};
    const wantEmail = Array.isArray(channels) && channels.includes('email');
    const wantSms = Array.isArray(channels) && channels.includes('sms');
    if (!wantEmail && !wantSms) {
      return res.status(400).json({ error: 'Select at least one channel (email or SMS).' });
    }
    if (!['all', 'selected'].includes(audience)) {
      return res.status(400).json({ error: 'audience must be "all" or "selected".' });
    }
    if (audience === 'selected' && (!Array.isArray(merchantIds) || merchantIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one merchant.' });
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (trimmedMessage && trimmedMessage.length < MIN_LEN) {
      return res.status(400).json({ error: `Message is too short (min ${MIN_LEN} characters).` });
    }
    if (trimmedMessage.length > MAX_LEN) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_LEN} characters).` });
    }
    const finalSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim().slice(0, 200) : DEFAULT_SUBJECT;
    const finalMessage = trimmedMessage || DEFAULT_MESSAGE;

    const dormant = await computeDormantMerchants();
    const idSet = new Set((merchantIds || []).map(String));
    const targets = audience === 'selected'
      ? dormant.filter((m) => idSet.has(String(m._id)))
      : dormant;

    if (targets.length === 0) {
      return res.status(400).json({ error: 'None of the selected merchants are currently idle or dormant.' });
    }

    let emailSuccess = 0, emailFailure = 0, smsSuccess = 0, smsFailure = 0;

    for (let i = 0; i < targets.length; i += BATCH) {
      const slice = targets.slice(i, i + BATCH);
      await Promise.allSettled(slice.map(async (m) => {
        const personalizedPlain = personalizeText(finalMessage, m.businessName, m.daysDormant);
        if (wantEmail) {
          if (!m.email) {
            emailFailure++;
          } else {
            try {
              const personalizedSubject = personalizeText(finalSubject, m.businessName, m.daysDormant);
              await sendDormantAccountReminderEmail(m.email, personalizedSubject, textToHtmlParagraphs(personalizedPlain));
              emailSuccess++;
            } catch {
              emailFailure++;
            }
          }
        }
        if (wantSms) {
          if (!m.phone) {
            smsFailure++;
          } else {
            const result = await safeSendSMS({ to: m.phone, message: personalizedPlain });
            result.success ? smsSuccess++ : smsFailure++;
          }
        }
      }));
    }

    logAudit({
      action: 'admin.dormant_reminder.sent', category: 'admin', severity: 'info',
      message: `Sent dormant-account reminder to ${targets.length} merchant(s) via ${[wantEmail && 'email', wantSms && 'SMS'].filter(Boolean).join(' + ')}`,
      actor: adminActor(req.admin), req,
      metadata: { targetCount: targets.length, emailSuccess, emailFailure, smsSuccess, smsFailure, audience },
    });

    const parts = [];
    if (wantEmail) parts.push(`${emailSuccess}/${emailSuccess + emailFailure} emails`);
    if (wantSms) parts.push(`${smsSuccess}/${smsSuccess + smsFailure} SMS`);

    res.json({
      success: true,
      message: `Sent to ${targets.length} merchant${targets.length === 1 ? '' : 's'} — ${parts.join(', ')}.`,
      data: { targetCount: targets.length, emailSuccess, emailFailure, smsSuccess, smsFailure },
    });
  } catch (error) {
    console.error('Send Dormant Reminders Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
