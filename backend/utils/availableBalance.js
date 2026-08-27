import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';

// A merchant's real kesBalance can be inflated by a bug the moment a bad
// credit lands — the 2026-08-27 STK double-credit incident (a webhook and
// the STK poll loop each crediting the same payment, ~3ms apart) showed
// this concretely: once money is in kesBalance, the system has no way to
// tell a genuine credit apart from a duplicate/erroneous one, and the
// normal atomic "debit if kesBalance >= amount" check would have happily
// let it be withdrawn seconds later.
//
// This holds back money credited in the last HOLD_WINDOW_MS from being
// withdrawn — not from being spent internally or shown as balance
// everywhere else (kesBalance itself is untouched and still the true,
// accurate total) — giving a short window for a bug like that one to be
// caught before the money can actually leave. Deliberately short: long
// enough to matter, short enough that no real merchant workflow (checking
// a balance, then withdrawing later) ever notices it.
const HOLD_WINDOW_MS = 2 * 60 * 1000;

// The only transaction types that ever increase kesBalance — mirrors
// CREDIT_TYPES in apps/merchant-dashboard/src/utils/transactionDirection.js.
const CREDIT_TYPES = ['inbound', 'ncba_inbound', 'top_up'];

export class InsufficientAvailableBalanceError extends Error {
  constructor(merchantId, amount) {
    super('Insufficient available balance — some of your balance was credited in the last couple of minutes and is briefly held before it can be sent out.');
    this.name = 'InsufficientAvailableBalanceError';
    this.merchantId = merchantId;
    this.amount = amount;
  }
}

// Sums recent credits by kesAmount (the gross figure Transaction stores for
// every credit type), not the true net-of-fee balance impact — deliberately
// conservative. Recomputing the exact net impact per type here would
// duplicate feeCalculator.js's logic with the drift risk that's already
// bitten this codebase once (see revenueController.js's FEE_EXPR comment);
// over-holding by a few shillings for two minutes is a harmless trade-off,
// under-holding is not.
async function getRecentlyCreditedHold(merchantId) {
  const cutoff = new Date(Date.now() - HOLD_WINDOW_MS);
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        merchantId,
        type: { $in: CREDIT_TYPES },
        status: { $in: ['completed', 'verified'] },
        createdAt: { $gte: cutoff },
      },
    },
    { $group: { _id: null, total: { $sum: '$kesAmount' } } },
  ]);
  return agg?.total || 0;
}

// Drop-in replacement for the
// `Merchant.findOneAndUpdate({_id, kesBalance:{$gte:amount}}, {$inc:{kesBalance:-amount}})`
// idiom used by every payout controller — same atomicity, same null-means-
// insufficient return convention, just checking against (amount + whatever
// of the balance is still held) instead of the raw balance alone.
export async function debitAvailableBalance(merchantId, amount) {
  const held = await getRecentlyCreditedHold(merchantId);
  return Merchant.findOneAndUpdate(
    { _id: merchantId, kesBalance: { $gte: amount + held } },
    { $inc: { kesBalance: -amount } },
    { returnDocument: 'after' }
  );
}
