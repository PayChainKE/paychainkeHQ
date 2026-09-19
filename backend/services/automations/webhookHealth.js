import AutomationEvent from '../../models/AutomationEvent.js';
import Developer from '../../models/Developer.js';
import DeveloperWebhook from '../../models/DeveloperWebhook.js';
import WebhookDelivery from '../../models/WebhookDelivery.js';
import { notifyAdminsOfAutomation } from '../../utils/adminNotices.js';
import { sendMerchantLifecycleEmail } from '../../utils/resend.js';
import { claimEvent, hasEvent, markEventFailed } from '../automationEvents.js';
import { DAY, DEVELOPER_URL, HOUR, esc } from './common.js';

const KEY = 'webhook_health';
// Evidence older than this is stale: an endpoint that failed a while ago and
// has had no traffic since has not been shown to be STILL broken.
const STALE_AFTER_MS = 7 * DAY;

function warnEmail(w, info, disableHours) {
  return {
    subject: 'Your PayChain webhook endpoint is failing',
    heading: 'Your webhook endpoint has been failing',
    paragraphsHtml: `<p style="margin:0 0 14px;">PayChain has not been able to deliver events to your webhook endpoint for about <strong>${Math.floor(info.ageH)} hours</strong>:</p><p style="margin:0 0 14px;padding:12px 16px;background:#f4f7f5;border-radius:12px;word-break:break-all;"><strong>${esc(w.url)}</strong><br><span style="color:#6b7280;">${info.count} deliveries failed. Last error: ${esc(info.lastError || 'no response')}</span></p><p style="margin:0 0 14px;">If it is still failing after ${disableHours} hours, we will <strong>pause</strong> deliveries to this endpoint so it stops accumulating errors. You can switch it back on any time from your developer dashboard once it is fixed.</p><p style="margin:0;">Events that happen while an endpoint is paused are not re-sent, so check any missed payments with <code>GET /payments/:id</code>.</p>`,
    ctaLabel: 'Open developer dashboard', ctaUrl: DEVELOPER_URL,
  };
}

function disabledEmail(w) {
  return {
    subject: 'PayChain has paused your webhook endpoint',
    heading: 'We paused your webhook endpoint',
    paragraphsHtml: `<p style="margin:0 0 14px;">Because it kept failing, PayChain has <strong>paused</strong> deliveries to:</p><p style="margin:0 0 14px;padding:12px 16px;background:#f4f7f5;border-radius:12px;word-break:break-all;"><strong>${esc(w.url)}</strong></p><p style="margin:0 0 14px;">Once your endpoint is back up, switch it on again from your developer dashboard and use “Send test event” to confirm it responds with a 2xx status.</p><p style="margin:0;">Events that happened while it was failing or paused are not re-sent, so check for missed payments with <code>GET /payments/:id</code>.</p>`,
    ctaLabel: 'Open developer dashboard', ctaUrl: DEVELOPER_URL,
  };
}

// Finds active webhook endpoints whose recent deliveries keep failing, warns
// the developer once the failure has lasted warnHours, and pauses the
// endpoint after disableHours — but only if the warning went out at least
// (disableHours − warnHours) earlier, so a developer is never paused without
// fair notice, even when this is first switched on against an old failure.
export async function runWebhookHealth(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const warnHours = Number(cfg.warnHours) > 0 ? Number(cfg.warnHours) : 48;
  const disableHours = Number(cfg.disableHours) > warnHours ? Number(cfg.disableHours) : 72;
  const minFailures = Number(cfg.minFailures) > 0 ? Number(cfg.minFailures) : 3;
  const tally = { warned: 0, disabled: 0, failed: 0 };
  const disabledList = [];

  const webhooks = await DeveloperWebhook.find({ status: 'active' }).select('url developerId').lean();
  for (const w of webhooks) {
    const lastOk = await WebhookDelivery.findOne({ webhookId: w._id, status: 'success' }).sort({ updatedAt: -1 }).select('updatedAt').lean();
    const since = lastOk ? lastOk.updatedAt : new Date(0);
    const bad = await WebhookDelivery.find({
      webhookId: w._id, createdAt: { $gt: since }, attempts: { $gt: 0 }, status: { $in: ['pending', 'failed', 'exhausted'] },
    }).sort({ createdAt: 1 }).select('createdAt lastError lastResponseCode').lean();
    if (bad.length < minFailures) continue;
    const newest = bad[bad.length - 1];
    if (now.getTime() - newest.createdAt.getTime() > STALE_AFTER_MS) continue;

    const failingSince = bad[0].createdAt;
    const ageH = (now.getTime() - failingSince.getTime()) / HOUR;
    if (ageH < warnHours) continue;
    const info = { ageH, count: bad.length, lastError: newest.lastError || (newest.lastResponseCode ? `HTTP ${newest.lastResponseCode}` : '') };
    const episode = failingSince.toISOString().slice(0, 10);

    // A suspended/inactive developer isn't contacted or acted on — nothing is
    // claimed, so they're picked up normally if the account is reinstated.
    const dev = await Developer.findOne({ _id: w.developerId, status: 'active' }).select('email name').lean();
    if (!dev?.email) continue;
    const warnEvent = await AutomationEvent.findOne({ key: KEY, subjectId: String(w._id), stage: `warn:${episode}` }).lean();

    if (!warnEvent) {
      if (dryRun) { tally.warned++; continue; }
      if (!(await claimEvent(KEY, w._id, `warn:${episode}`))) continue;
      try { await sendMerchantLifecycleEmail(dev.email, warnEmail(w, info, disableHours)); tally.warned++; }
      catch (e) { tally.failed++; await markEventFailed(KEY, w._id, `warn:${episode}`, e?.message); }
      continue;
    }

    // Warned already — pause only once fair notice has elapsed.
    const noticeElapsed = now.getTime() - warnEvent.at.getTime() >= (disableHours - warnHours) * HOUR;
    if (ageH >= disableHours && noticeElapsed) {
      if (dryRun) { if (!(await hasEvent(KEY, w._id, `disable:${episode}`))) tally.disabled++; continue; }
      if (!(await claimEvent(KEY, w._id, `disable:${episode}`))) continue;
      const res = await DeveloperWebhook.updateOne({ _id: w._id, status: 'active' }, { $set: { status: 'disabled' } });
      if (!res.modifiedCount) continue;
      tally.disabled++;
      disabledList.push({ w, dev });
      if (dev?.email) sendMerchantLifecycleEmail(dev.email, disabledEmail(w)).catch((e) => console.error('Webhook paused email failed:', e?.message || e));
    }
  }

  if (disabledList.length) {
    notifyAdminsOfAutomation({
      subject: `${disabledList.length} developer webhook${disabledList.length === 1 ? '' : 's'} paused`,
      heading: `${disabledList.length} webhook endpoint${disabledList.length === 1 ? '' : 's'} paused after repeated failures`,
      detailsHtml: `<ul style="margin:0;padding-left:18px;">${disabledList.map(({ w, dev }) => `<li style="margin:0 0 4px;"><strong>${esc(dev?.name || 'Developer')}</strong> — ${esc(w.url)}</li>`).join('')}</ul>`,
      ctaLabel: 'Open Developers',
      ctaPath: '/developers',
    });
  }

  const summary = `${tally.warned} developer${tally.warned === 1 ? '' : 's'} warned, ${tally.disabled} endpoint${tally.disabled === 1 ? '' : 's'} paused.${tally.failed ? ` ${tally.failed} email(s) failed.` : ''}`;
  if (dryRun) return { status: 'ok', summary: `Would warn about ${tally.warned} endpoint${tally.warned === 1 ? '' : 's'} and pause ${tally.disabled}.`, counts: tally };
  return { status: tally.warned + tally.disabled === 0 ? 'skipped' : 'ok', summary: tally.warned + tally.disabled === 0 ? 'All webhook endpoints look healthy.' : summary, counts: tally };
}
