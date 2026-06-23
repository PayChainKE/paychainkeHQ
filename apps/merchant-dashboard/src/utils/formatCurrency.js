export function formatKES(n){
  if (n==null) return 'KES 0.00'
  return `KES ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatUSD(n){
  if (n==null) return '$0.00'
  return `$${Number(n).toFixed(2)}`
}

export function formatUSDC(n){
  if (n==null) return '0.00 USDC'
  return `${Number(n).toFixed(2)} USDC`
}
