// Generate realistic mock transactions (inbound, outbound, fx_swap)
function seedRandom(seed){let s=seed%2147483647;return()=>{s=s*16807%2147483647;return (s-1)/2147483646}}
const rng = seedRandom(424242)
const names = ['Peter Otieno','Mary Wanjiku','Paul Njoroge','Grace Akinyi','Samuel Odhiambo','Catherine Muthoni','Michael Mutua','Esther Chebet','Daniel Kimani','Alice Nyambura']
function pick(arr){return arr[Math.floor(rng()*arr.length)]}
function randInt(min,max){return Math.floor(rng()*(max-min+1))+min}
function fmtKES(n){return `KES ${n.toLocaleString()}` }
function ref(prefix){const s=Math.floor(rng()*1e8).toString(36).toUpperCase().padStart(8,'0'); return `${prefix}${s}`}
function daysAgo(days){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString()}

const inbound = Array.from({length:100}).map((_,i)=>{
  const amount = randInt(50,15000)
  const name = pick(names)
  return {
    id:`txn_in_${i}`,
    type:'inbound',
    amount,
    sender:{name,phone:`07${randInt(100,999)} ${randInt(100,999)} ${randInt(100,999)}`},
    reference: ref('QJX'),
    status:'verified',
    channel:'M-PESA',
    tillNumber:'PC847291',
    description: ['Grocery purchase','Goods payment','Invoice settlement','Wholesale order'][i%4],
    timestamp: daysAgo(randInt(0,89)),
    onChainHash: `0x${Math.floor(rng()*1e16).toString(16)}`,
    verifiedAt: new Date().toISOString()
  }
})

const outbound = Array.from({length:30}).map((_,i)=>{
  const amount = randInt(500,150000)
  return {
    id:`txn_out_${i}`,
    type:'outbound',
    amount,
    recipient:{name: pick(names), phone:`07${randInt(100,999)} ${randInt(100,999)} ${randInt(100,999)}`},
    reference: ref('BLK'),
    status:'completed',
    channel:'M-PESA',
    description:['Bulk Pay — payroll','Supplier payment','Utility bill'][i%3],
    timestamp: daysAgo(randInt(0,89))
  }
})

const fx = Array.from({length:20}).map((_,i)=>{
  const kes = randInt(20000,100000)
  const rate = 130 + Math.round(rng()*50)/100
  const usdc = +( (kes / rate) .toFixed(2))
  const fee = Math.round(kes*0.005)
  return {
    id:`txn_fx_${i}`,
    type:'fx_swap',
    kesAmount:kes,
    usdcAmount:usdc,
    rate,
    fee,
    status:'completed',
    timestamp: daysAgo(randInt(0,180))
  }
})

export const transactionsData = [...inbound,...outbound,...fx]

export function getTransactionStats(){
  const now=new Date()
  const today = transactionsData.filter(t=> new Date(t.timestamp).toDateString()===now.toDateString())
  const week = transactionsData.filter(t=> (now - new Date(t.timestamp)) < 7*24*3600*1000)
  const sum = arr=>arr.reduce((s,o)=>s + (o.amount || o.kesAmount || 0),0)
  return {
    todayCount: today.length,
    todayVolume: sum(today),
    weekCount: week.length,
    weekVolume: sum(week)
  }
}
