// Single source of truth for "is this transaction money coming in or going
// out" — used everywhere a Transaction's amount is rendered (Overview,
// Transactions, Wallet) so the +/- sign and green/red coloring never drift
// out of sync between pages again.

const CREDIT_TYPES = new Set(['inbound', 'top_up', 'ncba_inbound'])
const SWAP_TYPES = new Set(['fx_swap'])
// Everything else (outbound, withdrawal, bulk_pay, settlement,
// ncba_outbound, and any future debit type) is treated as money leaving.

export function isCreditTransaction(type) {
  return CREDIT_TYPES.has(type)
}

export function isSwapTransaction(type) {
  return SWAP_TYPES.has(type)
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
