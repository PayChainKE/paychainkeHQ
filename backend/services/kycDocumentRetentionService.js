import Merchant from '../models/Merchant.js';
import { deleteCloudinaryAsset } from '../utils/cloudinary.js';
import { logAudit } from '../utils/auditLog.js';

// A rejected application never became a paying merchant and has no
// approved-account audit trail depending on the underlying files — only
// on the fact that it was rejected, which lives in kybStatus/kybNotes/
// reviewedAt/reviewedBy and is never touched here. The fraud-dedup check
// (utils/documentReuseDetection.js) also survives this untouched, since it
// keys off contentHash, not the file itself. Only the Cloudinary asset and
// its dead-end url go away; everything else about the rejection stays in
// Mongo forever, same as any other rejected application.
const RETENTION_DAYS = 90;
const PURGED_URL_PLACEHOLDER = 'purged';

// Run once a day (see server.js) — not time-sensitive like the weekly
// revenue sweep, so a plain in-process interval is enough; a missed or
// double-run day changes nothing (query is idempotent via
// kybDocumentsPurgedAt).
export async function purgeExpiredRejectedKycDocuments() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await Merchant.find({
    kybStatus: 'rejected',
    reviewedAt: { $lte: cutoff },
    kybDocumentsPurgedAt: null,
  }).select('+kybDocumentsPurgedAt businessName email kybDocuments certificateUrl reviewedAt');

  let purgedMerchants = 0;
  let purgedFiles = 0;

  for (const merchant of candidates) {
    try {
      for (const doc of merchant.kybDocuments) {
        if (doc.purgedAt || !doc.url || doc.url === PURGED_URL_PLACEHOLDER) continue;
        await deleteCloudinaryAsset(doc.url);
        doc.url = PURGED_URL_PLACEHOLDER;
        doc.purgedAt = new Date();
        purgedFiles += 1;
      }
      if (merchant.certificateUrl) {
        await deleteCloudinaryAsset(merchant.certificateUrl);
        merchant.certificateUrl = null;
        purgedFiles += 1;
      }
      merchant.kybDocumentsPurgedAt = new Date();
      await merchant.save();
      purgedMerchants += 1;

      logAudit({
        action: 'system.kyc_documents.purged',
        category: 'system',
        severity: 'info',
        message: `Purged Cloudinary files for a rejected application (rejected ${RETENTION_DAYS}+ days ago)`,
        merchant,
        actor: { type: 'system', id: null, email: null, name: 'system' },
        metadata: { retentionDays: RETENTION_DAYS },
      });
    } catch (err) {
      console.error(`KYC document retention purge failed for merchant ${merchant._id}:`, err?.message || err);
    }
  }

  if (purgedMerchants > 0) {
    console.log(`KYC document retention sweep: purged ${purgedFiles} file(s) across ${purgedMerchants} rejected application(s).`);
  }
  return { purgedMerchants, purgedFiles };
}
