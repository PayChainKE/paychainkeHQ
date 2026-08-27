// Shared "on [date] at [time]" formatting for payment SMS, in the style
// every M-Pesa confirmation text uses (e.g. "12/7/26 at 2:09 PM"). Used
// across M-Pesa and NCBA controllers so every payment SMS in the app reads
// consistently, always from the bank/telco's own authoritative transaction
// timestamp when one is available — never the server's receive time,
// except as a last-resort fallback.
//
// Recognizes two real formats supplied by our integrations:
//   - M-Pesa TransTime:      YYYYMMDDhhmmss (14 digits, 4-digit year)
//   - NCBA TransTime:        YYMMDDhhmm     (10 digits, 2-digit year, no seconds)
// Both are already Kenya-local (EAT) wall-clock digits straight from the
// bank/telco — parsed directly from the string below, never through a Date
// object, so the displayed value can't be affected by whatever timezone the
// server process happens to be running in.
//
// Anything else (missing, malformed, or a flow with no transaction
// timestamp field at all — e.g. the NCBA JSON reconciliation webhook, or a
// B2C/bulk-pay completion) falls back to the actual current moment,
// explicitly converted to Africa/Nairobi (EAT, UTC+3). Confirmed live
// 2026-08-27: this used to read `new Date()`'s components directly
// (.getHours()/.getDate()), which return the SERVER's local timezone —
// Render runs UTC, 3 hours behind Kenya — so a Mobile Money payout sent at
// the real Kenya-local time of 10:47 AM produced an SMS reading "7:04 am".
function to12Hour(hour24) {
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 || 12;
  return { hour12, period };
}

const NAIROBI_TZ_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Nairobi',
  year: '2-digit',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatTransactionDateTime(rawTimestamp) {
  const str = String(rawTimestamp ?? '').trim();

  if (/^\d{14}$/.test(str)) {
    const day = Number(str.slice(6, 8));
    const month = Number(str.slice(4, 6));
    const year = str.slice(2, 4);
    const minute = str.slice(10, 12);
    const { hour12, period } = to12Hour(Number(str.slice(8, 10)));
    return { date: `${day}/${month}/${year}`, time: `${hour12}:${minute} ${period}` };
  }

  if (/^\d{10}$/.test(str)) {
    const day = Number(str.slice(4, 6));
    const month = Number(str.slice(2, 4));
    const year = str.slice(0, 2);
    const minute = str.slice(8, 10);
    const { hour12, period } = to12Hour(Number(str.slice(6, 8)));
    return { date: `${day}/${month}/${year}`, time: `${hour12}:${minute} ${period}` };
  }

  const parts = NAIROBI_TZ_FORMATTER.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    date: `${get('day')}/${get('month')}/${get('year')}`,
    time: `${get('hour')}:${get('minute')} ${get('dayPeriod')}`,
  };
}
