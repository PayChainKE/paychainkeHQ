import Developer from '../models/Developer.js';
import ApiKey from '../models/ApiKey.js';

// Moves a developer's legacy single link (Developer.linkedMerchant) into the
// linkedMerchants list, carrying its developer-level live-access state across
// so an already-approved developer stays approved for that merchant. Keys made
// before keys had merchants are pinned to it, so linking a second merchant
// can never leave an existing key ambiguous. Safe to call repeatedly: it does
// nothing once the legacy link is already in the list. Returns the fresh doc.
export async function migrateLegacyLink(developerId) {
  const developer = await Developer.findById(developerId);
  const legacyId = developer?.linkedMerchant?.merchantId;
  if (!developer || !legacyId) return developer;
  if ((developer.linkedMerchants || []).some((l) => String(l.merchantId) === String(legacyId))) return developer;

  const la = developer.liveAccess || {};
  await Developer.updateOne(
    { _id: developer._id, 'linkedMerchants.merchantId': { $ne: legacyId } },
    {
      $push: {
        linkedMerchants: {
          merchantId: legacyId,
          linkedAt: developer.linkedMerchant.linkedAt || new Date(),
          liveAccess: {
            approved: !!la.approved,
            requestedAt: la.requestedAt || null,
            approvedAt: la.approvedAt || null,
            approvedBy: la.approvedBy || null,
            autoTest: la.autoTest || null,
          },
        },
      },
    }
  );
  await ApiKey.updateMany({ developerId: developer._id, merchantId: null }, { $set: { merchantId: legacyId } });
  return Developer.findById(developer._id);
}
