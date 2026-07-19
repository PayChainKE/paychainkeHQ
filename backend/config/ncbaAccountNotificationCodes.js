// NCBA's "Account-Level Notification Push Service" fires on ~200+
// transaction type codes covering EVERY debit/credit that can hit
// PayChain's NCBA account — loan drawdowns, LC commissions, securities
// trades, cheque processing, ATM reversals, and so on. The vast majority
// have nothing to do with a merchant receiving a payment. Only codes in
// this file are ever looked up against a merchant and credited; everything
// else is acknowledged (so NCBA doesn't retry) and otherwise ignored.
//
// Credit vs. debit direction does NOT need to be inferred from this list —
// per NCBA's technical guide, TransAmount itself carries the sign
// (positive = credit, negative = debit). This list only gates *relevance*
// (is this plausibly a customer payment into a Virtual Account at all),
// not direction.
//
// IMPORTANT: this list was built from a covering email's code glossary
// (label text only, e.g. "876=MPESA Transfer Credit"), NOT the transaction
// type table from the technical guide itself. Confirm against real UAT
// test transactions before depending on it in production — a code missing
// from this set silently drops a real merchant payment; the fix is a
// one-line addition here.
export const RECONCILABLE_TXN_TYPES = new Set([
  '500', // Payment Credit
  '506', // Payment Credit
  '876', // MPESA Transfer Credit
  '883', // e-MPESA Transfer
  '886', // Pesalink Transfer
  '887', // Pesalink Transfer
  '549', // Internal Transfer
  '550', // Internal Transfer
  '171', // Payment Credit (confirmed via Rose Soy UAT test, FTC260715IUTY)
]);

export function isReconcilableTxnType(transType) {
  return RECONCILABLE_TXN_TYPES.has(String(transType ?? '').trim());
}
