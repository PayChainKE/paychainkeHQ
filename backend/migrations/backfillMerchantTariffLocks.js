import Merchant from '../models/Merchant.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';
import { snapshotCurrentTariffs } from '../services/tariffCardCache.js';

// One-time, EXACTLY-once boot migration (Brandon, 2026-09-03 — confirmed:
// only the merchants that already exist right now get frozen to today's
// rates forever; every merchant created after this ships should keep
// tracking the live global tariff, exactly like today, however many times
// an admin edits it later).
//
// Deliberately does NOT use the usual "only touch rows still at their
// default value" idempotency pattern every other boot-time backfill in this
// codebase uses (seedTariffCards.js, backfillTransactionFees.js) — those are
// safe re-running forever because a row that's already been touched can
// never look "untouched" again. This one can't work that way: under the
// policy above, a brand-new merchant #40 is SUPPOSED to sit at
// `tariffLock: null` permanently (so it keeps reading the live cache) — if
// this ran again on a later boot filtered on `{ tariffLock: null }`, it
// would wrongly sweep up and freeze every merchant who signed up after the
// very first run, not just the cohort that existed before this feature
// shipped. So instead this checks a one-time completion flag on
// PlatformSettings — once set, this function is a permanent no-op, and
// never queries Merchant again on any later boot.
export async function backfillMerchantTariffLocks() {
  const settings = await getOrCreatePlatformSettings();
  if (settings.merchantTariffBackfillCompletedAt) return;

  const snapshot = snapshotCurrentTariffs();
  const result = await Merchant.updateMany(
    {},
    { $set: { tariffLock: snapshot, tariffLockedAt: new Date() } }
  );

  settings.merchantTariffBackfillCompletedAt = new Date();
  await settings.save();

  console.log(`🔒 One-time tariff freeze: locked ${result.modifiedCount} pre-existing merchant(s) to their current tariffs. Every merchant created from now on tracks the live tariff sheet instead.`);
}
