// Measures real SMS delivery latency (sentAt -> deliveredAt, from Africa's
// Talking's own delivery-report webhook — see smsController.js) over the
// last N hours, so "SMS feels slow" can be checked against real numbers
// instead of guessed at. Read-only, writes nothing.
//
// Context: utils/sms.js enforces a flat 2-second minimum gap between ANY
// two sends app-wide (SMS_MIN_SEND_GAP_MS) — a deliberate, confirmed-safe
// throttle that exists BECAUSE sending two SMS too close together was
// observed (2026-08-04) getting the second one queued by Africa's Talking
// for MINUTES, not seconds (a per-account send-rate limit on their side).
// So a couple of seconds of queue delay per message is the fix working as
// intended, not a bug — what this script checks for is whether real
// end-to-end delivery is still taking much longer than that, which would
// point at either a growing queue backlog (many sends piling up) or
// Africa's Talking's own carrier-side delivery latency, neither of which
// the 2-second gate controls.
//
// Run it where the real MONGO_URI is set (e.g. the Render shell):
//   node backend/scripts/diagnose-sms-latency.js [hours=24]
import dotenv from 'dotenv';
dotenv.config();

const hours = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 24;
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');

const { default: mongoose } = await import('mongoose');
const { default: SmsLog } = await import('../models/SmsLog.js');

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';
console.log(`\nConnected to ${dbHost} — SMS sent in the last ${hours}h\n`);

const since = new Date(Date.now() - hours * 60 * 60 * 1000);
const logs = await SmsLog.find({ sentAt: { $gte: since } }).sort('sentAt').select('to sentAt deliveredAt deliveryStatus failureReason atStatus');

if (logs.length === 0) {
  console.log('No SMS sent in this window.\n');
  process.exit(0);
}

console.log(`${logs.length} SMS sent.\n`);

const withDelivery = logs.filter((l) => l.deliveredAt);
const delays = withDelivery.map((l) => (l.deliveredAt.getTime() - l.sentAt.getTime()) / 1000);

if (delays.length) {
  delays.sort((a, b) => a - b);
  const sum = delays.reduce((s, d) => s + d, 0);
  console.log('Delivery latency (sentAt -> deliveredAt), confirmed delivered only:');
  console.log(`  count:  ${delays.length} of ${logs.length} (${logs.length - delays.length} have no delivery confirmation yet/at all)`);
  console.log(`  median: ${delays[Math.floor(delays.length / 2)].toFixed(1)}s`);
  console.log(`  p90:    ${delays[Math.floor(delays.length * 0.9)].toFixed(1)}s`);
  console.log(`  max:    ${delays[delays.length - 1].toFixed(1)}s`);
  console.log(`  mean:   ${(sum / delays.length).toFixed(1)}s`);
} else {
  console.log('None of these have a deliveredAt timestamp — either delivery reports aren\'t arriving, or every one of these is still "queued"/failed.');
}

const statusCounts = {};
for (const l of logs) statusCounts[l.deliveryStatus] = (statusCounts[l.deliveryStatus] || 0) + 1;
console.log('\nStatus breakdown:', JSON.stringify(statusCounts));

// Anything over 60s is worth looking at individually — print the 10 worst.
const slow = withDelivery
  .map((l) => ({ to: l.to, sentAt: l.sentAt, delaySec: (l.deliveredAt.getTime() - l.sentAt.getTime()) / 1000 }))
  .filter((l) => l.delaySec > 60)
  .sort((a, b) => b.delaySec - a.delaySec)
  .slice(0, 10);
if (slow.length) {
  console.log(`\n${slow.length} message(s) took over 60s to deliver — worst first:`);
  slow.forEach((l) => console.log(`  ${l.sentAt.toISOString()} · to ${l.to} · ${l.delaySec.toFixed(0)}s`));
}

process.exit(0);
