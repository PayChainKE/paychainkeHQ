export function formatKES(n){
  if (n==null) return 'KES 0'
  return `KES ${new Intl.NumberFormat().format(n)}`
}

export function formatUSD(n){
  if (n==null) return '$0.00'
  return `$${Number(n).toFixed(2)}`
}

export function formatUSDC(n){
  if (n==null) return '0.00 USDC'
  return `${Number(n).toFixed(2)} USDC`
}
