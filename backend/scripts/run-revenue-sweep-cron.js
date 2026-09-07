// Entry point for a Render Cron Job — replaces the old in-process
// setInterval(fn, 24h) in server.js, which only ever checked in at whatever
// time-of-day the web service last happened to boot (a deploy, a crash, a
// Render restart), not a fixed clock time. That meant "Monday morning" was
// never actually guaranteed; some weeks the check could land at 4pm, or
// drift past Monday entirely if the process restarted mid-week and
// re-anchored its 24h timer to the new boot time.
//
// This script is meant to be invoked directly by a Render Cron Job on a
// fixed schedule (e.g. "0 4 * * 1" = 04:00 UTC Monday = 07:00 EAT Monday),
// completely independent of the main backend web service's own uptime.
// It still calls the same day-gated, dedup-guarded runWeeklyRevenueSweepIfDue
// (not runRevenueSweep directly) as a defensive second check — harmless if
// the cron's own schedule is ever off by a day or fires more than once.
//
// Run manually for testing: node backend/scripts/run-revenue-sweep-cron.js
import connectDB, { disconnectDB } from '../config/database.js';
import { runWeeklyRevenueSweepIfDue } from '../services/revenueSweepService.js';

async function main() {
  await connectDB();
  try {
    await runWeeklyRevenueSweepIfDue();
    console.log('Revenue sweep check complete.');
  } finally {
    await disconnectDB();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Revenue sweep cron failed:', err);
    process.exit(1);
  });
