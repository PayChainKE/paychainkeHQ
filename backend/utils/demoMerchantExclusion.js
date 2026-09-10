import Merchant from '../models/Merchant.js';

// Shared safeguard for every admin-facing financial aggregation
// (revenue KPIs, the weekly sweep that moves real money to PayChain's
// corporate account, the bookkeeping P&L, and the Insights dashboard's
// GTV/GMV/top-merchants figures) — both the isDemoMerchant:true account
// (apps/demo's showcase merchant) and the isAppReviewAccount:true account
// (what Google Play reviewers log into) run real-looking simulated
// transactions on purpose, and nothing about a Transaction row itself marks
// it as simulated. Without this, that activity silently inflates PayChain's
// reported revenue and would even get swept into the real corporate
// account alongside genuine merchant fees. Mirrors
// reversedTransactionExclusionMatch's pattern exactly: resolve the current
// exclusion set once per request, spread the result into every match stage.
export async function excludeDemoMerchantsMatch() {
  const excludedIds = await Merchant.distinct('_id', {
    $or: [{ isDemoMerchant: true }, { isAppReviewAccount: true }],
  });
  if (!excludedIds.length) return {};
  return { merchantId: { $nin: excludedIds } };
}
