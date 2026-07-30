export function formatDateISO(s){
  try{ return new Date(s).toLocaleString() }catch(e){return s}
}

export function formatShortDate(iso){
  const d=new Date(iso)
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Manually-built date/time strings — deliberately NOT toLocaleString()/
// toLocaleDateString(), which format according to the viewer's browser
// locale (a merchant on a French- or US-locale browser would see a
// different date/time shape than one on en-KE). Transaction rows need the
// exact same "30 Jul 2026" / "02:15 PM" everywhere, for every viewer.
export function formatTxDate(s) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function formatTxTime(s) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}
