// Prunes PayoutBatch summary records older than one month. This is pure
// UI-list housekeeping, NOT a ledger deletion — every real money movement
// stays permanently on the underlying Transaction documents (what Revenue,
// Bookkeeping, the KRA export, and Transaction Audit all actually read
// from). Transaction has no batchId/PayoutBatch reference at all, so
// removing an old PayoutBatch can never orphan or affect any of those.
// Without this, Bulk Pay's own Batch History list (bulkPayController.js's
// getBatchHistory) would grow forever with no way for a merchant to clear
// it themselves.
import PayoutBatch from '../models/PayoutBatch.js';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // ~1 month

export async function cleanupOldBatchHistory() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const result = await PayoutBatch.deleteMany({ createdAt: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    console.log(`Batch history cleanup: removed ${result.deletedCount} PayoutBatch record(s) older than 30 days.`);
  }
}
