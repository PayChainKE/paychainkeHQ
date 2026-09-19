import ApiKey from '../../models/ApiKey.js';
import Developer from '../../models/Developer.js';
import { sendMerchantLifecycleEmail } from '../../utils/resend.js';
import { claimEvent, hasEvent, markEventFailed } from '../automationEvents.js';
import { DAY, DEVELOPER_URL, esc } from './common.js';

const KEY = 'api_key_hygiene';

// Nudges developers about API keys that are a risk or clutter: live keys that
// haven't been used in a long time, and keys that are simply old. It only
// EMAILS — it never revokes or replaces a key. Automatically rotating keys
// would silently break the developer's integration (a new key can only be
// shown once, and mailing secrets is not something we do), so the email tells
// them how to rotate safely themselves. Each key is flagged once per reason.
export async function runApiKeyHygiene(auto, { now = new Date(), dryRun = false } = {}) {
  const cfg = auto.config || {};
  const unusedDays = Number(cfg.unusedDays) > 0 ? Number(cfg.unusedDays) : 90;
  const liveMaxAgeDays = Number(cfg.liveMaxAgeDays) > 0 ? Number(cfg.liveMaxAgeDays) : 365;
  const testMaxAgeDays = Number(cfg.testMaxAgeDays) > 0 ? Number(cfg.testMaxAgeDays) : 180;
  const daysSince = (d) => (now.getTime() - new Date(d).getTime()) / DAY;

  const keys = await ApiKey.find({ status: 'active' }).select('developerId mode keyPrefix label createdAt lastUsedAt').lean();
  const byDeveloper = new Map();
  let flagged = 0;

  for (const k of keys) {
    const age = daysSince(k.createdAt);
    const idle = daysSince(k.lastUsedAt || k.createdAt);
    const reasons = [];
    if (k.mode === 'live' && idle >= unusedDays && age >= unusedDays) reasons.push({ stage: 'unused', text: `not used for ${Math.floor(idle)} days` });
    if (k.mode === 'live' && age >= liveMaxAgeDays) reasons.push({ stage: 'old', text: `created ${Math.floor(age)} days ago` });
    if (k.mode === 'test' && age >= testMaxAgeDays) reasons.push({ stage: 'old', text: `created ${Math.floor(age)} days ago` });

    for (const r of reasons) {
      const fresh = dryRun ? !(await hasEvent(KEY, k._id, r.stage)) : await claimEvent(KEY, k._id, r.stage);
      if (!fresh) continue;
      flagged++;
      const id = String(k.developerId);
      if (!byDeveloper.has(id)) byDeveloper.set(id, []);
      byDeveloper.get(id).push({ k, r });
    }
  }
  if (dryRun) return { status: 'ok', summary: `Would email ${byDeveloper.size} developer${byDeveloper.size === 1 ? '' : 's'} about ${flagged} key flag${flagged === 1 ? '' : 's'}.`, counts: { developers: byDeveloper.size, flagged } };
  if (flagged === 0) return { status: 'skipped', summary: 'No API keys need attention.' };

  let emailed = 0;
  const developers = await Developer.find({ _id: { $in: [...byDeveloper.keys()] }, status: 'active' }).select('email name').lean();
  for (const dev of developers) {
    const items = byDeveloper.get(String(dev._id));
    const list = items.map(({ k, r }) => `<li style="margin:0 0 6px;"><strong>${esc(k.keyPrefix)}…</strong>${k.label ? ` (${esc(k.label)})` : ''} — ${k.mode} key, ${r.text}</li>`).join('');
    try {
      await sendMerchantLifecycleEmail(dev.email, {
        subject: 'A quick API key check-up',
        heading: 'Some of your API keys need a look',
        paragraphsHtml: `<p style="margin:0 0 14px;">Hi ${esc(dev.name || 'there')},</p><p style="margin:0 0 10px;">These PayChain API keys on your account are worth reviewing:</p><ul style="margin:0 0 16px;padding-left:18px;">${list}</ul><p style="margin:0 0 10px;"><strong>Not used any more?</strong> Revoke it from your dashboard — a key nobody uses is only a risk.</p><p style="margin:0;"><strong>Old but still in use?</strong> Rotate it safely: create a new key, switch your integration over, confirm it works, then revoke the old one. Your existing keys keep working until you revoke them.</p>`,
        ctaLabel: 'Open developer dashboard', ctaUrl: DEVELOPER_URL,
      });
      emailed++;
    } catch (e) {
      for (const { k, r } of items) await markEventFailed(KEY, k._id, r.stage, e?.message);
    }
  }
  return { status: 'ok', summary: `Emailed ${emailed} developer${emailed === 1 ? '' : 's'} about ${flagged} key flag${flagged === 1 ? '' : 's'}.`, counts: { developers: emailed, flagged } };
}
