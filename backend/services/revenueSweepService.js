import Transaction from '../models/Transaction.js';
import RevenueSweep from '../models/RevenueSweep.js';
import BankAccountCharge from '../models/BankAccountCharge.js';
import RevenueWriteOff from '../models/RevenueWriteOff.js';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import { submitNcbaBankTransfer } from '../controllers/ncbaOpenBankingController.js';
import { getNcbaChargeInquiry, getNcbaAccountBalance } from './ncbaOpenBankingService.js';
import { sendRevenueSweepNotification } from '../utils/resend.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';
import { reversedTransactionExclusionMatch } from '../utils/reversedTransactions.js';
import { excludeDemoMerchantsMatch } from '../utils/demoMerchantExclusion.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';

// NCBA PesaLink's own per-transfer ceiling (services/ncbaOpenBankingService.js).
// A single week's accrued fees are extremely unlikely to hit this at
// PayChain's current volume, but if they ever do, we cap the transfer
// rather than let NCBA reject it outright — the untransferred remainder
// simply stays "unswept" and goes out next run (see computeUnsweptRevenue).
const MAX_TRANSFER_AMOUNT = 999999;
const MIN_TRANSFER_AMOUNT = 50;

// Sole authorized destination for PayChain's revenue sweep — Paychain
// Financial Services Ltd's settlement account at NCBA. Fixed in code, not
// env-configurable: this used to be read from PAYCHAIN_REVENUE_BANK_CODE /
// PAYCHAIN_REVENUE_ACCOUNT_NUMBER, which meant a missing or wrong env var on
// the host could silently misroute or fail the sweep. Hardcoding it removes
// that failure class entirely — there is exactly one place this can ever
// point, and it can't drift between deploys or environments.
//
// bankCode '07000' is NCBA's own bank code (see NCBA_OWN_BANK_CODE in
// controllers/ncbaOpenBankingController.js) — this account lives at NCBA
// itself, so submitNcbaBankTransfer automatically routes it over NCBA's
// Internal Funds Transfer rail rather than PesaLink.
export const REVENUE_SWEEP_DESTINATION = Object.freeze({
  accountName: 'Paychain Financial Services Ltd',
  accountNumber: '1011252669',
  bankCode: '07000',
  branchCode: '129',
  swiftCode: 'CBAFKENX',
});

const destinationBankCode = REVENUE_SWEEP_DESTINATION.bankCode;
const destinationAccountNumber = REVENUE_SWEEP_DESTINATION.accountNumber;
const destinationAccountName = REVENUE_SWEEP_DESTINATION.accountName;

// Day sweeps are meant to land on — mirrors PAYCHAIN_REVENUE_SWEEP_DAY,
// 0=Sunday..6=Saturday, default Monday. Shared by runWeeklyRevenueSweepIfDue
// (gates when the weekly cron actually attempts a sweep) and
// mostRecentSweepWeekday below (anchors every sweep's displayed period to
// a clean calendar week), so both agree on what "the sweep day" means.
const SWEEP_WEEKDAY = Number.isInteger(Number(process.env.PAYCHAIN_REVENUE_SWEEP_DAY))
  ? Number(process.env.PAYCHAIN_REVENUE_SWEEP_DAY)
  : 1; // Monday

// Africa/Nairobi is UTC+3 year-round (no DST) — PayChain is a Kenya-based
// business, so "the sweep day" must mean Nairobi's calendar day, not
// whatever day it happens to be in UTC. Those disagree for a 3-hour window
// around midnight (e.g. 00:00–02:59 EAT is still the previous day in UTC),
// which is exactly when a UTC-anchored boundary would silently land a
// "Monday" sweep's period on the wrong week.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Most recent occurrence of SWEEP_WEEKDAY (today included), at Nairobi
// (EAT) midnight — e.g. run this on a Wednesday and it returns that week's
// Monday 00:00 EAT, expressed as the correct underlying UTC instant.
function mostRecentSweepWeekday(from = new Date()) {
  const nairobiShifted = new Date(from.getTime() + EAT_OFFSET_MS);
  nairobiShifted.setUTCHours(0, 0, 0, 0); // midnight in the shifted frame == midnight EAT
  const diff = (nairobiShifted.getUTCDay() - SWEEP_WEEKDAY + 7) % 7;
  nairobiShifted.setUTCDate(nairobiShifted.getUTCDate() - diff);
  return new Date(nairobiShifted.getTime() - EAT_OFFSET_MS); // back to a true UTC instant
}

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// PayChain's total accrued revenue (Σ paychainFee — the markup PayChain
// actually keeps, already net of Safaricom/NCBA pass-through cost; see
// utils/feeCalculator.js) since LIVE_DATA_CUTOFF, minus everything already
// physically swept out. Deliberately NOT time-windowed run-to-run: basing
// this on the running total rather than "since last sweep's timestamp"
// means a failed, skipped, or amount-capped run never loses track of what
// it still owes — the shortfall just carries forward automatically into
// the next computation instead of needing its own retry bookkeeping.
//
// Returns BOTH a gross and a net figure — deliberately kept separate
// (2026-09-01, after real bank/tax charges briefly outpaced accrued fee
// revenue and made the net figure sit at KES 0 for weeks even as new fees
// kept coming in):
//   - `grossUnswept`: accrued fee revenue minus what's already been
//     physically swept out. NOT reduced by real bank/tax charges — this is
//     "PayChain's earned revenue," the number that should never look like
//     it vanished to zero just because of an unrelated real cost.
//   - `netUnswept`: `grossUnswept` minus real bank/tax charges
//     (BankAccountCharge — Excise Duty, Withholding Tax, etc.) plus any
//     deliberate write-off (RevenueWriteOff — see that model's doc
//     comment). THIS is the figure actually safe to physically transfer
//     (runRevenueSweep) or use to compute the pooled account's expected
//     balance (computeExpectedPoolBalance) — it must stay charge-aware, or
//     both of those would be wrong again.
// Callers that want the admin-facing "how much has PayChain earned" KPI
// should read `grossUnswept` + `totalCharges` (shown as its own line) side
// by side, never blended into one silently-netted number.
async function computeUnsweptRevenue() {
  // See reversedTransactionExclusionMatch's doc comment — a duplicate
  // credit and its correction entry must never contribute to what this
  // function decides to physically transfer out of the pooled NCBA
  // account, regardless of what their fee fields happen to say. Same
  // reasoning for excludeDemoMerchantsMatch — the demo account's simulated
  // fees are not real revenue and must never get physically swept into
  // PayChain's corporate account.
  const [excludeReversed, excludeDemo] = await Promise.all([
    reversedTransactionExclusionMatch(),
    excludeDemoMerchantsMatch(),
  ]);
  const [accruedAgg, sweptAgg, chargesAgg, writeOffAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { createdAt: { $gte: LIVE_DATA_CUTOFF }, status: { $in: ['completed', 'verified'] }, ...excludeReversed, ...excludeDemo } },
      { $group: { _id: null, total: { $sum: '$paychainFee' }, count: { $sum: 1 } } },
    ]),
    RevenueSweep.aggregate([
      // simulated rows never actually moved money — must not count as swept.
      // Sums amount + bankChargeAmount, not just amount: a real NCBA fee on
      // the sweep transfer itself also left the pooled account for real,
      // even though it never reached PayChain's revenue account — leaving
      // it out would keep showing that fee as still "unswept" forever, when
      // it's actually gone (see getNcbaChargeInquiry's doc comment).
      { $match: { status: 'completed', simulated: { $ne: true } } },
      { $group: { _id: null, total: { $sum: { $add: ['$amount', { $ifNull: ['$bankChargeAmount', 0] }] } } } },
    ]),
    // Real NCBA/KRA-side charges not tied to any transfer — confirmed live
    // 2026-08-31 via NCBA Connect Plus: a recurring ~KES 10.80 Excise Duty
    // charge (KRA's tax on bank transaction fees) that getNcbaChargeInquiry
    // never catches, since it's a government tax layered on top, not
    // NCBA's own fee. See models/BankAccountCharge.js. `archived` is a
    // display-only filter elsewhere; every recorded charge still counts
    // here regardless.
    BankAccountCharge.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Deliberate one-time adjustments — see models/RevenueWriteOff.js.
    RevenueWriteOff.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalAccrued = accruedAgg[0]?.total || 0;
  const transactionCount = accruedAgg[0]?.count || 0;
  const totalSwept = sweptAgg[0]?.total || 0;
  const totalCharges = chargesAgg[0]?.total || 0;
  const totalWriteOffs = writeOffAgg[0]?.total || 0;

  const grossUnswept = Math.max(0, Math.round((totalAccrued - totalSwept) * 100) / 100);
  const netUnswept = Math.max(0, Math.round((grossUnswept - totalCharges + totalWriteOffs) * 100) / 100);

  return { grossUnswept, netUnswept, totalCharges, totalWriteOffs, transactionCount };
}

// What the pooled NCBA account SHOULD contain right now, per PayChain's own
// ledger: every merchant's claim on it, plus PayChain's own accrued-but-not-
// yet-swept-out fee revenue. Used by reconciliationService.js to compare
// against what a human reports the real bank balance actually is — the
// only way today to catch money having left the pool through anything
// other than a merchant's own withdrawal or the revenue sweep itself.
export async function computeExpectedPoolBalance() {
  const [merchantAgg, { grossUnswept, netUnswept, totalCharges, totalWriteOffs, transactionCount }] = await Promise.all([
    // Demo merchant's simulated kesBalance is not real money PayChain owes
    // anyone — must never inflate what the pool is expected to hold, same
    // discipline computeUnsweptRevenue below already applies to fee revenue.
    Merchant.aggregate([
      { $match: { isDemoMerchant: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$kesBalance' }, count: { $sum: 1 } } },
    ]),
    computeUnsweptRevenue(),
  ]);

  const merchantBalanceTotal = Math.round((merchantAgg[0]?.total || 0) * 100) / 100;
  const merchantCount = merchantAgg[0]?.count || 0;

  return {
    merchantBalanceTotal,
    merchantCount,
    // `unsweptRevenue`/`expectedPoolBalance` MUST stay charge-aware (net) —
    // this is the figure Pool Reconciliation cross-checks against the real
    // NCBA balance, and it must reflect real money that has actually left
    // the account. `grossUnsweptRevenue`/`bankChargesDeficit` below are the
    // separate, never-netted admin-facing figures (see
    // computeUnsweptRevenue's doc comment) — always show them side by
    // side, never substitute one for the other.
    unsweptRevenue: netUnswept,
    grossUnsweptRevenue: grossUnswept,
    bankChargesDeficit: Math.max(0, Math.round((totalCharges - totalWriteOffs) * 100) / 100),
    totalBankCharges: totalCharges,
    totalRevenueWriteOffs: totalWriteOffs,
    unsweptRevenueTransactionCount: transactionCount,
    expectedPoolBalance: Math.round((merchantBalanceTotal + netUnswept) * 100) / 100,
  };
}

// The sweep has no human approval step before it moves money (it's not
// tied to any merchant, so there's nothing to PIN-gate) — this notification
// is the only checkpoint, so every outcome (completed/failed/skipped) fires
// it, not just failures. Fire-and-forget: a notification bug should never
// block or fail the sweep record itself from being saved.
async function notifyOwners(sweep) {
  try {
    const owners = await Admin.find({ role: 'owner', status: 'active' }).select('email');
    await Promise.all(
      owners.map((owner) =>
        sendRevenueSweepNotification(owner.email, sweep).catch((e) =>
          logEvent('error', 'revenue_sweep_notification_failed', { email: owner.email, error: e.message })
        )
      )
    );
  } catch (e) {
    logEvent('error', 'revenue_sweep_notification_lookup_failed', { error: e.message });
  }
}

async function recordSweep(fields) {
  const sweep = await RevenueSweep.create(fields);
  notifyOwners(sweep).catch(() => {}); // notifyOwners already catches internally; belt-and-suspenders
  return sweep;
}

// Runs one sweep attempt. Idempotent/self-healing — safe to call more than
// once in the same window (e.g. a redeploy re-triggering the boot check):
// a run with nothing new to sweep just records a 'skipped' row and moves on.
export async function runRevenueSweep() {
  // Anchored to the calendar week (SWEEP_WEEKDAY-to-SWEEP_WEEKDAY, e.g.
  // Monday-to-Monday) rather than "whenever the previous sweep happened to
  // run" — a manual "Run Sweep Now" click mid-week previously chained off
  // the last row's periodEnd, producing lopsided few-day periods instead of
  // a normal week. Purely a display/reporting label: computeUnsweptRevenue
  // below is a running-total calculation independent of these dates, so
  // this doesn't change what actually gets swept, only how the period is
  // described.
  const periodEnd = mostRecentSweepWeekday();
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 7);

  const destinationAudit = {
    destinationBankCode, destinationAccountNumber,
    destinationBranchCode: REVENUE_SWEEP_DESTINATION.branchCode,
    destinationSwiftCode: REVENUE_SWEEP_DESTINATION.swiftCode,
  };

  // Prevents two concurrent invocations (an admin double-clicking "Run
  // Sweep Now", or a manual trigger racing the scheduled weekly check) from
  // both computing the same unswept figure and both submitting a real
  // transfer for it. That would move real merchant money out of the pooled
  // account, not just PayChain's own revenue — computeExpectedPoolBalance
  // above treats the pool as merchant balances + unswept fees, so
  // over-sweeping drains merchant funds along with it. Reuses the same
  // atomic unique-index claim every merchant payout already relies on
  // (utils/idempotencyGuard.js) instead of a bespoke lock; the window only
  // needs to outlast one sweep attempt (well under a minute in practice).
  try {
    await claimPayoutSubmission('revenue-sweep', ['run'], { windowSeconds: 120 });
  } catch (e) {
    if (e instanceof DuplicateSubmissionError) {
      logEvent('warn', 'revenue_sweep_already_in_progress', {});
      return recordSweep({
        periodStart, periodEnd, attemptedAmount: 0, transactionCount: 0, status: 'skipped',
        ...destinationAudit,
        failureReason: 'A sweep was already in progress — skipped to avoid submitting a duplicate transfer.',
      });
    }
    throw e;
  }

  // Physically transferring must always use the charge-aware net figure —
  // never the gross admin-facing one (see computeUnsweptRevenue's doc
  // comment) — real bank/tax charges have already left the account for
  // real, so only the net remainder is actually safe to move out.
  const { netUnswept, transactionCount } = await computeUnsweptRevenue();
  let attemptedAmount = Math.min(netUnswept, MAX_TRANSFER_AMOUNT);

  if (attemptedAmount < MIN_TRANSFER_AMOUNT) {
    logEvent('info', 'revenue_sweep_skipped_below_minimum', { netUnswept });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'skipped',
      ...destinationAudit,
      failureReason: netUnswept <= 0
        ? 'No revenue accrued since the last sweep.'
        : `Accrued revenue (KES ${netUnswept}) is below NCBA's KES ${MIN_TRANSFER_AMOUNT} minimum transfer.`,
    });
  }

  // Hard safety gate — protects merchant money from ANY unmodeled drain on
  // the real account (Excise Duty, a future new bank/tax charge, a ledger
  // bug — anything), not just the ones already known about. The ledger's
  // own `unswept` figure alone is never trusted to submit a real transfer:
  // it's cross-checked against what NCBA actually reports right now, and
  // capped so a sweep can never take the real balance below what's owed to
  // merchants. Fails safe (skips, doesn't guess) if the live balance can't
  // be verified — a missed sweep this week just means more accrues and
  // goes out next run (computeUnsweptRevenue is a running total); a wrong
  // guess here would risk moving merchant money.
  const merchantAgg = await Merchant.aggregate([
    { $match: { isDemoMerchant: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$kesBalance' } } },
  ]);
  const merchantBalanceTotal = Math.round((merchantAgg[0]?.total || 0) * 100) / 100;

  const { balance: liveBalance } = await getNcbaAccountBalance().catch(() => ({ balance: null }));
  if (liveBalance === null) {
    logEvent('warn', 'revenue_sweep_skipped_no_live_balance', { attemptedAmount });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'skipped',
      ...destinationAudit,
      failureReason: 'Could not verify the real NCBA balance before sweeping — skipped rather than risk transferring merchant money. Will retry next run.',
    });
  }

  const safeToSweep = Math.max(0, Math.round((liveBalance - merchantBalanceTotal) * 100) / 100);
  if (safeToSweep < attemptedAmount) {
    logEvent('warn', 'revenue_sweep_capped_by_live_balance', { attemptedAmount, liveBalance, merchantBalanceTotal, safeToSweep });
  }
  attemptedAmount = Math.min(attemptedAmount, safeToSweep);

  if (attemptedAmount < MIN_TRANSFER_AMOUNT) {
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'skipped',
      ...destinationAudit,
      failureReason: `Live balance (KES ${liveBalance}) minus merchant money owed (KES ${merchantBalanceTotal}) leaves only KES ${safeToSweep} safely sweepable — below NCBA's KES ${MIN_TRANSFER_AMOUNT} minimum. Skipped to protect merchant funds; will retry next run as the gap resolves (e.g. once it's recorded under Bank Charges).`,
    });
  }

  // What NCBA itself will charge for moving PayChain's own money — never
  // priced anywhere before this, unlike every merchant-facing rail. Fails
  // open (chargeAmount stays 0) on any error: a charge-lookup hiccup must
  // never block a real sweep, and 0 is the same conservative default this
  // codebase already uses everywhere a fee lookup isn't fully proven yet.
  let bankChargeAmount = 0;
  try {
    const { chargeAmount } = await getNcbaChargeInquiry({ transactionAmount: attemptedAmount, serviceType: 'IFT' });
    if (typeof chargeAmount === 'number' && Number.isFinite(chargeAmount) && chargeAmount >= 0) {
      bankChargeAmount = chargeAmount;
    }
  } catch (e) {
    logEvent('warn', 'revenue_sweep_charge_inquiry_failed', { amount: attemptedAmount, error: e.message });
  }

  try {
    const { transactionId, hostResponse } = await submitNcbaBankTransfer({
      businessName: 'PayChain Revenue Sweep',
      bankCode: destinationBankCode,
      accountNumber: destinationAccountNumber,
      accountName: destinationAccountName,
      amount: attemptedAmount,
      narration: `PayChain fee revenue sweep ${periodStart.toISOString().slice(0, 10)}–${periodEnd.toISOString().slice(0, 10)}`,
    });

    const simulated = hostResponse?.simulated === true;
    logEvent('info', 'revenue_sweep_completed', { amount: attemptedAmount, transactionId, simulated, bankChargeAmount });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, amount: attemptedAmount, transactionCount,
      status: 'completed', ...destinationAudit, ncbaReference: transactionId, simulated,
      bankChargeAmount: simulated ? 0 : bankChargeAmount,
    });
  } catch (err) {
    logEvent('error', 'revenue_sweep_failed', { amount: attemptedAmount, error: err.message });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'failed',
      ...destinationAudit, failureReason: err.message,
    });
  }
}

// Weekly gate — only lets a real attempt through on the configured
// weekday, and at most once per calendar day even then (so a process that
// restarts several times on sweep day doesn't spam duplicate 'skipped'
// rows; a genuine completed sweep is naturally idempotent regardless via
// computeUnsweptRevenue, so this guard is purely about noise, not safety).
export async function runWeeklyRevenueSweepIfDue() {
  const now = new Date();
  // Nairobi's calendar day, not UTC's — see EAT_OFFSET_MS above.
  const nairobiDay = new Date(now.getTime() + EAT_OFFSET_MS).getUTCDay();
  if (nairobiDay !== SWEEP_WEEKDAY) return;

  const lastRow = await RevenueSweep.findOne().sort('-createdAt');
  if (lastRow && (now.getTime() - new Date(lastRow.createdAt).getTime()) < 20 * 60 * 60 * 1000) {
    return; // already attempted within the last 20h
  }

  await runRevenueSweep();
}
