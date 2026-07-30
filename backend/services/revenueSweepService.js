import Transaction from '../models/Transaction.js';
import RevenueSweep from '../models/RevenueSweep.js';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import { submitNcbaBankTransfer } from '../controllers/ncbaOpenBankingController.js';
import { sendRevenueSweepNotification } from '../utils/resend.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';

// NCBA PesaLink's own per-transfer ceiling (services/ncbaOpenBankingService.js).
// A single week's accrued fees are extremely unlikely to hit this at
// PayChain's current volume, but if they ever do, we cap the transfer
// rather than let NCBA reject it outright — the untransferred remainder
// simply stays "unswept" and goes out next run (see computeUnsweptRevenue).
const MAX_TRANSFER_AMOUNT = 999999;
const MIN_TRANSFER_AMOUNT = 50;

const destinationBankCode     = process.env.PAYCHAIN_REVENUE_BANK_CODE || null;
const destinationAccountNumber = process.env.PAYCHAIN_REVENUE_ACCOUNT_NUMBER || null;
const destinationAccountName  = process.env.PAYCHAIN_REVENUE_ACCOUNT_NAME || 'PayChain Revenue Account';

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
async function computeUnsweptRevenue() {
  const [accruedAgg, sweptAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { createdAt: { $gte: LIVE_DATA_CUTOFF }, status: { $in: ['completed', 'verified'] } } },
      { $group: { _id: null, total: { $sum: '$paychainFee' }, count: { $sum: 1 } } },
    ]),
    RevenueSweep.aggregate([
      // simulated rows never actually moved money — must not count as swept.
      { $match: { status: 'completed', simulated: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalAccrued = accruedAgg[0]?.total || 0;
  const transactionCount = accruedAgg[0]?.count || 0;
  const totalSwept = sweptAgg[0]?.total || 0;
  const unswept = Math.round((totalAccrued - totalSwept) * 100) / 100;

  return { unswept: Math.max(0, unswept), transactionCount };
}

// What the pooled NCBA account SHOULD contain right now, per PayChain's own
// ledger: every merchant's claim on it, plus PayChain's own accrued-but-not-
// yet-swept-out fee revenue. Used by reconciliationService.js to compare
// against what a human reports the real bank balance actually is — the
// only way today to catch money having left the pool through anything
// other than a merchant's own withdrawal or the revenue sweep itself.
export async function computeExpectedPoolBalance() {
  const [merchantAgg, { unswept, transactionCount }] = await Promise.all([
    Merchant.aggregate([{ $group: { _id: null, total: { $sum: '$kesBalance' }, count: { $sum: 1 } } }]),
    computeUnsweptRevenue(),
  ]);

  const merchantBalanceTotal = Math.round((merchantAgg[0]?.total || 0) * 100) / 100;
  const merchantCount = merchantAgg[0]?.count || 0;

  return {
    merchantBalanceTotal,
    merchantCount,
    unsweptRevenue: unswept,
    unsweptRevenueTransactionCount: transactionCount,
    expectedPoolBalance: Math.round((merchantBalanceTotal + unswept) * 100) / 100,
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
  const periodEnd = new Date();
  const lastRow = await RevenueSweep.findOne().sort('-createdAt');
  const periodStart = lastRow ? lastRow.periodEnd : LIVE_DATA_CUTOFF;

  const { unswept, transactionCount } = await computeUnsweptRevenue();
  const attemptedAmount = Math.min(unswept, MAX_TRANSFER_AMOUNT);

  if (!destinationBankCode || !destinationAccountNumber) {
    logEvent('warn', 'revenue_sweep_skipped_unconfigured', { unswept });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'skipped',
      failureReason: 'PAYCHAIN_REVENUE_BANK_CODE / PAYCHAIN_REVENUE_ACCOUNT_NUMBER not set yet — open the destination account first.',
    });
  }

  if (attemptedAmount < MIN_TRANSFER_AMOUNT) {
    logEvent('info', 'revenue_sweep_skipped_below_minimum', { unswept });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'skipped',
      destinationBankCode, destinationAccountNumber,
      failureReason: unswept <= 0
        ? 'No revenue accrued since the last sweep.'
        : `Accrued revenue (KES ${unswept}) is below NCBA's KES ${MIN_TRANSFER_AMOUNT} minimum transfer.`,
    });
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
    logEvent('info', 'revenue_sweep_completed', { amount: attemptedAmount, transactionId, simulated });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, amount: attemptedAmount, transactionCount,
      status: 'completed', destinationBankCode, destinationAccountNumber, ncbaReference: transactionId, simulated,
    });
  } catch (err) {
    logEvent('error', 'revenue_sweep_failed', { amount: attemptedAmount, error: err.message });
    return recordSweep({
      periodStart, periodEnd, attemptedAmount, transactionCount, status: 'failed',
      destinationBankCode, destinationAccountNumber, failureReason: err.message,
    });
  }
}

// Weekly gate — only lets a real attempt through on the configured
// weekday, and at most once per calendar day even then (so a process that
// restarts several times on sweep day doesn't spam duplicate 'skipped'
// rows; a genuine completed sweep is naturally idempotent regardless via
// computeUnsweptRevenue, so this guard is purely about noise, not safety).
export async function runWeeklyRevenueSweepIfDue() {
  const targetDay = Number.isInteger(Number(process.env.PAYCHAIN_REVENUE_SWEEP_DAY))
    ? Number(process.env.PAYCHAIN_REVENUE_SWEEP_DAY)
    : 1; // Monday
  const now = new Date();
  if (now.getDay() !== targetDay) return;

  const lastRow = await RevenueSweep.findOne().sort('-createdAt');
  if (lastRow && (now.getTime() - new Date(lastRow.createdAt).getTime()) < 20 * 60 * 60 * 1000) {
    return; // already attempted within the last 20h
  }

  await runRevenueSweep();
}
