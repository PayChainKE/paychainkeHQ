// One-off: extends expiresAt on every EXISTING AuditLog document to match
// the new, longer retention window in utils/auditLog.js's RETENTION_MS
// (14/21 days -> 1/2 years). Without this, already-written entries keep
// their OLD (short) expiresAt and still get silently deleted by MongoDB's
// TTL index on the original schedule — the code change alone only affects
// entries logged from now on.
//
// Safe to re-run: only ever pushes expiresAt later, never earlier, and
// skips anything whose expiresAt is already past the new target.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/extend-audit-log-retention.js
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';

await mongoose.connect(process.env.MONGO_URI);

const RETENTION_MS = {
  critical: 730 * 24 * 60 * 60 * 1000, // 2 years
  warning:  730 * 24 * 60 * 60 * 1000, // 2 years
  success:  365 * 24 * 60 * 60 * 1000, // 1 year
  info:     365 * 24 * 60 * 60 * 1000, // 1 year
};

const cursor = AuditLog.find({ expiresAt: { $ne: null } }).select('_id severity createdAt expiresAt').lean().cursor();

let scanned = 0;
let updated = 0;
const ops = [];

for await (const doc of cursor) {
  scanned += 1;
  const window = RETENTION_MS[doc.severity] ?? RETENTION_MS.info;
  const newExpiresAt = new Date(new Date(doc.createdAt).getTime() + window);
  if (newExpiresAt > new Date(doc.expiresAt)) {
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { expiresAt: newExpiresAt } },
      },
    });
    updated += 1;
  }
  if (ops.length >= 500) {
    await AuditLog.bulkWrite(ops.splice(0, ops.length));
  }
}
if (ops.length) await AuditLog.bulkWrite(ops);

console.log(`Scanned ${scanned} audit log entries, extended expiresAt on ${updated}.`);
await mongoose.disconnect();
