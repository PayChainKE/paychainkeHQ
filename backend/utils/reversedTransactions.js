import Transaction from '../models/Transaction.js';

// Shared safeguard for every revenue/sweep aggregation in the codebase —
// backend/services/revenueSweepService.js's computeUnsweptRevenue (which
// decides how much real money the weekly sweep pulls out of the pooled
// NCBA account) and backend/controllers/revenueController.js's getRevenue
// both sum paychainFee directly off persisted Transaction fields. The
// 2026-08-27 incident showed that isn't safe to trust blindly: a manual
// ledger correction (a REVERSAL-* entry undoing a duplicate credit) got
// auto-stamped a real-looking fee by Transaction's pre-save hook even
// though it was never real revenue — and so did the fake duplicate credit
// it corrected. Zeroing those fields by hand after the fact fixes today's
// data, but nothing forced that discipline; a future correction that
// forgets would silently let the sweep pull merchant money into PayChain's
// own account again. This filter makes that structurally impossible
// instead of relying on someone remembering: both halves of any
// REVERSAL-<originalReference> pair are excluded from revenue math,
// regardless of what their fee fields say.
export async function reversedTransactionExclusionMatch() {
  const reversalRefs = await Transaction.distinct('reference', { reference: /^REVERSAL-/ });
  if (!reversalRefs.length) return {};
  const originalRefs = reversalRefs.map((r) => r.slice('REVERSAL-'.length));
  return { reference: { $nin: [...reversalRefs, ...originalRefs] } };
}
