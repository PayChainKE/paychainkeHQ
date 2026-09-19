// Recurring-slot math for admin automations. Kenya (EAT) is UTC+3 all year —
// no daylight saving — so a fixed offset is exact. `days` are weekday numbers
// as JS counts them in EAT (0 = Sunday … 6 = Saturday); `time` is "HH:MM" in
// EAT. All returned Dates are real instants (UTC), ready to store or compare.

export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function parseTimeOfDay(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

export function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

// The latest slot at or before `now`, or null if the schedule is empty/invalid.
export function mostRecentSlot(now, days, time) {
  const t = parseTimeOfDay(time);
  const ds = normalizeDays(days);
  if (!t || ds.length === 0) return null;
  const eatNow = new Date(now.getTime() + EAT_OFFSET_MS);
  for (let back = 0; back <= 7; back++) {
    const c = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate() - back, t.h, t.m));
    if (ds.includes(c.getUTCDay()) && c.getTime() <= eatNow.getTime()) {
      return new Date(c.getTime() - EAT_OFFSET_MS);
    }
  }
  return null;
}

// The earliest slot strictly after `now`, or null if the schedule is empty/invalid.
export function nextSlot(now, days, time) {
  const t = parseTimeOfDay(time);
  const ds = normalizeDays(days);
  if (!t || ds.length === 0) return null;
  const eatNow = new Date(now.getTime() + EAT_OFFSET_MS);
  for (let ahead = 0; ahead <= 7; ahead++) {
    const c = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate() + ahead, t.h, t.m));
    if (ds.includes(c.getUTCDay()) && c.getTime() > eatNow.getTime()) {
      return new Date(c.getTime() - EAT_OFFSET_MS);
    }
  }
  return null;
}
