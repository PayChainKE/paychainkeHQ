import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import { notifyAdmins, escapeHtml } from './securityAlerts.js';
import { logAudit } from './auditLog.js';

export function hashDocumentBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Call after a merchant's kybDocuments have been saved (registerMerchant,
// or adminController.js's updateMerchantKycDocument) with the contentHash
// of every document just uploaded. Checks whether any of those hashes
// already exist on a DIFFERENT merchant's kybDocuments — the same photo or
// scan showing up on two accounts is a near-certain sign of a fraud ring
// reusing one stolen identity across multiple registrations, which nothing
// previously checked for. On a match: auto-flags this account for review
// (the same `flagged` field an admin sets manually — reversible, a label
// not an access block) and raises a critical Security Alert. Never throws
// — a failed check must not block the KYB submission it's checking.
export async function checkDocumentReuse(merchant, hashes) {
  try {
    const uniqueHashes = [...new Set((hashes || []).filter(Boolean))];
    if (!uniqueHashes.length) return;

    const matches = await Merchant.find({
      _id: { $ne: merchant._id },
      'kybDocuments.contentHash': { $in: uniqueHashes },
    }).select('businessName email kybDocuments').lean();

    if (!matches.length) return;

    const matchDetails = matches.map((m) => ({
      merchantId: m._id,
      businessName: m.businessName,
      email: m.email,
      sharedTypes: m.kybDocuments.filter((d) => uniqueHashes.includes(d.contentHash)).map((d) => d.type),
    }));
    const otherNames = matchDetails.map((m) => m.businessName || m.email).join(', ');

    await Merchant.updateOne(
      { _id: merchant._id },
      {
        $set: {
          flagged: true,
          flagReason: `Auto-flagged: an uploaded KYB document matches one already on file for ${matchDetails.length} other account(s) (${otherNames}).`,
          flaggedAt: new Date(),
        },
      }
    );

    logAudit({
      action: 'merchant.document_reuse_detected',
      category: 'security',
      severity: 'critical',
      message: 'Uploaded KYB document matches one already on file for a different merchant',
      merchant,
      actor: { type: 'system', id: null, email: null, name: 'system' },
      metadata: { matches: matchDetails.map((m) => ({ merchantId: String(m.merchantId), sharedTypes: m.sharedTypes })) },
    });

    notifyAdmins({
      type: 'document_reuse_detected',
      severity: 'critical',
      subject: `Document reuse detected: ${merchant.businessName}`,
      heading: 'Possible Identity Fraud — Reused KYB Document',
      details: `<strong>${escapeHtml(merchant.businessName || merchant.email)}</strong> uploaded a document that exactly matches one already on file for <strong>${matchDetails.length}</strong> other account(s): ${escapeHtml(otherNames)}. The same photo or scan appearing on multiple merchant accounts is a strong signal of stolen-identity fraud. This account has been automatically flagged for review — check both accounts before approving either.`,
      metadata: {
        merchantId: String(merchant._id),
        matchingMerchantIds: matchDetails.map((m) => String(m.merchantId)),
      },
    });
  } catch (err) {
    console.error('checkDocumentReuse failed:', err);
  }
}
