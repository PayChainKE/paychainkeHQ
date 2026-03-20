export function formatKES(n){ if (n==null) return 'KES 0'; return `KES ${Number(n).toLocaleString()}` }
export function formatUSDC(n){ if (n==null) return '0.00 USDC'; return `${Number(n).toFixed(2)} USDC` }
