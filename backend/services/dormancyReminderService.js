import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { sendDormancyReminderEmail, sendDormancyFinalWarningEmail } from '../utils/resend.js';

// A merchant is "dormant" 60 days after their last real activity — login or
// a transaction, whichever is more recent, matching the same lastActivityAt
// convention the admin dashboard's activityTier already uses (see
// adminController.js's getMerchants). A reminder goes out 7 days before
// that mark (day 53); a final warning goes out the day it's crossed (day
// 60+). Both are one-shot per dormancy period: a notice's timestamp is only
// honoured while it's still >= the merchant's last activity, so any fresh
// activity since automatically re-arms both notices for the next time the
// merchant goes quiet, with no separate reset step needed.

const DORMANCY_DAYS = 60;
const REMINDER_LEAD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function checkAndSendDormancyReminders() {
  try {
    const now = new Date();

    const merchants = await Merchant.find({ status: { $ne: 'locked' } })
      .select('email name businessName createdAt lastLogin dormancyReminderSentAt dormancyFinalWarningSentAt')
      .lean();

    if (merchants.length === 0) return;

    // Last transaction per merchant, across all-time — mirrors the
    // unbounded lifetime aggregation pattern already used in
    // adminController.js (no status filter: even a pending/failed attempt
    // shows the merchant is actively trying to use the account).
    const lastTxnAgg = await Transaction.aggregate([
      { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
    ]);
    const lastTxnByMerchant = new Map(lastTxnAgg.map((r) => [String(r._id), r.lastTxnAt]));

    let remindersSent = 0;
    let warningsSent = 0;

    for (const m of merchants) {
      if (!m.email) continue;

      const lastActivityMs = [m.lastLogin, lastTxnByMerchant.get(String(m._id)), m.createdAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0);

      if (!lastActivityMs) continue;

      const daysSinceActivity = (now.getTime() - lastActivityMs) / MS_PER_DAY;

      if (daysSinceActivity >= DORMANCY_DAYS) {
        const alreadyWarned = m.dormancyFinalWarningSentAt
          && new Date(m.dormancyFinalWarningSentAt).getTime() >= lastActivityMs;
        if (alreadyWarned) continue;

        await sendDormancyFinalWarningEmail(m.email, m.name, m.businessName);
        await Merchant.updateOne({ _id: m._id }, { $set: { dormancyFinalWarningSentAt: now } });
        warningsSent += 1;
      } else if (daysSinceActivity >= DORMANCY_DAYS - REMINDER_LEAD_DAYS) {
        const alreadyReminded = m.dormancyReminderSentAt
          && new Date(m.dormancyReminderSentAt).getTime() >= lastActivityMs;
        if (alreadyReminded) continue;

        const daysRemaining = Math.max(1, Math.ceil(DORMANCY_DAYS - daysSinceActivity));
        await sendDormancyReminderEmail(m.email, m.name, m.businessName, daysRemaining);
        await Merchant.updateOne({ _id: m._id }, { $set: { dormancyReminderSentAt: now } });
        remindersSent += 1;
      }
    }

    if (remindersSent > 0 || warningsSent > 0) {
      logEvent('info', 'dormancy_check_completed', { scanned: merchants.length, remindersSent, warningsSent });
    }
  } catch (err) {
    // Same convention as the boot-time migrations — a background check
    // should never crash or block the API.
    logEvent('error', 'dormancy_check_failed', { message: err?.message || String(err) });
  }
}
