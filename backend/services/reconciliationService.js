import BankReconciliation from '../models/BankReconciliation.js';
import Admin from '../models/Admin.js';
import { computeExpectedPoolBalance } from './revenueSweepService.js';
import { sendReconciliationAlertEmail } from '../utils/resend.js';

// Rounding noise across many independently-rounded transaction amounts can
// add up to a few cents; anything past this is a real gap, not float drift.
const TOLERANCE = 1;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

// Records one reconciliation check against a human-reported real balance.
// Unlike the revenue sweep (which runs unattended and notifies on every
// outcome so nothing is missed silently), this is always admin-initiated —
// whoever ran it already sees the result in the API response immediately,
// so we only push an out-of-band alert to every owner when something is
// actually wrong, not on every routine clean check.
export async function recordReconciliation({ reportedBalance, note, checkedBy }) {
  const { merchantBalanceTotal, merchantCount, unsweptRevenue, expectedPoolBalance } = await computeExpectedPoolBalance();

  const difference = Math.round((Number(reportedBalance) - expectedPoolBalance) * 100) / 100;
  const status = Math.abs(difference) <= TOLERANCE ? 'matched' : 'discrepancy';

  const record = await BankReconciliation.create({
    reportedBalance: Number(reportedBalance),
    merchantBalanceTotal,
    merchantCount,
    unsweptRevenue,
    expectedPoolBalance,
    difference,
    status,
    note: note || null,
    checkedBy,
  });

  if (status === 'discrepancy') {
    logEvent('error', 'reconciliation_discrepancy', { difference, expectedPoolBalance, reportedBalance });
    Admin.find({ role: 'owner', status: 'active' }).select('email').then((owners) => {
      Promise.all(
        owners.map((owner) =>
          sendReconciliationAlertEmail(owner.email, record).catch((e) =>
            logEvent('error', 'reconciliation_alert_failed', { email: owner.email, error: e.message })
          )
        )
      );
    }).catch((e) => logEvent('error', 'reconciliation_alert_lookup_failed', { error: e.message }));
  } else {
    logEvent('info', 'reconciliation_matched', { difference, expectedPoolBalance, reportedBalance });
  }

  return record;
}
