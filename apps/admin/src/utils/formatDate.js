export function formatDateISO(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(iso){
  const d = new Date(iso); const diff = Date.now() - d.getTime(); const days = Math.floor(diff / (1000*60*60*24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
