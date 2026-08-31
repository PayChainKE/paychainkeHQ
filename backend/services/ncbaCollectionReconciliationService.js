import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import MissedNcbaCollectionCandidate from '../models/MissedNcbaCollectionCandidate.js';
import { getNcbaAccountStatement } from './ncbaOpenBankingService.js';
import { extractMerchantCode } from '../utils/ncbaAccountNotificationValidators.js';

// PayChain's only way of finding out a merchant got paid is NCBA's
// real-time account-notification webhook (ncbaAccountNotificationController.js)
// firing for that credit. If it never fires — or fires and gets silently
// dropped — nothing else in the system notices, because no Transaction ever
// gets created in the first place. Unlike a stuck OUTBOUND payout (which at
// least leaves a 'pending' Transaction row for
// ncbaOpenBankingReconciliationService.js's sweep to flag), a missed INBOUND
// collection leaves zero trace. Confirmed real 2026-08-31: Delamere Dairy
// Farm was paid KES 3,000 (M-Pesa ref UHVCT58LFU) that showed up on NCBA's
// own statement but never reached PayChain at all — only surfaced because
// the merchant complained and an admin checked NCBA's portal by hand.
//
// This sweep is the proactive fix: periodically pull the real NCBA account
// statement and cross-check every credit against PayChain's own Transaction
// records, using the exact same 8-digit merchant-code attribution the
// real-time webhook itself relies on (extractMerchantCode) — so a sweep
// candidate is only ever raised when we're just as confident about which
// merchant it belongs to as the webhook would have been. A credit that
// can't be attributed to a specific merchant this way (interest, an
// inter-account transfer between PayChain's own accounts, a revenue sweep
// confirmation, etc.) is silently skipped, not flagged — matching how the
// real-time webhook already ignores anything it can't attribute
// (ncba_account_notification_unattributed) rather than guessing.
//
// Deliberately does NOT auto-credit. Narrative-text attribution is less
// certain than the real-time webhook's own structured fields, and this is
// real money — a candidate is only ever a suggestion for an admin to review
// and apply (or dismiss) via the existing Credit Missed Collection tool
// (ncbaAccountNotificationController.js#adminManualCreditNcbaCollection),
// which has its own independent dedup checks before anything actually
// touches a balance.

// Money-IN Transaction types a real collection could have landed under —
// broader than just 'ncba_inbound' since an STK-collected payment can also
// settle as 'top_up' or plain 'inbound' depending on which flow resolved it
// (see mpesaController.js#resolveStkOutcome). Used only to check "was this
// merchant already credited around this amount/time," not to create
// anything.
const INBOUND_TYPES = ['ncba_inbound', 'inbound', 'top_up'];

// Wide on purpose — this runs as an hourly post-hoc sweep, not a live race,
// so there's no cost to being generous. NCBA's own webhook has been
// observed landing 45-70 minutes late relative to other confirmation
// signals for the same payment (see ncbaLedgerService.js's
// wasAlreadySettledByStkPush comment) — a narrow window here would
// re-flag a collection that's just running late through the normal path,
// creating false "missed" candidates for something that's actually fine.
const ALREADY_CREDITED_WINDOW_MS = 4 * 60 * 60 * 1000;

// How far back each sweep run looks on the real statement. Wider than the
// run interval (see server.js) so a transient NCBA statement API failure on
// one run doesn't create a permanent blind spot — the next successful run
// re-covers the gap. statementReference's unique index means re-scanning
// the same days repeatedly can never create duplicate candidates.
const LOOKBACK_DAYS = 3;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function reconcileMissedNcbaCollections() {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let statement;
  try {
    statement = await getNcbaAccountStatement({ fromDate, toDate });
  } catch (err) {
    // Expected locally/in any environment without live NCBA credentials
    // configured (NcbaOpenBankingValidationError: "No NCBA account number
    // configured") — this sweep only does anything useful where the real
    // credentials live (production). Any other failure still just skips
    // this run; LOOKBACK_DAYS covers the gap on the next one.
    logEvent('warn', 'ncba_collection_reconciliation_statement_unavailable', { error: err.message });
    return;
  }

  if (!statement.entries) {
    // Sandbox/simulated mode, or NCBA returned a non-success ErrorCode.
    logEvent('info', 'ncba_collection_reconciliation_skipped_no_entries', { raw: statement.raw?.ErrorCode || null });
    return;
  }

  const credits = statement.entries.filter((e) => typeof e.credit === 'number' && e.credit > 0);
  if (credits.length === 0) return;

  let flagged = 0;
  let alreadyKnown = 0;
  let unattributed = 0;

  for (const entry of credits) {
    try {
      // Already-known candidate from a prior run — statementReference is
      // the unique key, so this is a cheap short-circuit.
      const reference = entry.reference || `${entry.seq || ''}-${entry.valueDate || ''}-${entry.credit}`;
      const existingCandidate = await MissedNcbaCollectionCandidate.exists({ statementReference: reference });
      if (existingCandidate) { alreadyKnown++; continue; }

      const codeMatch = extractMerchantCode({ narrative: entry.description, customerName: null });
      if (!codeMatch?.code) { unattributed++; continue; }

      const merchant = await Merchant.findOne({ ncbaMerchantCode: codeMatch.code }).select('_id ncbaMerchantCode');
      if (!merchant) { unattributed++; continue; }

      // Was this merchant already credited this same amount through any
      // normal path (webhook, STK, reconciliation push) somewhere in or
      // just around the lookback window? If so, this statement entry is
      // already accounted for — just under a different reference string
      // than what's on the bank statement. Deliberately spans the whole
      // lookback window (not a tight window around entry.valueDate) —
      // NCBA's own ValueDate format isn't reliably parseable here, and
      // erring generous only risks under-flagging a genuine miss (still
      // recoverable by hand), never an unsafe outcome, since this sweep
      // never moves money on its own either way.
      const alreadyCredited = await Transaction.findOne({
        merchantId: merchant._id,
        type: { $in: INBOUND_TYPES },
        status: 'completed',
        kesAmount: entry.credit,
        createdAt: { $gte: new Date(fromDate.getTime() - ALREADY_CREDITED_WINDOW_MS), $lte: new Date(toDate.getTime() + ALREADY_CREDITED_WINDOW_MS) },
      }).select('_id');
      if (alreadyCredited) { alreadyKnown++; continue; }

      await MissedNcbaCollectionCandidate.findOneAndUpdate(
        { statementReference: reference },
        {
          $setOnInsert: {
            statementReference: reference,
            statementDescription: entry.description || null,
            statementDate: entry.valueDate || null,
            amount: entry.credit,
            matchedMerchantId: merchant._id,
            matchedMerchantCode: codeMatch.code,
            status: 'pending',
          },
        },
        { upsert: true }
      );
      flagged++;
      logEvent('warn', 'ncba_collection_reconciliation_flagged', {
        reference, amount: entry.credit, merchantId: merchant._id.toString(), merchantCode: codeMatch.code,
      });
    } catch (err) {
      logEvent('error', 'ncba_collection_reconciliation_entry_error', { error: err.message, entry });
    }
  }

  logEvent('info', 'ncba_collection_reconciliation_summary', {
    totalCredits: credits.length, flagged, alreadyKnown, unattributed,
  });
}
