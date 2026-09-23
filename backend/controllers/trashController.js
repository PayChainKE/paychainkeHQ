import mongoose from 'mongoose';
import DeletedRecord from '../models/DeletedRecord.js';
import { restoreFromTrash, RestoreError } from '../utils/trash.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { purgeMerchantCloudinaryAssets } from '../services/trashRetentionService.js';

// @desc    List trashed records — the handful of significant, admin-
//          initiated deletions (Merchant, Transaction/stuck-payout, Admin/
//          officer-or-team, Expense) that get snapshotted before deletion.
//          See models/DeletedRecord.js and utils/trash.js.
// @route   GET /admin/trash
// @access  Private (Owner/Admin)
export const getTrash = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = { status: 'trashed' };
    if (req.query.collectionName) filter.collectionName = req.query.collectionName;

    const [total, items] = await Promise.all([
      DeletedRecord.countDocuments(filter),
      DeletedRecord.find(filter)
        .select('-snapshot') // the full snapshot can carry sensitive fields (password hashes, etc.) — never sent to the list view
        .sort('-deletedAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('deletedBy', 'name email')
        .lean(),
    ]);

    res.json({ success: true, data: items, total, page, limit });
  } catch (error) {
    console.error('Get Trash Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Restore a trashed record back into its original collection with
//          its original _id. Owner/admin only — this can bring back a
//          deleted merchant or team/officer account, which is just as
//          sensitive as deleting one in the first place.
// @route   POST /admin/trash/:id/restore
// @access  Private (Owner/Admin)
export const restoreTrashItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const record = await DeletedRecord.findOne({ _id: id, status: 'trashed' });
    if (!record) return res.status(404).json({ error: 'Not found, or already restored.' });

    await restoreFromTrash(record);

    record.status = 'restored';
    record.restoredBy = req.admin._id;
    record.restoredAt = new Date();
    await record.save();

    logAudit({
      action: 'admin.trash.restored', category: 'admin', severity: 'critical',
      message: `Restored ${record.collectionName} "${record.label}" from trash`,
      actor: adminActor(req.admin), req,
      metadata: { collectionName: record.collectionName, originalId: record.originalId.toString() },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof RestoreError) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Restore Trash Item Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to restore this item.' });
  }
};

// @desc    Permanently erase a trashed record's snapshot — skips the
//          90-day auto-purge (DeletedRecord's own `expiresAt` TTL index)
//          for when an admin wants it gone now rather than waiting. Only
//          removes the DeletedRecord snapshot itself; the live collection
//          was already hard-deleted the moment this was trashed, so
//          nothing else changes. Unlike restore, this can never be undone
//          — there is no second trash behind this one.
// @route   DELETE /admin/trash/:id
// @access  Private (Owner/Admin)
export const permanentlyDeleteTrashItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const record = await DeletedRecord.findOne({ _id: id, status: 'trashed' });
    if (!record) return res.status(404).json({ error: 'Not found, or already restored.' });

    const { collectionName, label, originalId } = record;
    // Restore is off the table the instant this is deleted for good, so a
    // Merchant's KYC/certificate/business-photo images can safely leave
    // Cloudinary right now instead of waiting out the rest of the 90-day
    // window (see services/trashRetentionService.js).
    if (collectionName === 'Merchant' && !record.cloudinaryPurged) {
      await purgeMerchantCloudinaryAssets(record.snapshot).catch((e) => console.error('Cloudinary purge on permanent delete failed (non-fatal):', e?.message || e));
    }
    await record.deleteOne();

    logAudit({
      action: 'admin.trash.permanently_deleted', category: 'admin', severity: 'critical',
      message: `Permanently deleted ${collectionName} "${label}" from trash — no longer recoverable`,
      actor: adminActor(req.admin), req,
      metadata: { collectionName, originalId: originalId.toString() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Permanently Delete Trash Item Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to permanently delete this item.' });
  }
};
