// Single source of truth for "is this transaction money coming in or going
// out" — used everywhere a Transaction's amount is rendered (Overview,
// Transactions, Wallet) so the +/- sign and green/red coloring never drift
// out of sync between pages again.

const CREDIT_TYPES = new Set(['inbound', 'top_up', 'ncba_inbound'])
const SWAP_TYPES = new Set(['fx_swap'])
// Everything else (outbound, withdrawal, bulk_pay, settlement,
// ncba_outbound, and any future debit type) is treated as money leaving.

// A 'failed' or still-'pending' Transaction never actually moved money —
// a failed payout gets refunded (see resolvePendingOpenBankingTransaction,
// backend/controllers/ncbaOpenBankingController.js) and a pending one
// hasn't landed yet. Only 'completed' and 'verified' (the same pairing the
// backend's own revenue/reporting queries use — see e.g.
// backend/controllers/revenueController.js) represent a real, permanent
// balance change. Any statement/total/running-balance math that skips this
// check counts failed attempts as if they'd actually gone through.
const SETTLED_STATUSES = new Set(['completed', 'verified'])

export function isSettledStatus(status) {
  return SETTLED_STATUSES.has(status)
}

export function isCreditTransaction(type) {
  return CREDIT_TYPES.has(type)
}

export function isSwapTransaction(type) {
  return SWAP_TYPES.has(type)
}

// Debit = money leaving that isn't a swap. Defined as "not credit, not
// swap" (rather than its own hardcoded list) so a future debit type is
// correctly classified everywhere by default, matching how CREDIT_TYPES
// is the single opt-in list.
export function isDebitTransaction(type) {
  return !isCreditTransaction(type) && !isSwapTransaction(type)
}

export function getAmountSign(type) {
  if (isCreditTransaction(type)) return '+'
  if (isSwapTransaction(type)) return '±'
  return '-'
}

// Plain text color — for contexts with their own hover/background handling.
export function getAmountColorClass(type) {
  if (isCreditTransaction(type)) return 'text-emerald-600'
  if (isSwapTransaction(type)) return 'text-purple-600'
  return 'text-rose-600'
}

// Color + hover variant — for rows where the whole card/row inverts on
// hover (dark background), so the amount stays legible.
export function getAmountColorClassWithHover(type) {
  if (isCreditTransaction(type)) return 'text-emerald-600 group-hover:text-emerald-400'
  if (isSwapTransaction(type)) return 'text-purple-600 group-hover:text-purple-400'
  return 'text-rose-600 group-hover:text-rose-400'
}
