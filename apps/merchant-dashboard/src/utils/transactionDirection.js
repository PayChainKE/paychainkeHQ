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

// `amount`/`kesAmount` doesn't uniformly mean "what the balance actually
// moved by" — it depends on type, per how the backend controllers that
// create these rows populate them:
//   - 'ncba_inbound' (backend/services/ncbaLedgerService.js#creditNcbaCollection)
//     stores NCBA's GROSS reported amount; the real kesBalance credit is
//     amount - (paychainFee + safaricomFee) — the fee never reached the
//     merchant's balance in the first place.
//   - These debit types store PRINCIPAL ONLY; the real kesBalance debit was
//     amount + (paychainFee + safaricomFee) — see e.g.
//     backend/controllers/ncbaOpenBankingController.js's
//     `totalDebit = numericAmount + fee` pattern, mirrored across every
//     NCBA payout rail.
//   - Every other type (inbound, top_up, the 'outbound' ledger-correction
//     type) already stores the exact net figure that was $inc'd — no
//     adjustment needed, and subtracting the fee again would double-count.
// Verified against real production data (2026-08-27): totals only
// reconciled to the merchant's actual kesBalance once this adjustment was
// applied — without it, Total Money In/Out and the running balance column
// silently drift from the real balance for every fee-bearing NCBA row.
const CREDIT_STORES_GROSS_TYPES = new Set(['ncba_inbound'])
const DEBIT_EXCLUDES_FEE_TYPES = new Set(['ncba_outbound', 'ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc', 'mpesa_b2c', 'mpesa_b2b'])

// The true, signed kesBalance impact of a transaction — 0 for anything that
// never settled (see isSettledStatus). Single source of truth for every
// balance total/running-balance calculation so they can't drift from each
// other or from the real account balance the way Total Money In/the running
// BALANCE column did before this existed.
// Drops a fake duplicate credit AND its correction entry as a matched pair,
// so neither shows up anywhere — not as an inflated "money in" figure, not
// as an offsetting "money out" line the merchant has to net out themselves.
// netBalanceImpact's fee correction alone isn't enough for this: a reversed
// duplicate is still a real, 'completed' credit row (see
// backend/services/ncbaLedgerService.js — the double-credit bug that
// created these actually did increment kesBalance at the time), so it still
// counts as legitimate "money in" unless explicitly excluded. Manual
// corrections created this way (see the 2026-08-27 incident writeup) always
// use a `REVERSAL-<originalReference>` reference — that's the only
// contract this depends on. Call once on the raw transaction list before
// any total/statement/chart math runs; safe to call on an already-filtered
// list (a no-op when no REVERSAL- rows are present).
export function excludeReversedDuplicates(transactions) {
  const reversedOriginalRefs = new Set()
  for (const t of transactions) {
    if (typeof t.reference === 'string' && t.reference.startsWith('REVERSAL-')) {
      reversedOriginalRefs.add(t.reference.slice('REVERSAL-'.length))
    }
  }
  if (reversedOriginalRefs.size === 0) return transactions
  return transactions.filter((t) => {
    if (reversedOriginalRefs.has(t.reference)) return false // the fake original credit
    if (typeof t.reference === 'string' && t.reference.startsWith('REVERSAL-') && reversedOriginalRefs.has(t.reference.slice('REVERSAL-'.length))) return false // its correction entry
    return true
  })
}

export function netBalanceImpact(tx) {
  if (!isSettledStatus(tx.status)) return 0
  const rawAmt = tx.kesAmount || tx.amount || 0
  const fee = (tx.paychainFee || 0) + (tx.safaricomFee || 0)
  if (isCreditTransaction(tx.type)) {
    return CREDIT_STORES_GROSS_TYPES.has(tx.type) ? rawAmt - fee : rawAmt
  }
  if (isSwapTransaction(tx.type)) {
    return -(tx.kesAmount || 0)
  }
  return DEBIT_EXCLUDES_FEE_TYPES.has(tx.type) ? -(rawAmt + fee) : -rawAmt
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
