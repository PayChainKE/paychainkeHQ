import Merchant from '../../models/Merchant.js';
import { notifyAdminsOfAutomation } from '../../utils/adminNotices.js';
import { sendMerchantLifecycleEmail } from '../../utils/resend.js';
import { unsubscribeUrl } from '../../utils/unsubscribeToken.js';
import { claimEvent, hasEvent, markEventFailed } from '../automationEvents.js';
import { DAY, MAX_EMAIL_PER_RUN, MERCHANT_URL, esc, lastTransactionByMerchant } from './common.js';

const KEY = 'winback';
const LIST_LIMIT = 15;

function emailContent(stage, m) {
  const name = esc(m.businessName || m.name || 'there');
  if (stage === 'd14') {
    return {
      subject: 'Need a hand getting the most from PayChain?',
      heading: "We haven't seen you in a while",
      paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${name},</p><p style="margin:0;">It's been a couple of weeks since you last used PayChain. If you're not sure where to start, or something isn't working the way you expected, just reply to this email and our team will help you sort it out.</p>`,
      ctaLabel: 'Open PayChain', ctaUrl: `${MERCHANT_URL}/login`,
    };
  }
  return {
    subject: "We'd love to have you back on PayChain",
    heading: 'Is something getting in the way?',
    paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${name},</p><p style="margin:0;">You haven't used PayChain for about a month. If there's something we could do better — a feature you're missing, a problem you ran into — we genuinely want to hear it. Reply to this email and a real person will get back to you.</p>`,
    ctaLabel: 'Sign in', ctaUrl: `${MERCHANT_URL}/login`,
  };
}

// Escalating outreach as a merchant goes quiet: a friendly nudge at 14 days, a
// "what's in the way?" check-in at 30, and — at 60 days, when the dormancy
// final-warning email goes out — a flag to admins so an account manager can
// pick up the phone. No discounts or offers are promised: none exist to give.
// The 14/30-day emails stop short of day 53, where the existing dormancy
// reminders (services/dormancyReminderService.js) take over. Events are keyed
// on the merchant's last-activity date, so a merchant who comes back and goes
// quiet again is re-armed automatically.
export async function runWinback(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const tally = { d14: 0, d30: 0, flagged: 0, failed: 0, capped: 0 };

  const merchants = await Merchant.find({
    status: { $ne: 'locked' },
    email: { $exists: true, $ne: '' },
    $or: [{ kybStatus: { $exists: false } }, { kybStatus: 'approved' }],
  }).select('email name businessName lastLogin createdAt newsletterOptOut').lean();

  const lastTxn = await lastTransactionByMerchant(merchants.map((m) => m._id));
  const toFlag = [];
  let emailsThisRun = 0;

  for (const m of merchants) {
    const lastMs = [m.lastLogin, lastTxn.get(String(m._id)), m.createdAt]
      .filter(Boolean).reduce((max, d) => Math.max(max, new Date(d).getTime()), 0);
    if (!lastMs) continue;
    const idleDays = (now.getTime() - lastMs) / DAY;
    const lastKey = new Date(lastMs).toISOString().slice(0, 10);

    let stage = null;
    if (idleDays >= 14 && idleDays < 30 && cfg.d14 !== false) stage = 'd14';
    else if (idleDays >= 30 && idleDays < 53 && cfg.d30 !== false) stage = 'd30';

    if (stage && !m.newsletterOptOut) {
      const eventStage = `${stage}:${lastKey}`;
      if (emailsThisRun >= MAX_EMAIL_PER_RUN) tally.capped++;
      else if (dryRun) { if (!(await hasEvent(KEY, m._id, eventStage))) { tally[stage]++; emailsThisRun++; } }
      else if (await claimEvent(KEY, m._id, eventStage)) {
        emailsThisRun++;
        try {
          await sendMerchantLifecycleEmail(m.email, { ...emailContent(stage, m), unsubscribeUrl: unsubscribeUrl('m', m._id) });
          tally[stage]++;
        } catch (e) { tally.failed++; await markEventFailed(KEY, m._id, eventStage, e?.message); }
      }
    }

    if (idleDays >= (Number(cfg.flagDays) > 0 ? Number(cfg.flagDays) : 60) && cfg.flagAdmins !== false) {
      const eventStage = `flag:${lastKey}`;
      if (dryRun ? !(await hasEvent(KEY, m._id, eventStage)) : await claimEvent(KEY, m._id, eventStage)) {
        toFlag.push({ m, idleDays: Math.floor(idleDays) });
      }
    }
  }

  if (toFlag.length) {
    tally.flagged = toFlag.length;
    if (!dryRun) {
      toFlag.sort((a, b) => b.idleDays - a.idleDays);
      const rows = toFlag.slice(0, LIST_LIMIT).map(({ m, idleDays }) =>
        `<li style="margin:0 0 4px;"><strong>${esc(m.businessName || m.name || 'Unnamed')}</strong> — inactive ${idleDays} days</li>`).join('');
      notifyAdminsOfAutomation({
        subject: `${toFlag.length} merchant${toFlag.length === 1 ? '' : 's'} inactive 60+ days`,
        heading: `${toFlag.length} merchant${toFlag.length === 1 ? ' has' : 's have'} gone dormant`,
        detailsHtml: `<p style="margin:0 0 10px;">These merchants have had no login or transaction for 60+ days and may be worth a call from an account manager.</p><ul style="margin:0;padding-left:18px;">${rows}</ul>${toFlag.length > LIST_LIMIT ? `<p style="margin:8px 0 0;">…and ${toFlag.length - LIST_LIMIT} more.</p>` : ''}`,
        ctaLabel: 'Open Dormant Accounts',
        ctaPath: '/dormant-accounts',
      });
    }
  }

  const summary = `${tally.d14} 14-day and ${tally.d30} 30-day email${tally.d14 + tally.d30 === 1 ? '' : 's'}, ${tally.flagged} merchant${tally.flagged === 1 ? '' : 's'} flagged to admins.${tally.capped ? ` ${tally.capped} more next run.` : ''}${tally.failed ? ` ${tally.failed} failed.` : ''}`;
  return dryRun
    ? { status: 'ok', summary: `Would send ${summary}`, counts: tally }
    : { status: tally.failed && !(tally.d14 + tally.d30) ? 'error' : 'ok', summary: `Sent ${summary}`, counts: tally };
}
