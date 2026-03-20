export function formatDateISO(s){
  try{ return new Date(s).toLocaleString() }catch(e){return s}
}
export function formatDateISO(iso){ const d=new Date(iso); return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }
export function formatShortDate(iso){ const d=new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) }
