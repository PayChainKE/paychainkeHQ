export function formatKES(n){
  if (n == null) return 'KES 0';
  return `KES ${Number(n).toLocaleString()}`;
}

export function formatUSD(n){
  if (n == null) return '$0';
  return `$${Number(n).toLocaleString()}`;
}
