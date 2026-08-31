import mongoose from 'mongoose';
import DeletedRecord from '../models/DeletedRecord.js';
import { restoreFromTrash, RestoreError } from '../utils/trash.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

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
