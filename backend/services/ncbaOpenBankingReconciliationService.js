import Transaction from '../models/Transaction.js';
import { resolvePendingOpenBankingTransaction } from '../controllers/ncbaOpenBankingController.js';

// NCBA Open Banking's async rails (Mobile B2W, Lipa na M-Pesa, KPLC/NCWSC
// bill payments) are documented as resolving "via a later callback" to
// /webhooks/ncba-openbanking-callback — but in practice that callback has
// been observed to never arrive for real Mobile B2W payouts, leaving the
// Transaction 'pending' forever with the merchant's balance already
// debited and nothing ever delivered to the recipient. PesaLink/RTGS
// aren't in this list — they resolve synchronously in the submit response
// and never reach 'pending' in the first place.
const ASYNC_RAIL_TYPES = ['ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc'];

// Generous relative to how fast these rails normally resolve when the
// callback does arrive (seconds to low minutes) — this only exists to
// catch the case where no callback is ever coming.
const STUCK_AFTER_MS = 20 * 60 * 1000;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// Finds Open Banking async-rail Transactions still 'pending' long after
// submission and resolves each one as failed (refund + notify + SMS),
// via the exact same code path a real FAILED callback would drive. Safe
// to run repeatedly and concurrently with real callbacks arriving —
// resolvePendingOpenBankingTransaction's atomic {status:'pending'} claim
// means whichever one (a genuine late callback or this sweep) gets there
// first wins, and the other is a no-op.
export async function reconcileStuckOpenBankingPayouts() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await Transaction.find({
    type: { $in: ASYNC_RAIL_TYPES },
    status: 'pending',
    createdAt: { $lt: cutoff },
  }).select('reference type createdAt');

  if (stuck.length === 0) return;

  logEvent('warn', 'ncba_openbanking_reconciliation_found_stuck', {
    count: stuck.length,
    references: stuck.map((t) => t.reference),
  });

  for (const tx of stuck) {
    try {
      await resolvePendingOpenBankingTransaction({ reference: tx.reference, succeeded: false });
      logEvent('info', 'ncba_openbanking_reconciliation_resolved', { reference: tx.reference, type: tx.type });
    } catch (err) {
      logEvent('error', 'ncba_openbanking_reconciliation_error', { reference: tx.reference, error: err.message });
    }
  }
}
