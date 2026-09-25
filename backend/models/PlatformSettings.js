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
  // Every non-demo Merchant document ever created, counted once at creation
  // (models/Merchant.js's post-save hook) and never decremented — survives
  // a merchant being deleted, unlike Merchant.countDocuments() (only live
  // accounts) or DeletedRecord (only the last 90 days of deletions, then
  // its own TTL erases the snapshot). This is the only number in the system
  // that answers "how many merchant accounts has PayChain had, ever" — see
  // migrations/backfillMerchantsEverCreated.js for the one-time seed of
  // everyone who existed (live or still-trashed) before this field existed.
  merchantsEverCreated: { type: Number, default: 0 },
  merchantsEverCreatedSeededAt: { type: Date, default: null },
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

// Atomic — safe to call concurrently from many requests at once (unlike
// getOrCreatePlatformSettings().save(), which could race and lose a count
// under real concurrent signups).
export async function incrementMerchantsEverCreated() {
  await PlatformSettings.findOneAndUpdate(
    { singleton: 'global' },
    { $inc: { merchantsEverCreated: 1 } },
    { upsert: true }
  );
}

export default PlatformSettings;
