import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import Admin from '../models/Admin.js';
import Expense from '../models/Expense.js';
import RetiredMerchantCode from '../models/RetiredMerchantCode.js';
import DeletedRecord from '../models/DeletedRecord.js';

// The only models a real admin delete action ever routes through here —
// see DeletedRecord.js's doc comment for why this stays a short, deliberate
// list rather than covering every delete() call site in the app.
const MODEL_REGISTRY = { Merchant, Transaction, Admin, Expense };

// Call this immediately BEFORE the real delete — snapshot-then-delete, same
// ordering every logAudit-before-delete call site in this codebase already
// uses, so the record can never be lost to a mid-flight crash between the
// two. Never throws into the caller's delete flow: a failed snapshot means
// this particular deletion won't be undoable, which is unfortunate but far
// better than a snapshotting bug blocking a real admin action outright.
export async function recordDeletion({ collectionName, doc, label, deletedBy }) {
  try {
    await DeletedRecord.create({
      collectionName,
      originalId: doc._id,
      snapshot: doc.toObject ? doc.toObject() : doc,
      label,
      deletedBy,
    });
  } catch (err) {
    console.error(`Failed to snapshot ${collectionName} ${doc._id} before deletion:`, err?.message || err);
  }
}

export class RestoreError extends Error {}

// Re-inserts a trashed document into its original collection with its
// original _id, exactly as it looked right before deletion. Fails loudly
// (RestoreError) rather than silently — e.g. if something now occupies
// that _id (shouldn't happen since Mongo _ids aren't reused, but a
// duplicate-key on some OTHER unique field, like a merchant's email
// already in use by a newer account created since the deletion, is
// entirely possible and must block the restore rather than clobbering the
// newer record).
export async function restoreFromTrash(deletedRecord) {
  const Model = MODEL_REGISTRY[deletedRecord.collectionName];
  if (!Model) throw new RestoreError(`Unknown collection "${deletedRecord.collectionName}" — cannot restore.`);

  try {
    await Model.create(deletedRecord.snapshot);
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'a field';
      throw new RestoreError(`Cannot restore — another record now uses the same ${key}. Resolve that conflict first.`);
    }
    throw new RestoreError(err.message);
  }

  // Best-effort only: reverses the one known side effect a merchant delete
  // has (retiring their NCBA code so the random generator never reissues
  // it — see adminController.js's confirmMerchantAction 'delete' branch).
  // Never blocks the restore itself if this fails.
  if (deletedRecord.collectionName === 'Merchant' && deletedRecord.snapshot?.ncbaMerchantCode) {
    RetiredMerchantCode.deleteOne({ code: deletedRecord.snapshot.ncbaMerchantCode }).catch((e) =>
      console.error('Failed to un-retire merchant code on restore:', e?.message || e)
    );
  }
}
