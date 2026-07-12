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
// Anything else (missing, malformed, or a flow with no transaction
// timestamp field at all — e.g. the NCBA JSON reconciliation webhook, or a
// B2C/bulk-pay completion) falls back to the current time, which is
// accurate for those cases since they're processed at essentially the
// moment the event actually happens.
export function formatTransactionDateTime(rawTimestamp) {
  const str = String(rawTimestamp ?? '').trim();
  let d;

  if (/^\d{14}$/.test(str)) {
    d = new Date(
      Number(str.slice(0, 4)),
      Number(str.slice(4, 6)) - 1,
      Number(str.slice(6, 8)),
      Number(str.slice(8, 10)),
      Number(str.slice(10, 12)),
      Number(str.slice(12, 14))
    );
  } else if (/^\d{10}$/.test(str)) {
    d = new Date(
      2000 + Number(str.slice(0, 2)),
      Number(str.slice(2, 4)) - 1,
      Number(str.slice(4, 6)),
      Number(str.slice(6, 8)),
      Number(str.slice(8, 10))
    );
  } else {
    d = new Date();
  }

  const date = `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time };
}
