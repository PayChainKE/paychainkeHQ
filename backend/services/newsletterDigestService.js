import Automation from '../models/Automation.js';
import BlogPost from '../models/BlogPost.js';
import NewsletterDraft from '../models/NewsletterDraft.js';
import { mostRecentSlot } from '../utils/eatSchedule.js';
import { notifyAdminsOfAutomation } from '../utils/adminNotices.js';
import { getOrCreateAutomation } from './automationRegistry.js';
import { describeAudience, deliverCampaign, resolveAudience } from './newsletterService.js';

const KEY = 'newsletter_digest';
const SITE_URL = (process.env.MARKETING_SITE_URL || 'https://www.paychain.co.ke').replace(/\/+$/, '');
const MAX_POSTS = 6;
const FIRST_RUN_LOOKBACK_DAYS = 14;
// A slot the server slept through (deploy, outage) is only honoured this long
// after it was due — a "Tuesday 9am" digest arriving on Wednesday night would
// be stale and confusing. It is marked as missed instead, and its posts roll
// into the next slot's digest.
const MISSED_SLOT_GRACE_MS = 12 * 60 * 60 * 1000;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Exported for tests. `posts` are lean BlogPost docs, newest first.
export function buildDigest(posts) {
  const subject = posts.length === 1
    ? `New on PayChain: ${posts[0].title}`.slice(0, 200)
    : "What's new at PayChain";

  const cards = posts.map((p) => {
    const url = `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`;
    const image = p.image
      ? `<a href="${url}"><img src="${escapeHtml(p.image)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin:0 0 14px;"></a>`
      : '';
    return `
      <div style="margin:0 0 30px;padding:0 0 26px;border-bottom:1px solid #eef0ee;">
        ${image}
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#059669;">${escapeHtml(p.category)}</p>
        <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#06201B;"><a href="${url}" style="color:#06201B;text-decoration:none;">${escapeHtml(p.title)}</a></h2>
        ${p.excerpt ? `<p style="margin:0 0 12px;color:#4b5563;">${escapeHtml(p.excerpt)}</p>` : ''}
        <a href="${url}" style="color:#059669;font-weight:700;text-decoration:none;">Read more &rarr;</a>
      </div>`;
  }).join('');

  const html = `
    <p style="margin:0 0 14px;">Hi {{name}},</p>
    <p style="margin:0 0 26px;">${posts.length === 1 ? "Here's our latest update." : "Here's what's new at PayChain."}</p>
    ${cards}`;

  return { subject, html };
}

async function recordRun(status, summary, extra = {}) {
  await Automation.updateOne(
    { key: KEY },
    { $set: { lastRunAt: new Date(), lastRunStatus: status, lastRunSummary: String(summary).slice(0, 500), ...extra } }
  );
}

// One scheduler tick's worth of digest work. `force` is the admin's "generate
// a digest now" button: it skips the slot logic and the enabled switch, ALWAYS
// stops at a draft awaiting approval (never sends), and falls back to the
// latest posts when nothing is new so there is something to look at.
export async function runNewsletterDigest({ now = new Date(), force = false } = {}) {
  const auto = await getOrCreateAutomation(KEY);

  if (!force) {
    if (!auto.enabled) return { ran: false };
    const cfg = auto.config || {};
    const slot = mostRecentSlot(now, cfg.days, cfg.time);
    if (!slot) return { ran: false };
    if (auto.lastSlotAt && auto.lastSlotAt.getTime() >= slot.getTime()) return { ran: false };

    // Atomic claim: whichever instance/tick wins this update owns the slot.
    const claimed = await Automation.findOneAndUpdate(
      { key: KEY, $or: [{ lastSlotAt: null }, { lastSlotAt: { $lt: slot } }] },
      { $set: { lastSlotAt: slot } },
      { returnDocument: 'after' }
    );
    if (!claimed) return { ran: false };

    if (now.getTime() - slot.getTime() > MISSED_SLOT_GRACE_MS) {
      await recordRun('skipped', `Missed the ${slot.toISOString()} slot (server was not running). New posts roll into the next digest.`);
      return { ran: true, skipped: 'missed' };
    }
  }

  // Don't pile up drafts nobody has looked at.
  if (!force) {
    const pending = await NewsletterDraft.exists({ origin: 'digest', state: 'awaiting_approval' });
    if (pending) {
      await recordRun('skipped', 'The previous digest is still awaiting approval, so no new one was prepared.');
      return { ran: true, skipped: 'pending' };
    }
  }

  const since = auto.lastCoveredAt || new Date(now.getTime() - FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  let posts = await BlogPost.find({ status: 'published', publishedAt: { $gt: since, $lte: now } })
    .sort({ publishedAt: -1 })
    .limit(MAX_POSTS)
    .select('title slug excerpt category image publishedAt')
    .lean();

  if (posts.length === 0 && force) {
    posts = await BlogPost.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select('title slug excerpt category image publishedAt')
      .lean();
  }
  if (posts.length === 0) {
    await recordRun('skipped', force ? 'There are no published blog posts to build a digest from.' : 'No new blog posts since the last digest.');
    return { ran: true, skipped: 'no_posts' };
  }

  const { subject, html } = buildDigest(posts);
  const audience = (auto.config && auto.config.audience) || { source: 'subscribers' };
  const newestAt = posts[0].publishedAt;

  if (auto.autoSend && !force) {
    const recipients = await resolveAudience(audience);
    if (recipients.length === 0) {
      await recordRun('error', `The audience (${describeAudience(audience)}) is empty, so nothing was sent.`);
      notifyAdminsOfAutomation({
        subject: 'Newsletter digest could not be sent',
        heading: 'Digest not sent',
        detailsHtml: `<p style="margin:0;">The digest was ready but the audience <strong>${escapeHtml(describeAudience(audience))}</strong> has no recipients.</p>`,
        ctaLabel: 'Open Automations',
        ctaPath: '/automations',
      });
      return { ran: true, error: 'empty_audience' };
    }
    const campaign = await deliverCampaign({
      subject,
      htmlBody: html,
      recipients,
      origin: 'digest',
      audience,
      sentByEmail: 'automation:newsletter_digest',
    });
    await recordRun('ok', `Auto-sent "${subject}" to ${campaign.successCount} of ${campaign.recipientCount} (${describeAudience(audience)}).`, { lastCoveredAt: newestAt });
    return { ran: true, sent: campaign.recipientCount };
  }

  const draft = await NewsletterDraft.create({
    subject,
    body: html,
    audience,
    state: 'awaiting_approval',
    origin: 'digest',
    updatedByEmail: 'automation:newsletter_digest',
  });
  await recordRun('ok', `Prepared "${subject}" (${posts.length} post${posts.length === 1 ? '' : 's'}) — waiting for your approval.`, force ? {} : { lastCoveredAt: newestAt });
  if (!force) {
    notifyAdminsOfAutomation({
      subject: 'A newsletter digest is ready for approval',
      heading: 'Digest ready for review',
      detailsHtml: `<p style="margin:0 0 8px;"><strong>${escapeHtml(subject)}</strong></p><p style="margin:0;">Built from ${posts.length} new blog post${posts.length === 1 ? '' : 's'}, for ${escapeHtml(describeAudience(audience))}. It will not be sent until you approve it.</p>`,
      ctaLabel: 'Review & send',
      ctaPath: '/newsletter',
    });
  }
  return { ran: true, draftId: draft._id };
}
