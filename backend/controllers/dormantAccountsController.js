import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { sendDormantAccountReminderEmail } from '../utils/resend.js';
import { buildDormantAccountReminderSms } from '../utils/accountSmsTemplates.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

// Same >30-days-since-last-activity threshold as adminController.js's own
// tierFor (the "Dormant" badge already shown on the Merchants page) —
// lastActivityAt = max(lastLogin, last transaction, createdAt as a floor for
// a merchant who's never done either). Deliberately independent of
// services/dormancyReminderService.js's stricter 60-day automated
// email-only cycle: that one is a one-shot, system-triggered notice per
// dormancy period; this is a manual, admin-discretionary outreach tool the
// admin can re-run any time across email AND SMS, so it never reads or
// writes Merchant.dormancyReminderSentAt/dormancyFinalWarningSentAt —
// running this never suppresses, and is never suppressed by, that system.
const DORMANT_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH = 10;

async function computeDormantMerchants() {
  const merchants = await Merchant.find({ status: { $ne: 'locked' } })
    .select('email phone name businessName createdAt lastLogin')
    .lean();

  const lastTxnAgg = await Transaction.aggregate([
    { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
  ]);
  const lastTxnByMerchant = new Map(lastTxnAgg.map((r) => [String(r._id), r.lastTxnAt]));

  const now = Date.now();
  const dormant = [];
  for (const m of merchants) {
    const lastActivityMs = [m.lastLogin, lastTxnByMerchant.get(String(m._id)), m.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0);
    const daysDormant = lastActivityMs ? Math.floor((now - lastActivityMs) / MS_PER_DAY) : null;

    if (!lastActivityMs || daysDormant >= DORMANT_AFTER_DAYS) {
      dormant.push({
        _id: m._id,
        email: m.email,
        phone: m.phone,
        name: m.name,
        businessName: m.businessName,
        lastActivityAt: lastActivityMs ? new Date(lastActivityMs) : null,
        daysDormant,
      });
    }
  }
  dormant.sort((a, b) => (b.daysDormant ?? Infinity) - (a.daysDormant ?? Infinity));
  return dormant;
}

// @desc    List merchants with no login/transaction activity in the last 30
//          days (or ever) — the same "Dormant" tier already shown on the
//          Merchants page, surfaced as its own targeted list for
//          re-engagement outreach.
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
//          merchants, personalized per recipient with their business name
//          (email also greets them by their own contact name). Re-verifies
//          every target is still actually dormant server-side before
//          sending — the same "never trust a client-selected id blindly"
//          pattern used by sendSmsBroadcast/sendCampaign.
// @route   POST /api/admin/dormant-accounts/remind
// @access  Private (Admin — owner/admin only, see routes)
export const sendDormantReminders = async (req, res) => {
  try {
    const { audience, merchantIds, channels } = req.body || {};
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

    const dormant = await computeDormantMerchants();
    const idSet = new Set((merchantIds || []).map(String));
    const targets = audience === 'selected'
      ? dormant.filter((m) => idSet.has(String(m._id)))
      : dormant;

    if (targets.length === 0) {
      return res.status(400).json({ error: 'None of the selected merchants are currently dormant.' });
    }

    let emailSuccess = 0, emailFailure = 0, smsSuccess = 0, smsFailure = 0;

    for (let i = 0; i < targets.length; i += BATCH) {
      const slice = targets.slice(i, i + BATCH);
      await Promise.allSettled(slice.map(async (m) => {
        if (wantEmail) {
          if (!m.email) {
            emailFailure++;
          } else {
            try {
              await sendDormantAccountReminderEmail(m.email, m.name, m.businessName, m.daysDormant);
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
            const { message } = buildDormantAccountReminderSms({ businessName: m.businessName });
            const result = await safeSendSMS({ to: m.phone, message });
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
      message: `Sent to ${targets.length} dormant merchant${targets.length === 1 ? '' : 's'} — ${parts.join(', ')}.`,
      data: { targetCount: targets.length, emailSuccess, emailFailure, smsSuccess, smsFailure },
    });
  } catch (error) {
    console.error('Send Dormant Reminders Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
