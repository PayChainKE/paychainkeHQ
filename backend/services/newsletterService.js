import Subscription from '../models/Subscription.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import NewsletterCampaign from '../models/NewsletterCampaign.js';
import NewsletterDraft from '../models/NewsletterDraft.js';
import { sendNewsletterEmail } from '../utils/resend.js';
import { unsubscribeUrl } from '../utils/unsubscribeToken.js';

// A merchant counts as dormant after this many days without a login or a
// transaction — same threshold and same "last activity" definition as
// services/dormancyReminderService.js, so a "dormant merchants" segment here
// matches what the Dormant Accounts page and the reminder emails call dormant.
const DORMANCY_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NAME_TAG_RE = /\{\{\s*name\s*\}\}/gi;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// {{name}} merge tag — an admin writes "Hi {{name}}," once and every
// recipient gets their own name, falling back to "there". The subject is
// plain text (escaping would show a literal "&amp;" in the inbox); the body
// is real HTML.
export function personalizeSubject(subject, name) {
  return String(subject).replace(NAME_TAG_RE, (name || '').trim() || 'there');
}
export function personalizeHtml(html, name) {
  return String(html).replace(NAME_TAG_RE, escapeHtml((name || '').trim() || 'there'));
}

// Trim + clamp untrusted audience input from the admin UI down to the shape
// the schema allows. Anything unrecognised falls back to the safe default
// (all active newsletter subscribers).
export function sanitizeAudience(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const source = a.source === 'merchants' ? 'merchants' : 'subscribers';
  if (source === 'subscribers') return { source, activity: 'all', businessType: '', county: '' };
  return {
    source,
    activity: ['active', 'dormant'].includes(a.activity) ? a.activity : 'all',
    businessType: String(a.businessType || '').trim().slice(0, 60),
    county: String(a.county || '').trim().slice(0, 60),
  };
}

export function describeAudience(audience) {
  const a = sanitizeAudience(audience);
  if (a.source === 'subscribers') return 'Newsletter subscribers';
  const parts = ['Merchants'];
  if (a.activity !== 'all') parts.push(a.activity);
  if (a.businessType) parts.push(a.businessType);
  if (a.county) parts.push(a.county);
  return parts.join(' · ');
}

// Resolves an audience to a de-duplicated [{ email, name }] list. Merchants
// are limited to approved, unlocked accounts — an application still under
// review (or rejected) is not a customer yet and shouldn't get product mail.
export async function resolveAudience(audience) {
  const a = sanitizeAudience(audience);

  if (a.source === 'subscribers') {
    const subs = await Subscription.find({ active: true }).select('email name').lean();
    return dedupe(subs.map((s) => ({ email: s.email, name: s.name, kind: 's', id: String(s._id) })));
  }

  const query = {
    status: { $ne: 'locked' },
    newsletterOptOut: { $ne: true },
    email: { $exists: true, $ne: '' },
    $or: [{ kybStatus: { $exists: false } }, { kybStatus: 'approved' }],
  };
  if (a.businessType) query.businessType = a.businessType;
  if (a.county) query.county = a.county;

  const merchants = await Merchant.find(query)
    .select('email name businessName lastLogin createdAt')
    .lean();

  let kept = merchants;
  if (a.activity !== 'all' && merchants.length > 0) {
    const lastTxn = await Transaction.aggregate([
      { $match: { merchantId: { $in: merchants.map((m) => m._id) } } },
      { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
    ]);
    const lastTxnBy = new Map(lastTxn.map((r) => [String(r._id), r.lastTxnAt]));
    const cutoff = Date.now() - DORMANCY_DAYS * MS_PER_DAY;
    kept = merchants.filter((m) => {
      const last = [m.lastLogin, lastTxnBy.get(String(m._id)), m.createdAt]
        .filter(Boolean)
        .reduce((max, d) => Math.max(max, new Date(d).getTime()), 0);
      const dormant = last < cutoff;
      return a.activity === 'dormant' ? dormant : !dormant;
    });
  }

  return dedupe(kept.map((m) => ({ email: m.email, name: m.businessName || m.name, kind: 'm', id: String(m._id) })));
}

function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: r.name || '', kind: r.kind, id: r.id });
  }
  return out;
}

// Plain text → paragraphs; HTML passes through (it is our own admin editor).
export function toHtmlBody(body, htmlMode) {
  if (htmlMode) return String(body);
  return String(body)
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Sends to `recipients` in batches of 10 (Resend rate limits; one bad address
// can't sink the run) and records the campaign. Callers own the "is this
// allowed / has it already been claimed" logic — this only sends and records.
export async function deliverCampaign({ subject, htmlBody, rawBody, recipients, origin, audience, sentByEmail, sentBy }) {
  let success = 0;
  let failure = 0;
  const BATCH = 10;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const slice = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map((r) => sendNewsletterEmail(
        r.email,
        personalizeSubject(subject, r.name),
        personalizeHtml(htmlBody, r.name),
        r.kind && r.id ? {
          unsubscribeUrl: unsubscribeUrl(r.kind, r.id),
          reason: r.kind === 'm'
            ? "You're receiving this because you have a PayChain merchant account."
            : "You're receiving this because you subscribed to PayChain Updates.",
        } : {}
      ))
    );
    results.forEach((res) => { res.status === 'fulfilled' ? success++ : failure++; });
  }

  return NewsletterCampaign.create({
    subject: String(subject).trim(),
    body: String(rawBody ?? htmlBody),
    recipientCount: recipients.length,
    successCount: success,
    failureCount: failure,
    origin,
    audienceLabel: describeAudience(audience),
    sentByEmail: sentByEmail || 'unknown',
    sentBy: sentBy || null,
    sentAt: new Date(),
  });
}

// Scheduler entry point: claims every draft whose time has come (atomically,
// one at a time — the findOneAndUpdate is what stops a second instance or an
// overlapping tick from sending the same draft twice), sends it, then removes
// the draft. A failure parks the draft as 'failed' rather than retrying, so a
// send that partly went out is never blindly repeated to the same inboxes.
export async function sendDueScheduledDrafts(now = new Date()) {
  let sent = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const draft = await NewsletterDraft.findOneAndUpdate(
      { state: 'scheduled', scheduledFor: { $lte: now } },
      { $set: { state: 'sending', sendingStartedAt: new Date(), lastError: '' } },
      { returnDocument: 'after', sort: { scheduledFor: 1 } }
    );
    if (!draft) break;

    try {
      const recipients = await resolveAudience(draft.audience);
      if (recipients.length === 0) throw new Error('The audience is empty — nobody to send to.');
      await deliverCampaign({
        subject: draft.subject,
        htmlBody: toHtmlBody(draft.body, true),
        rawBody: draft.body,
        recipients,
        origin: draft.origin === 'digest' ? 'digest' : 'scheduled',
        audience: draft.audience,
        sentByEmail: draft.updatedByEmail || 'scheduler',
        sentBy: draft.updatedBy,
      });
      await NewsletterDraft.deleteOne({ _id: draft._id });
      sent++;
    } catch (err) {
      console.error(`Scheduled newsletter ${draft._id} failed:`, err?.message || err);
      await NewsletterDraft.updateOne(
        { _id: draft._id },
        { $set: { state: 'failed', lastError: String(err?.message || 'Send failed.').slice(0, 500) } }
      );
    }
  }
  return sent;
}

// A process that dies mid-send leaves its draft stuck in 'sending' forever.
// Park anything stuck for 30+ minutes as 'failed' with a note — never
// auto-resend, because part of the list may already have received it.
export async function recoverStuckSends(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const res = await NewsletterDraft.updateMany(
    { state: 'sending', sendingStartedAt: { $lt: cutoff } },
    { $set: { state: 'failed', lastError: 'Interrupted while sending. Check Campaign history before re-sending — some recipients may already have received it.' } }
  );
  return res.modifiedCount || 0;
}
