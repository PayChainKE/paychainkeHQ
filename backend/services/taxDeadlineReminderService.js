import TaxDeadline from '../models/TaxDeadline.js';
import Admin from '../models/Admin.js';
import { nextOccurrence, periodKeyFor } from '../utils/taxDeadlines.js';
import { sendTaxDeadlineReminderEmail } from '../utils/resend.js';

// Mechanically identical to dormancyReminderService.js: a lead-time window
// plus a one-shot marker checked before sending. The one deliberate
// divergence — the marker here is a *calendar period key* ("2026-08" for a
// monthly deadline, "2026" for annual — see periodKeyFor) rather than a
// last-activity timestamp, since a filing deadline re-arms off the calendar
// rolling to the next period, not off any merchant/admin activity.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function checkAndSendTaxDeadlineReminders() {
  try {
    const deadlines = await TaxDeadline.find({ active: true }).lean();
    if (deadlines.length === 0) return;

    const now = new Date();
    let remindersSent = 0;

    for (const deadline of deadlines) {
      const due = nextOccurrence(deadline, now);
      if (!due) continue; // misconfigured (missing the fields its recurrence needs) — skip rather than throw

      const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / MS_PER_DAY);
      if (daysRemaining < 0 || daysRemaining > deadline.reminderLeadDays) continue;

      const periodKey = periodKeyFor(deadline, due);
      if (deadline.lastReminderSentForPeriod === periodKey) continue; // already sent for this occurrence

      const owners = await Admin.find({ role: 'owner', status: 'active' }).select('email');
      await Promise.all(
        owners.map((owner) =>
          sendTaxDeadlineReminderEmail(owner.email, deadline, due, daysRemaining).catch((e) =>
            logEvent('error', 'tax_deadline_reminder_failed', { email: owner.email, deadlineId: String(deadline._id), error: e.message })
          )
        )
      );
      await TaxDeadline.updateOne({ _id: deadline._id }, { $set: { lastReminderSentForPeriod: periodKey } });
      remindersSent += 1;
    }

    if (remindersSent > 0) {
      logEvent('info', 'tax_deadline_check_completed', { scanned: deadlines.length, remindersSent });
    }
  } catch (err) {
    // Same convention as every other background sweep in this codebase — a
    // failed check must never crash or block the API.
    logEvent('error', 'tax_deadline_check_failed', { message: err?.message || String(err) });
  }
}
