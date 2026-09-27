// One-off migration: DeletedRecord.js's TTL index used to apply to every
// collectionName uniformly (90-day auto-purge). It now excludes
// collectionName: 'Merchant' (partialFilterExpression) so a deleted
// merchant's snapshot survives forever — see Merchants.jsx's "Deleted"
// filter and the "all merchants that ever existed" KPI on the Merchants
// page.
//
// config/database.js's ensureModelIndexes() only ever creates indexes that
// are missing — a same-name index with different options is logged and
// skipped, never dropped/replaced. So the old prod index has to be dropped
// by hand once before the app can build the new partial one on its next
// boot (or this script builds it immediately, no restart needed).
//
// Run it where the real MONGO_URI is set (e.g. the Render shell):
//   node backend/scripts/migrate-deleted-record-ttl-index.js
import dotenv from 'dotenv';
dotenv.config();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');

const { default: mongoose } = await import('mongoose');
const { default: DeletedRecord } = await import('../models/DeletedRecord.js');

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';
console.log(`\nConnected to ${dbHost}\n`);

const existing = await DeletedRecord.collection.indexes();
const ttlIndex = existing.find((ix) => ix.key && Object.keys(ix.key).length === 1 && ix.key.expiresAt === 1);

if (!ttlIndex) {
  console.log('No existing expiresAt index found — nothing to drop. Creating the new one directly.');
} else if (ttlIndex.partialFilterExpression) {
  console.log(`Index "${ttlIndex.name}" already has a partialFilterExpression — assuming this migration already ran. Nothing to do.`);
  process.exit(0);
} else {
  console.log(`Dropping old index "${ttlIndex.name}" (expireAfterSeconds: ${ttlIndex.expireAfterSeconds}, no partial filter)...`);
  await DeletedRecord.collection.dropIndex(ttlIndex.name);
  console.log('Dropped.');
}

console.log('Building the new partial TTL index (excludes collectionName: "Merchant")...');
await DeletedRecord.createIndexes();
console.log('Done.\n');

const rebuilt = await DeletedRecord.collection.indexes();
console.log(JSON.stringify(rebuilt.find((ix) => ix.key?.expiresAt === 1), null, 2));

const trashedMerchantCount = await DeletedRecord.countDocuments({ collectionName: 'Merchant', status: 'trashed' });
console.log(`\n${trashedMerchantCount} previously-deleted merchant snapshot(s) are now permanent and will surface on the Merchants page as "deleted".\n`);

process.exit(0);
