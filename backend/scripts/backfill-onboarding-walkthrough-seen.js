// One-time backfill: marks every merchant that exists BEFORE the walkthrough
// features ship as having already seen them (the dashboard-wide tour, the
// My Accounts page tour, and the Security section tour). Without this,
// Mongoose applies each new field's `default: false` to every already-
// existing merchant document too (not just new signups going forward),
// which would pop the tours up for every current merchant on their next
// visit instead of only genuinely new accounts.
//
// Safe to re-run — only touches merchants missing a given field.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/backfill-onboarding-walkthrough-seen.js
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';

await mongoose.connect(process.env.MONGO_URI);

const FIELDS = [
  'hasSeenOnboardingWalkthrough',
  'hasSeenAccountsWalkthrough',
  'hasSeenSecurityWalkthrough',
  'hasSeenProfileWalkthrough',
  'hasSeenTransactionsWalkthrough',
];

for (const field of FIELDS) {
  const result = await Merchant.updateMany(
    { [field]: { $exists: false } },
    { $set: { [field]: true } }
  );
  console.log(`${field} — Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
}

await mongoose.disconnect();
process.exit(0);
