// Single source of truth for "is this transaction money coming in or going
// out" — used everywhere a transaction's amount, sign, or color is
// rendered (Dashboard, Collections, Transactions, DigitalWallet) so real
// NCBA-routed transactions (ncba_inbound/ncba_outbound — the type actual
// live NCBA virtual account payments use, not just the legacy 'inbound'/
// 'outbound') are classified the same way everywhere. Mirrors
// apps/merchant-dashboard/src/utils/transactionDirection.js exactly.

export type TxType =
  | 'inbound'
  | 'outbound'
  | 'bulk_pay'
  | 'settlement'
  | 'fx_swap'
  | 'top_up'
  | 'withdrawal'
  | 'ncba_inbound'
  | 'ncba_outbound'
  | string;

const CREDIT_TYPES = new Set(['inbound', 'top_up', 'ncba_inbound']);
const SWAP_TYPES = new Set(['fx_swap']);
// Everything else (outbound, withdrawal, bulk_pay, settlement,
// ncba_outbound, and any future debit type) is treated as money leaving.

// A 'failed' or still-'pending' transaction never actually moved money — a
// failed payout gets refunded (backend's resolvePendingOpenBankingTransaction)
// and a pending one hasn't landed yet. Only 'completed' and 'verified' (the
// same pairing the backend's own revenue/reporting queries use) represent a
// real, permanent balance change — statement/total/running-balance math must
// check this before adding a row's amount, or a failed attempt gets counted
// as if it went through. Mirrors
// apps/merchant-dashboard/src/utils/transactionDirection.js exactly.
const SETTLED_STATUSES = new Set(['completed', 'verified']);

export function isSettledStatus(status: string | undefined | null): boolean {
  return !!status && SETTLED_STATUSES.has(status);
}

export function isCreditTransaction(type: TxType): boolean {
  return CREDIT_TYPES.has(type);
}

export function isSwapTransaction(type: TxType): boolean {
  return SWAP_TYPES.has(type);
}

// Debit = money leaving that isn't a swap. Defined as "not credit, not
// swap" (rather than its own hardcoded list) so a future debit type is
// correctly classified everywhere by default.
export function isDebitTransaction(type: TxType): boolean {
  return !isCreditTransaction(type) && !isSwapTransaction(type);
}

export function getAmountSign(type: TxType): '+' | '-' | '±' {
  if (isCreditTransaction(type)) return '+';
  if (isSwapTransaction(type)) return '±';
  return '-';
}

const TYPE_LABELS: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  bulk_pay: 'Bulk Pay',
  settlement: 'Settlement',
  fx_swap: 'FX Swap',
  top_up: 'Top Up',
  withdrawal: 'Withdrawal',
  ncba_inbound: 'Inbound',
  ncba_outbound: 'Bank Transfer',
  mpesa_b2c: 'M-PESA Withdrawal',
  ncba_mobile_b2w: 'Mobile Money Withdrawal',
  mpesa_b2b: 'Paybill/Till Payout',
  ncba_lipa_na_mpesa: 'Paybill/Till Payout',
  ncba_kplc: 'KPLC Bill Payment',
  ncba_kplc_prepaid: 'KPLC Prepaid Token',
  ncba_ncwsc: 'NCWSC Bill Payment',
};

export function typeLabel(type: TxType): string {
  return TYPE_LABELS[type] || String(type).replace(/_/g, ' ');
}
