export function formatKES(n){
  if (n == null) return 'Ksh 0.00';
  return `Ksh ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUSD(n){
  if (n == null) return '$0';
  return `$${Number(n).toLocaleString()}`;
}
