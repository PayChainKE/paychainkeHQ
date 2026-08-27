// Shared "when is this due" math for TaxDeadline documents — imported by
// both the reminder sweep (services/taxDeadlineReminderService.js) and the
// deadline-listing endpoint (controllers/taxDeadlineController.js) so the
// two paths can never disagree about a deadline's next occurrence.

// Africa/Nairobi is UTC+3 year-round (no DST) — KRA deadlines are Nairobi
// calendar days, not whatever day it happens to be on the server process's
// own clock (Render's Node process runs in UTC). Mirrors
// services/revenueSweepService.js's identical EAT_OFFSET_MS pattern and the
// same reasoning: without this, "is today the 20th" would disagree with
// Nairobi for a ~3-hour window every day (Nairobi rolls into a new
// calendar day 3 hours before UTC does).
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Nairobi midnight (00:00 EAT) for the Nairobi calendar day `from` falls
// on, expressed as the correct underlying UTC instant.
function nairobiMidnight(from) {
  const shifted = new Date(from.getTime() + EAT_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - EAT_OFFSET_MS);
}

// A UTC instant representing Nairobi midnight on the given Nairobi
// calendar (year, month 0-11, day) — the EAT equivalent of `new Date(y,m,d)`.
function nairobiDate(year, month, day) {
  return new Date(Date.UTC(year, month, day) - EAT_OFFSET_MS);
}

// Nairobi calendar (year, month 0-11, day) that a UTC instant falls on.
function nairobiYmd(instant) {
  const shifted = new Date(instant.getTime() + EAT_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/**
 * The next date (today included) this deadline falls due, in Nairobi
 * calendar terms, or null if the deadline is missing the fields its
 * recurrence type needs.
 *
 * @param {{recurrence: string, dayOfMonth?: number, annualMonth?: number, annualDay?: number, oneOffDate?: Date}} deadline
 * @param {Date} [from]
 * @returns {Date|null}
 */
export function nextOccurrence(deadline, from = new Date()) {
  const today = nairobiMidnight(from);

  if (deadline.recurrence === 'one_off') {
    return deadline.oneOffDate ? nairobiMidnight(deadline.oneOffDate) : null;
  }

  const { year, month } = nairobiYmd(today);

  if (deadline.recurrence === 'monthly') {
    if (!deadline.dayOfMonth) return null;
    let candidate = nairobiDate(year, month, deadline.dayOfMonth);
    if (candidate < today) {
      candidate = nairobiDate(year, month + 1, deadline.dayOfMonth);
    }
    return candidate;
  }

  if (deadline.recurrence === 'annual') {
    if (!deadline.annualMonth || !deadline.annualDay) return null;
    let candidate = nairobiDate(year, deadline.annualMonth - 1, deadline.annualDay);
    if (candidate < today) {
      candidate = nairobiDate(year + 1, deadline.annualMonth - 1, deadline.annualDay);
    }
    return candidate;
  }

  return null;
}

/**
 * Stable key identifying WHICH occurrence of a recurring deadline a given
 * date belongs to — "2026-08" for a monthly deadline, "2026" for an annual
 * one, in Nairobi calendar terms. Used as the reminder sweep's idempotency
 * marker: once a reminder is sent for a given period key, it won't send
 * again until the period rolls over. A one_off deadline only ever has a
 * single occurrence, so its own id is used as the (permanently stable) key.
 *
 * @param {{recurrence: string, _id: any}} deadline
 * @param {Date|null} occurrenceDate
 * @returns {string|null}
 */
export function periodKeyFor(deadline, occurrenceDate) {
  if (deadline.recurrence === 'one_off') return String(deadline._id);
  if (!occurrenceDate) return null;
  const { year, month } = nairobiYmd(occurrenceDate);
  if (deadline.recurrence === 'monthly') {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  if (deadline.recurrence === 'annual') {
    return String(year);
  }
  return null;
}
