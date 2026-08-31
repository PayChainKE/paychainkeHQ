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
  // Auto-purged after 90 days — a snapshot sitting forever isn't the point
  // (the audit log is the permanent record of the deletion itself); this
  // is a working undo window, not a permanent archive.
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

DeletedRecordSchema.index({ status: 1, deletedAt: -1 });
DeletedRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const DeletedRecord = mongoose.model('DeletedRecord', DeletedRecordSchema);
export default DeletedRecord;
