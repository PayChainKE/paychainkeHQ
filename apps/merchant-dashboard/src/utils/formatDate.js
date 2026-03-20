export function formatDateISO(s){
  try{ return new Date(s).toLocaleString() }catch(e){return s}
}

export function formatShortDate(iso){
  const d=new Date(iso)
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
}
