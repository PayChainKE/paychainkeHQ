import mongoose from 'mongoose';

// Singleton — one document holds every platform-wide (not per-merchant)
// feature toggle, so a second one can never accidentally get created.
// Currently just cash advance; future platform-wide switches belong here
// as new fields rather than a new singleton per feature.
const platformSettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'global', unique: true },
  // Global kill switch for cash advance applications, independent of
  // Merchant.features.cashAdvanceForm (that's a per-merchant override; this
  // is "off for absolutely everyone" regardless of any per-merchant flag).
  cashAdvanceEnabled: { type: Boolean, default: true },
  // Set once, ever, by migrations/backfillMerchantTariffLocks.js the first
  // time it runs — guards that one-time backfill so it can never re-fire on
  // a later boot and accidentally lock a merchant who signed up AFTER the
  // original 28 (see that file's own header comment for why "tariffLock is
  // still null" can't be used as the idempotency check here, unlike every
  // other boot-time backfill in this codebase).
  merchantTariffBackfillCompletedAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

// Every caller goes through this instead of a raw findOne, so the global
// doc is created lazily on first read rather than requiring a migration.
export async function getOrCreatePlatformSettings() {
  let doc = await PlatformSettings.findOne({ singleton: 'global' });
  if (!doc) doc = await PlatformSettings.create({ singleton: 'global' });
  return doc;
}

export default PlatformSettings;
