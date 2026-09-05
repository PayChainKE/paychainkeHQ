const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Manually-built date/time strings — deliberately NOT toLocaleString()/
// toLocaleDateString(), which format according to the device's locale (a
// merchant on a phone set to a different region would see a different
// date/time shape than one on en-KE). Transaction rows need the exact same
// "30 Jul 2026" / "02:15 PM" everywhere, for every viewer. Mirrors
// apps/merchant-dashboard/src/utils/formatDate.js so both apps read the
// same transaction the same way.
export function formatTxDate(s?: string | number | Date | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function formatTxTime(s?: string | number | Date | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}
