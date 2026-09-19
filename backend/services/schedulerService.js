import BlogPost from '../models/BlogPost.js';
import { recoverStuckSends, sendDueScheduledDrafts } from './newsletterService.js';
import { runNewsletterDigest } from './newsletterDigestService.js';
import Automation from '../models/Automation.js';
import { AUTOMATIONS } from './automationRegistry.js';
import { claimSlot, claimSweep, recordRun } from './automationRuns.js';

// Publishes every blog post whose scheduledAt has arrived. Claimed one at a
// time with an atomic status flip (scheduled -> published), so overlapping
// ticks or two server instances can't publish a post twice. publishedAt is
// set to the scheduled time (not "now") so a post that went live a minute
// late still sorts where the admin intended.
export async function publishDueBlogPosts(now = new Date()) {
  let published = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const post = await BlogPost.findOneAndUpdate(
      { status: 'scheduled', scheduledAt: { $lte: now } },
      [{ $set: { status: 'published', publishedAt: '$scheduledAt' } }],
      { returnDocument: 'after', sort: { scheduledAt: 1 }, updatePipeline: true }
    );
    if (!post) break;
    published++;
    // Same "only one featured post" rule the manual publish path enforces.
    if (post.featured) {
      await BlogPost.updateMany({ _id: { $ne: post._id }, featured: true }, { $set: { featured: false } });
    }
  }
  return published;
}

// Runs every enabled interval ('sweep') and weekly-slot ('slot') automation
// that is due. Whoever wins the atomic claim in automationRuns.js does the
// run; the rest skip it. One failing automation never blocks the others.
export async function runDueAutomations(now = new Date()) {
  for (const [key, meta] of Object.entries(AUTOMATIONS)) {
    if (typeof meta.run !== 'function') continue;
    try {
      let auto;
      if (meta.kind === 'slot') {
        const row = await Automation.findOne({ key, enabled: true });
        if (!row) continue;
        const claim = await claimSlot(row, now);
        if (claim.state === 'not_due') continue;
        if (claim.state === 'missed') {
          await recordRun(key, 'skipped', 'Missed its scheduled time (the server was not running), so this week was skipped.');
          continue;
        }
        auto = claim.auto;
      } else {
        auto = await claimSweep(key, now, meta.everyMinutes * 60 * 1000);
        if (!auto) continue;
      }
      const result = await meta.run(auto, { now });
      await recordRun(key, result.status, result.summary);
    } catch (err) {
      console.error(`Automation "${key}" failed:`, err?.message || err);
      await recordRun(key, 'error', String(err?.message || 'Run failed.')).catch(() => {});
    }
  }
}

let running = false;

// The one entry point server.js calls once a minute. Every step is
// independently try/caught so one failing automation can never starve the
// others, and `running` stops a slow tick from overlapping the next one in
// this process (cross-instance safety comes from each step's atomic claim).
export async function runSchedulerTick() {
  if (running) return;
  running = true;
  try {
    const steps = [
      ['blog publish', publishDueBlogPosts],
      ['stuck send recovery', recoverStuckSends],
      ['scheduled newsletters', sendDueScheduledDrafts],
      ['newsletter digest', () => runNewsletterDigest()],
      ['automations', () => runDueAutomations()],
    ];
    for (const [name, fn] of steps) {
      try {
        await fn();
      } catch (err) {
        console.error(`Scheduler step "${name}" failed:`, err?.message || err);
      }
    }
  } finally {
    running = false;
  }
}
