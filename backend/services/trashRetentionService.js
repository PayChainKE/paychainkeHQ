import DeletedRecord from '../models/DeletedRecord.js';
import { deleteCloudinaryAsset } from '../utils/cloudinary.js';
import { logAudit } from '../utils/auditLog.js';

// A deleted merchant's KYC documents, certificate and business photos stay
// live on Cloudinary as long as the deletion is restorable — Trash.jsx's own
// restore promise is "brings this merchant back exactly as it was right
// before deletion", which a purged image would break. So these are only
// ever deleted once restore is no longer realistically coming: either an
// admin explicitly clicks "Delete Permanently" (utils/trash.js is used by
// trashController.js#permanentlyDeleteTrashItem, which calls
// purgeMerchantCloudinaryAssets directly), or the 90-day trash window is
// about to auto-expire anyway (this sweep). Mirrors
// kycDocumentRetentionService.js's same reasoning for rejected applications.
const EXPIRY_LOOKAHEAD_MS = 25 * 60 * 60 * 1000; // 25h — this sweep runs every 24h, so this always catches a record before DeletedRecord's own TTL index (expireAfterSeconds:0 on expiresAt) can silently delete it first.

// Deletes every Cloudinary asset referenced by a trashed Merchant snapshot.
// Safe to call more than once (deleteCloudinaryAsset is itself idempotent
// against an already-missing asset) — callers still set cloudinaryPurged so
// it normally only runs once per record.
export async function purgeMerchantCloudinaryAssets(snapshot) {
  if (!snapshot) return 0;
  let purged = 0;
  for (const doc of snapshot.kybDocuments || []) {
    if (!doc?.url || doc.url === 'purged') continue;
    await deleteCloudinaryAsset(doc.url);
    purged += 1;
  }
  if (snapshot.certificateUrl && snapshot.certificateUrl !== 'purged') {
    await deleteCloudinaryAsset(snapshot.certificateUrl);
    purged += 1;
  }
  for (const photo of snapshot.businessPhotos || []) {
    if (!photo?.url) continue;
    await deleteCloudinaryAsset(photo.url);
    purged += 1;
  }
  return purged;
}

// Run once a day (see server.js) — trashed Merchant records whose 90-day
// restore window is about to close get their Cloudinary images deleted now
// rather than left live forever (the Mongo snapshot itself still expires on
// its own via DeletedRecord's TTL index; this only handles the Cloudinary
// side, which nothing else ever touches).
export async function purgeExpiringTrashCloudinaryAssets() {
  const candidates = await DeletedRecord.find({
    status: 'trashed',
    collectionName: 'Merchant',
    cloudinaryPurged: false,
    expiresAt: { $lte: new Date(Date.now() + EXPIRY_LOOKAHEAD_MS) },
  });

  let purgedRecords = 0;
  let purgedFiles = 0;

  for (const record of candidates) {
    try {
      purgedFiles += await purgeMerchantCloudinaryAssets(record.snapshot);
      record.cloudinaryPurged = true;
      await record.save();
      purgedRecords += 1;

      logAudit({
        action: 'system.trash.cloudinary_purged', category: 'system', severity: 'info',
        message: `Purged Cloudinary files for "${record.label}" — its 90-day trash window is about to expire`,
        actor: { type: 'system', id: null, email: null, name: 'system' },
        metadata: { originalId: record.originalId.toString() },
      });
    } catch (err) {
      console.error(`Trash Cloudinary purge failed for DeletedRecord ${record._id}:`, err?.message || err);
    }
  }

  if (purgedRecords > 0) {
    console.log(`Trash retention sweep: purged ${purgedFiles} Cloudinary file(s) across ${purgedRecords} expiring merchant deletion(s).`);
  }
  return { purgedRecords, purgedFiles };
}
