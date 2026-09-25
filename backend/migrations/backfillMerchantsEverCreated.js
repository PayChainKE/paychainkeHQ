import Merchant from '../models/Merchant.js';
import DeletedRecord from '../models/DeletedRecord.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';

// One-time, EXACTLY-once boot migration (2026-09-23) — seeds
// PlatformSettings.merchantsEverCreated with the best count available for
// everyone who existed before that field started being tracked at creation
// time (models/Merchant.js's post-save hook, added in the same change).
//
// The seed is live merchants right now, plus anyone still inside their
// 90-day trash window (DeletedRecord, status:'trashed') — both exclude
// isDemoMerchant accounts, matching the hook's own exclusion. It cannot
// recover anyone who was deleted and already fell out of that 90-day
// window before this shipped: no permanent record of them exists anywhere
// in the system, so that handful of very old deletions (if any) is a real,
// unrecoverable gap in "since day one" — not a bug in this migration.
// Same one-time-completion-flag pattern as backfillMerchantTariffLocks.js,
// and for the identical reason: this must never re-run on a later boot,
// or it would double-count merchants created (and normally incremented via
// the hook) between this run and the next.
export async function backfillMerchantsEverCreated() {
  const settings = await getOrCreatePlatformSettings();
  if (settings.merchantsEverCreatedSeededAt) return;

  const [liveCount, trashedCount] = await Promise.all([
    Merchant.countDocuments({ isDemoMerchant: { $ne: true } }),
    DeletedRecord.countDocuments({ collectionName: 'Merchant', status: 'trashed', 'snapshot.isDemoMerchant': { $ne: true } }),
  ]);

  settings.merchantsEverCreated = liveCount + trashedCount;
  settings.merchantsEverCreatedSeededAt = new Date();
  await settings.save();

  console.log(`📊 One-time merchant-history seed: merchantsEverCreated = ${settings.merchantsEverCreated} (${liveCount} live + ${trashedCount} still in trash). Every merchant created from now on increments this permanently via the model hook.`);
}
