import Transaction from '../models/Transaction.js';
import BankAccountCharge from '../models/BankAccountCharge.js';
import { getNcbaAccountStatement } from './ncbaOpenBankingService.js';

// Confirmed real 2026-08-31: PayChain's own outbound transfers (merchant
// withdrawals/payouts — Mobile B2W, Lipa na M-Pesa, KPLC, etc.) get hit
// with real NCBA/KRA-side charges — Excise Duty at minimum — the same way
// the weekly revenue sweep does, but far more often (dozens of payouts a
// day vs. one sweep a week). None of that was ever modeled or tracked,
// which is why the pool-reconciliation discrepancy kept growing (-17.60 ->
// -169.20) even after the sweep itself was fixed and protected.
//
// This sweep is the fix: pulls the real NCBA statement and looks for DEBIT
// lines that are pure bank/tax fees — not a real PayChain transfer (no
// Transaction record shares that reference) — and records them the exact
// same way the manual Bank Charges tool does, so
// revenueSweepService.js#computeUnsweptRevenue keeps subtracting them and
// the pool-reconciliation discrepancy reflects reality again automatically,
// without an admin having to keep checking NCBA Connect Plus by hand.
//
// Deliberately does NOT try to match a debit line to a SPECIFIC outbound
// payout (unlike ncbaCollectionReconciliationService.js's credit-side
// attribution) — an outbound debit's narrative describes the RECIPIENT
// (a phone number, a till, a bank account), not which PayChain merchant
// sent it, so there's no reliable equivalent of extractMerchantCode here.
// Real transfer debits are simply left alone (they already have a matching
// Transaction and are the merchant's own, already-priced cost); only the
// fee-type lines with NO matching Transaction — which can only be a bank/
// tax charge, never a real transfer — get recorded.
//
// Safe to auto-record without human review, unlike missed-collection
// credits: this never touches any merchant's balance. It only affects how
// much of the pooled account PayChain considers its own accrued revenue
// (computeUnsweptRevenue), which can only ever go DOWN as real charges are
// found — the opposite of a risk to merchant funds.

// A real transfer's narrative never contains these — they're how NCBA
// itself describes a pure fee/tax debit (TransactionCodeDescription first,
// see ncbaOpenBankingService.js#getNcbaAccountStatement). Kept broad on
// purpose: missing a real charge just means the discrepancy stays
// unexplained a little longer (recoverable), but a false positive here
// would never happen anyway since the "no matching Transaction" check
// below is what actually gates whether anything gets recorded — this list
// only decides whether to log a closer look, not whether to trust it blind.
const FEE_KEYWORDS = ['excise', 'duty', 'charge', 'commission', 'levy', 'tax', 'cot ', 'fee'];

const LOOKBACK_DAYS = 3;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function looksLikeFee(description) {
  const text = String(description || '').toLowerCase();
  return FEE_KEYWORDS.some((kw) => text.includes(kw));
}

function parseStatementDate(valueDate) {
  const parsed = new Date(valueDate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function reconcileUnrecordedBankCharges() {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let statement;
  try {
    statement = await getNcbaAccountStatement({ fromDate, toDate });
  } catch (err) {
    // Expected locally/anywhere without live NCBA credentials configured.
    logEvent('warn', 'bank_charge_reconciliation_statement_unavailable', { error: err.message });
    return;
  }

  if (!statement.entries) {
    logEvent('info', 'bank_charge_reconciliation_skipped_no_entries', { raw: statement.raw?.ErrorCode || null });
    return;
  }

  const debits = statement.entries.filter((e) => typeof e.debit === 'number' && e.debit > 0 && looksLikeFee(e.description));
  if (debits.length === 0) return;

  let recorded = 0;
  let alreadyKnown = 0;
  let hasMatchingTransfer = 0;

  for (const entry of debits) {
    try {
      const reference = entry.reference || `${entry.seq || ''}-${entry.valueDate || ''}-${entry.debit}`;
      const description = entry.description || 'Bank charge (auto-detected from NCBA statement)';

      // Confirmed live 2026-09-03: NCBA posts MULTIPLE distinct real charges
      // under the exact same statement reference for one underlying transfer
      // — e.g. a single Mobile B2W payout carries both "KE Excise Duty"
      // (KES 10.80) AND a separate "IB Mobile Transfer Charge" (KES 72,
      // never modeled anywhere before this) under one shared FTX reference.
      // Deduping on `reference` alone (the previous behavior) meant whichever
      // of these lines got processed first "claimed" that reference, and
      // every other real charge sharing it was silently treated as already
      // known and dropped forever — the KES 72 line was never once recorded
      // by this sweep, on any mobile transfer, since it launched. `amount` +
      // `description` disambiguate distinct charges that share a reference,
      // while still safely no-op'ing a genuine re-run over the same line
      // (same reference + description + amount = the same real charge).
      const dedupeMatch = { reference, description, amount: entry.debit, source: 'auto_detected' };

      const existingCharge = await BankAccountCharge.exists(dedupeMatch);
      if (existingCharge) { alreadyKnown++; continue; }

      // Belt-and-suspenders: if a real Transaction shares this exact
      // reference AND amount, this line almost certainly IS that transfer's
      // own principal, not a separate fee — skip it. Matching on amount too
      // (not reference alone) matters precisely because of the situation
      // above — NCBA legitimately posts multiple distinct real charges
      // under one shared reference, so checking reference alone would wrongly
      // skip every one of them just because the real transfer happens to
      // share their reference.
      const matchingTransfer = await Transaction.exists({ reference, amount: entry.debit });
      if (matchingTransfer) { hasMatchingTransfer++; continue; }

      await BankAccountCharge.findOneAndUpdate(
        dedupeMatch,
        {
          $setOnInsert: {
            chargedAt: parseStatementDate(entry.valueDate),
            amount: entry.debit,
            description,
            reference,
            source: 'auto_detected',
          },
        },
        { upsert: true }
      );
      recorded++;
      logEvent('warn', 'bank_charge_reconciliation_recorded', { reference, amount: entry.debit, description: entry.description });
    } catch (err) {
      logEvent('error', 'bank_charge_reconciliation_entry_error', { error: err.message, entry });
    }
  }

  logEvent('info', 'bank_charge_reconciliation_summary', {
    totalFeeLikeDebits: debits.length, recorded, alreadyKnown, hasMatchingTransfer,
  });
}
