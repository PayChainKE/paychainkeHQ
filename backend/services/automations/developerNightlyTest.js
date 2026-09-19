import AutomationEvent from '../../models/AutomationEvent.js';
import Developer from '../../models/Developer.js';
import { notifyAdminsOfAutomation } from '../../utils/adminNotices.js';
import { EAT_OFFSET_MS } from '../../utils/eatSchedule.js';
import { runIntegrationTestForDeveloper } from '../developerIntegrationTestService.js';
import { claimEvent, markEventFailed } from '../automationEvents.js';
import { DAY, esc } from './common.js';

const KEY = 'developer_nightly_test';
const MAX_DEVELOPERS = 50;
const CONCURRENCY = 3;

const dayKey = (d) => new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

// Nightly health check of every live-approved developer's integration, using
// the same simulated test-mode collect the live-access review already runs
// (zero real money). Webhook endpoints are deliberately NOT pinged — that
// would send every developer a test event nightly; real webhook health comes
// from the webhook-health automation. Admins are alerted only when a
// developer goes from passing to failing, not every night a failure persists.
export async function runDeveloperNightlyTest(auto, { now = new Date(), dryRun = false } = {}) {
  const developers = await Developer.find({
    status: 'active', 'liveAccess.approved': true, 'linkedMerchant.merchantId': { $ne: null },
  }).limit(MAX_DEVELOPERS);

  if (dryRun) return { status: 'ok', summary: `Would test ${developers.length} developer integration${developers.length === 1 ? '' : 's'} (simulated test-mode collect, no real money).`, counts: { developers: developers.length } };
  if (developers.length === 0) return { status: 'skipped', summary: 'No live-approved developers to test.' };

  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY));
  const results = [];

  for (let i = 0; i < developers.length; i += CONCURRENCY) {
    await Promise.all(developers.slice(i, i + CONCURRENCY).map(async (dev) => {
      // One test per developer per night, even if the run is repeated.
      if (!(await claimEvent(KEY, dev._id, `nightly:${today}`))) return;
      let passed = false; let message = '';
      try {
        const r = await runIntegrationTestForDeveloper(dev, { includeWebhooks: false });
        passed = !!r.collectTest?.passed;
        message = r.collectTest?.message || '';
      } catch (e) { message = e?.message || 'Test threw an error.'; }
      if (!passed) await markEventFailed(KEY, dev._id, `nightly:${today}`, message);
      results.push({ dev, passed, message });
    }));
  }

  const failed = results.filter((r) => !r.passed);
  const newlyFailing = [];
  for (const r of failed) {
    const prev = await AutomationEvent.findOne({ key: KEY, subjectId: String(r.dev._id), stage: `nightly:${yesterday}` }).lean();
    if (!prev || prev.outcome !== 'failed') newlyFailing.push(r);
  }
  if (newlyFailing.length) {
    notifyAdminsOfAutomation({
      subject: `${newlyFailing.length} developer integration${newlyFailing.length === 1 ? '' : 's'} failing the nightly test`,
      heading: `${newlyFailing.length} developer integration${newlyFailing.length === 1 ? ' is' : 's are'} failing`,
      detailsHtml: `<p style="margin:0 0 10px;">The simulated test-mode collect did not succeed for:</p><ul style="margin:0;padding-left:18px;">${newlyFailing.map(({ dev, message }) => `<li style="margin:0 0 6px;"><strong>${esc(dev.companyName || dev.name)}</strong> — ${esc(message)}</li>`).join('')}</ul>`,
      ctaLabel: 'Open Developers',
      ctaPath: '/developers',
    });
  }

  return {
    status: failed.length ? 'error' : 'ok',
    summary: `Tested ${results.length} integration${results.length === 1 ? '' : 's'}: ${results.length - failed.length} passed, ${failed.length} failed${newlyFailing.length ? ` (${newlyFailing.length} newly failing — admins alerted)` : ''}.`,
    counts: { tested: results.length, failed: failed.length },
  };
}
