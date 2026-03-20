export function exportCSV(filename, rows){
  if(!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r=> keys.map(k=> `"${String(r[k] ?? '')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
