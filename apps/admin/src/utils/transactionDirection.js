// Direct port of apps/merchant-dashboard/src/utils/transactionDirection.js —
// single source of truth for "is this transaction money coming in or going
// out" and for the true, fee-corrected balance impact of a settled
// transaction. Needed here so admin-generated statements compute the same
// running/closing balance a merchant would see on their own dashboard,
// instead of a naive sum of the raw `amount` field. Keep in sync with the
// merchant-dashboard original if either changes — same underlying
// Transaction schema, same NCBA fee quirks.

const CREDIT_TYPES = new Set(['inbound', 'top_up', 'ncba_inbound']);
const SWAP_TYPES = new Set(['fx_swap']);
const SETTLED_STATUSES = new Set(['completed', 'verified']);
const CREDIT_STORES_GROSS_TYPES = new Set(['ncba_inbound']);
const DEBIT_EXCLUDES_FEE_TYPES = new Set(['ncba_outbound', 'ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc', 'mpesa_b2c', 'mpesa_b2b']);

export function isSettledStatus(status) {
  return SETTLED_STATUSES.has(status);
}

export function isCreditTransaction(type) {
  return CREDIT_TYPES.has(type);
}

export function isSwapTransaction(type) {
  return SWAP_TYPES.has(type);
}

export function isDebitTransaction(type) {
  return !isCreditTransaction(type) && !isSwapTransaction(type);
}

export function netBalanceImpact(tx) {
  if (!isSettledStatus(tx.status)) return 0;
  const rawAmt = tx.kesAmount || tx.amount || 0;
  const fee = (tx.paychainFee || 0) + (tx.safaricomFee || 0);
  if (isCreditTransaction(tx.type)) {
    return CREDIT_STORES_GROSS_TYPES.has(tx.type) ? rawAmt - fee : rawAmt;
  }
  if (isSwapTransaction(tx.type)) {
    return -(tx.kesAmount || 0);
  }
  return DEBIT_EXCLUDES_FEE_TYPES.has(tx.type) ? -(rawAmt + fee) : -rawAmt;
}

// Drops a fake duplicate credit AND its correction entry as a matched pair —
// see the merchant-dashboard original's doc comment for the 2026-08-27
// incident this guards against. Safe to call on any list; a no-op when no
// REVERSAL- rows are present.
export function excludeReversedDuplicates(transactions) {
  const reversedOriginalRefs = new Set();
  for (const t of transactions) {
    if (typeof t.reference === 'string' && t.reference.startsWith('REVERSAL-')) {
      reversedOriginalRefs.add(t.reference.slice('REVERSAL-'.length));
    }
  }
  if (reversedOriginalRefs.size === 0) return transactions;
  return transactions.filter((t) => {
    if (reversedOriginalRefs.has(t.reference)) return false;
    if (typeof t.reference === 'string' && t.reference.startsWith('REVERSAL-') && reversedOriginalRefs.has(t.reference.slice('REVERSAL-'.length))) return false;
    return true;
  });
}
