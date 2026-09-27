import mongoose from 'mongoose';

// A full snapshot of a document taken immediately before a real admin
// delete action, so it can be shown on a "Trash" page and restored —
// without touching how any existing list/search screen queries its live
// collection (unlike a soft-delete flag, which would need every existing
// `Model.find(...)` call site across the app to start excluding deleted
// rows). The live collections stay exactly as hard-delete as before;
// this is purely an independent record of what was removed and by whom.
//
// Deliberately scoped to only the handful of significant, admin-initiated
// deletions (Merchant, Transaction/stuck-payout, Admin/officer-or-team,
// Expense) — not every delete button in the app. Smaller/internal deletes
// (bulk-pay payees, notifications, verification tokens, newsletter drafts)
// aren't things anyone would realistically want to "undo" and were
// deliberately left as plain hard deletes.
const DeletedRecordSchema = new mongoose.Schema({
  // The Mongoose model name the snapshot belongs to (e.g. 'Merchant',
  // 'Transaction', 'Admin', 'Expense') — see utils/trash.js's MODEL_REGISTRY,
  // which restore() looks this up against.
  collectionName: { type: String, required: true },
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // The full original document, exactly as it looked right before deletion
  // — restore() re-inserts this verbatim (with its original _id) rather
  // than trying to reconstruct it from partial fields.
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  // Short human-readable summary for the Trash list, computed once at
  // deletion time (e.g. a merchant's businessName, an admin's email) so the
  // list page never has to know each model's own display-field shape.
  label: { type: String, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  deletedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['trashed', 'restored'], default: 'trashed' },
  restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  restoredAt: { type: Date, default: null },
  // Still set 90 days out for every collection, Merchant included — this
  // date keeps driving the Cloudinary-image purge sweep and the "how long
  // is this realistically undoable" UX exactly as before. Whether it
  // actually causes Mongo to delete the document depends on the TTL index
  // below, which now excludes Merchant snapshots: those are the platform's
  // permanent "every merchant that ever existed" record (admin KPIs), not
  // just a working undo window like Transaction/Admin/Expense snapshots are.
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
  // Set once services/trashRetentionService.js (a Merchant snapshot only)
  // has deleted the snapshot's Cloudinary images (KYC documents,
  // certificate, business photos) — either because an admin permanently
  // deleted this trash entry, or because it's about to auto-expire.
  // Restoring a merchant before this is true brings back working image
  // links; restoring after would not, which is exactly why the sweep only
  // purges once restore is no longer realistically coming (see that file).
  cloudinaryPurged: { type: Boolean, default: false },
}, { timestamps: true });

DeletedRecordSchema.index({ status: 1, deletedAt: -1 });
// Merchant snapshots are excluded from this TTL index (partialFilterExpression)
// so a deleted merchant is never actually removed from the database — the
// Merchants page merges these in (status: 'deleted') so an admin's merchant
// count reflects everyone who ever signed up, not just current accounts.
// Transaction/Admin/Expense snapshots still auto-purge at their expiresAt.
DeletedRecordSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { collectionName: { $ne: 'Merchant' } } }
);

const DeletedRecord = mongoose.model('DeletedRecord', DeletedRecordSchema);
export default DeletedRecord;
