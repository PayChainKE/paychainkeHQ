import React from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import StatCard from '../components/ui/StatCard'
import RevenueChart from '../components/charts/RevenueChart'
import { mockMerchant } from '../mockData/merchant'
import { revenueByDay } from '../mockData/analytics'
import { transactionsData, getTransactionStats } from '../mockData/transactions'
import { formatKES } from '../utils/formatCurrency'

export default function Overview(){
  const stats = getTransactionStats()
  return (
    <MerchantLayout title={`Good morning, ${mockMerchant.name.split(' ')[0]}`}>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:'1 1 360px',background:'linear-gradient(135deg,#0B4D2E,#1D9E75)',color:'white',padding:20,borderRadius:12}}>
          <div style={{fontSize:12,opacity:0.9}}>KES Balance</div>
          <div style={{fontSize:36,fontWeight:700,marginTop:8}}>{formatKES(mockMerchant.financials.kesBalance)}</div>
          <div style={{marginTop:8}}>+KES {mockMerchant.financials.todayRevenue} today</div>
        </div>

        <div style={{flex:'1 1 240px',background:'#0A2540',color:'white',padding:20,borderRadius:12}}>
          <div style={{fontSize:12,opacity:0.9}}>USDC Balance</div>
          <div style={{fontSize:28,fontWeight:700,marginTop:8}}>{mockMerchant.financials.usdcBalance} USDC</div>
          <div style={{marginTop:8}}>≈ KES {Math.round(mockMerchant.financials.usdcBalance * 130)}</div>
        </div>
      </div>

      <div style={{marginTop:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <StatCard title="Today's Revenue" value={formatKES(mockMerchant.financials.todayRevenue)} hint={`+${stats.todayCount} payments`} />
          <StatCard title="This Month" value={formatKES(mockMerchant.financials.thisMonthRevenue)} hint="-14% vs last month" />
          <StatCard title="Total Transactions" value={mockMerchant.financials.totalTransactions} hint="Since Oct 2025" />
          <StatCard title="Trust Score" value={`${mockMerchant.trustScore.current}/100`} hint="Cash Advance Eligible ✓" />
        </div>
      </div>

      <div style={{marginTop:20,background:'white',padding:16,borderRadius:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:700}}>Revenue Overview</div>
          <div style={{fontSize:12,color:'#6B7280'}}>30D</div>
        </div>
        <div style={{marginTop:12}}>
          <RevenueChart labels={revenueByDay.labels} data={revenueByDay.data} />
        </div>
      </div>

      <div style={{marginTop:20,display:'flex',gap:16}}>
        <div style={{flex:1,background:'white',padding:12,borderRadius:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:700}}>Recent Collections</div>
            <a href="/transactions">View all →</a>
          </div>
          <div style={{marginTop:8}}>
            {transactionsData.filter(t=>t.type==='inbound').slice(0,8).map(tx=> (
              <div key={tx.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:700}}>{tx.sender.name}</div>
                  <div style={{fontSize:12,color:'#6B7280'}} className="mono">{tx.reference}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{color:'#16A34A',fontWeight:700}}>+KES {tx.amount}</div>
                  <div style={{fontSize:11,color:'#6B7280'}}>{new Date(tx.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{width:320,background:'white',padding:12,borderRadius:12}}>
          <div style={{fontWeight:700}}>Cash Advance</div>
          <div style={{marginTop:8}}>KES {mockMerchant.cashAdvance.currentAdvance.amount} • {mockMerchant.cashAdvance.currentAdvance.status}</div>
          <div style={{marginTop:10}}>
            <div style={{height:8,background:'#E5E7EB',borderRadius:6,overflow:'hidden'}}>
              <div style={{width:'45%',height:'100%',background:'var(--brand-accent)'}} />
            </div>
            <div style={{fontSize:12,color:'#6B7280',marginTop:8}}>Repayment rate: {mockMerchant.cashAdvance.currentAdvance.repaymentRate}% of daily collections</div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
