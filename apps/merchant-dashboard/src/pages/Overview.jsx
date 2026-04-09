import React, { useState, useEffect } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import StatCard from '../components/ui/StatCard'
import RevenueChart from '../components/charts/RevenueChart'
import { mockMerchant } from '../mockData/merchant'
import { revenueByDay } from '../mockData/analytics'
import { transactionsData, getTransactionStats } from '../mockData/transactions'
import { formatKES } from '../utils/formatCurrency'

export default function Overview() {
  const [stats, setStats] = useState(getTransactionStats())
  const [fraudAlerts, setFraudAlerts] = useState(0) // Logic scaffolding
  const [settlementBalance, setSettlementBalance] = useState(0) // Logic scaffolding
  
  useEffect(() => {
    // Logic scaffolding: Simulate data loading or calculation
    const totalTransactions = mockMerchant.financials.totalTransactions
    const alerts = 0 // In a real app, this would come from an API
    const settlement = mockMerchant.financials.kesBalance + (mockMerchant.financials.usdcBalance * 130)
    
    setFraudAlerts(alerts)
    setSettlementBalance(settlement)
  }, [])

  const recentTx = transactionsData.filter(t => t.type === 'inbound').slice(0, 5)

  return (
    <MerchantLayout title="Overview">
      {/* Greeting */}
      <section className="mb-4">
        <h2 className="font-headline text-4xl text-primary tracking-tight">Good morning, {mockMerchant.name.split(' ')[0]}. 👋</h2>
        <p className="text-on-surface-variant text-sm mt-1.5 opacity-80 font-medium">Here's how {mockMerchant.businessName} is doing today.</p>
      </section>

      {/* Section 1: Balance Cards Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms]">
        {/* KES Balance Card */}
        <div className="bg-[#00351D] text-white p-9 rounded-[24px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-16">
              <span className="bg-[#1F4D3C] text-[#5EFEB3] px-5 py-1.5 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase border border-white/10">Primary Ledger</span>
              <span className="text-white/40 text-[9px] uppercase font-bold tracking-[0.15em]">Till: {mockMerchant.tillNumber}</span>
            </div>
            <h3 className="font-headline text-6xl tracking-tighter tabular-nums mb-6">KES 184,250</h3>
            <div className="flex items-center gap-2 text-[#5EFEB3] font-bold text-xs tracking-wide">
              <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 1"}}>trending_up</span>
              <span>+KES 18,450 today</span>
            </div>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="bg-[#0D2444] text-white p-9 rounded-[24px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-16">
              <span className="bg-[#243B5C] text-[#A6C8FF] px-5 py-1.5 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase border border-white/10">Global Settlements</span>
            </div>
            <div className="flex-1">
              <h3 className="font-headline text-6xl tracking-tighter tabular-nums mb-3">312.50 USDC</h3>
              <p className="text-white/40 text-sm font-bold tracking-tight">≈ {formatKES(mockMerchant.financials.usdcBalance * 130)}</p>
            </div>
            <div className="flex gap-4 mt-12">
              <button className="flex-1 py-4 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-bold transition-all border border-white/10 tracking-wide">Swap KES → USDC</button>
              <button className="flex-1 py-4 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-bold transition-all border border-white/10 tracking-wide">Send USDC</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up [animation-delay:200ms]">
        {[
          { label: "Today's Revenue", value: "KES 18,450", trend: "12 payments processed", trendColor: "text-on-surface-variant" },
          { label: "This Month", value: "KES 284,500", trend: "↓ 14% vs last month", trendColor: "text-red-500" },
          { label: "Total Transactions", value: "847", trend: "Since October 2025", trendColor: "text-on-surface-variant" },
          { label: "Trust Score", value: "74/100", trend: "Cash Advance Eligible ✔", trendColor: "text-emerald-600", showBadge: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[20px] border border-[#E5E7EB] shadow-sm editorial-shadow transition-all group">
            <div className="flex justify-between items-center mb-6">
              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60 leading-none">{stat.label}</p>
              {stat.showBadge && <span className="material-symbols-outlined text-xs text-emerald-600" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>}
            </div>
            <p className="text-3xl font-headline text-primary mb-2 leading-none">{stat.value}</p>
            <p className={`text-[10px] ${stat.trendColor} font-bold tracking-tight opacity-90`}>{stat.trend}</p>
          </div>
        ))}
      </section>

      {/* Section 3: Revenue Chart */}
      <section className="bg-white p-8 rounded-[20px] border border-[#E5E7EB] shadow-sm editorial-shadow">
        <div className="flex justify-between items-center mb-10">
          <h3 className="font-headline text-3xl text-primary">Revenue Overview</h3>
          <div className="flex bg-[#F0FDF4] p-1 rounded-lg border border-emerald-100">
            <button className="px-5 py-1.5 text-[10px] font-bold rounded-md bg-white text-emerald-800 shadow-sm transition-all uppercase tracking-wider">7D</button>
            <button className="px-5 py-1.5 text-[10px] font-bold text-emerald-800/40 hover:text-emerald-800 transition-all uppercase tracking-wider">30D</button>
            <button className="px-5 py-1.5 text-[10px] font-bold text-emerald-800/40 hover:text-emerald-800 transition-all uppercase tracking-wider">6M</button>
          </div>
        </div>
        <div className="h-96 w-full">
          <RevenueChart labels={['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']} data={revenueByDay.data} accentColor="#00855D" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section 4: Recent Collections */}
        <section className="lg:col-span-2 bg-white rounded-[20px] border border-[#E5E7EB] shadow-sm editorial-shadow overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="font-headline text-3xl text-primary">Recent Collections</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { id: 1, name: 'Mary Wanjiku', ref: 'QJX8472KL', amount: 4250, time: '2 min ago', initials: 'MW', color: 'bg-emerald-100' },
              { id: 2, name: 'John Okoth', ref: 'ZXC9021MM', amount: 1200, time: '15 min ago', initials: 'JO', color: 'bg-blue-100' },
              { id: 3, name: 'Sarah Njoki', ref: 'BNM3382LL', amount: 850, time: '42 min ago', initials: 'SN', color: 'bg-amber-100' },
              { id: 4, name: 'Evans Kiprono', ref: 'PLM992OSS', amount: 12500, time: '1 hour ago', initials: 'EK', color: 'bg-indigo-100' },
              { id: 5, name: 'Alice Nyambura', ref: 'VFR4451PP', amount: 2100, time: '2 hours ago', initials: 'AN', color: 'bg-purple-100' }
            ].map(tx => (
              <div key={tx.id} className="px-8 py-5 flex items-center justify-between hover:bg-surface-container-low transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${tx.color} flex items-center justify-center overflow-hidden font-bold text-primary text-xs border border-white/20 shadow-sm`}>
                    {tx.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug">{tx.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider opacity-60">REF: {tx.ref}</p>
                  </div>
                </div>
                <div className="flex items-center gap-10 text-right">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Verified</span>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-700">+{formatKES(tx.amount)}</p>
                    <p className="text-[10px] text-on-surface-variant font-bold opacity-50 tracking-tight">{tx.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-6 text-center bg-surface-container-low/30 border-t border-slate-50">
            <button className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] hover:underline transition-all">View All Collections</button>
          </div>
        </section>

        {/* Section 5: Cash Advance & Tips */}
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-[20px] border border-[#E5E7EB] shadow-sm editorial-shadow">
            <div className="flex justify-between items-center mb-8">
              <p className="text-on-surface-variant text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">Active Cash Advance</p>
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'wght' 300" }}>account_balance_wallet</span>
            </div>
            <h4 className="font-headline text-4xl text-primary mb-8">KES 150,000</h4>
            <div className="space-y-6">
              <div className="w-full bg-[#F0FDF4] h-2 rounded-full overflow-hidden border border-emerald-50">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-on-surface-variant opacity-70">KES 67,500 repaid</p>
                <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">45% complete</p>
              </div>
              <div className="p-4 bg-[#F0FDF4]/50 rounded-xl border border-emerald-100/50">
                <p className="text-[10px] text-on-surface-variant leading-relaxed font-medium">
                  Repayment rate is set to <span className="text-emerald-800 font-bold">8% of daily collections</span>. You are on track to finish 4 days early.
                </p>
              </div>
              <button className="w-full py-4 bg-[#00351D] text-white rounded-xl text-[11px] font-bold hover:brightness-110 transition-all shadow-lg uppercase tracking-widest">
                Manage Advance
              </button>
            </div>
          </section>

          <section className="bg-[#E6FFFA] p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-emerald-100 shrink-0">
              <span className="material-symbols-outlined text-emerald-600 text-lg">lightbulb</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-[0.2em] mb-1">Growth Tip</p>
              <p className="text-[11px] text-emerald-900 leading-snug font-medium opacity-80">Boost your trust score to 80 to unlock KES 250,000 limits.</p>
            </div>
          </section>
        </div>
      </div>

      {/* Section 6: Quick Actions Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
        {[
          { icon: 'add_card', label: 'Request Advance' },
          { icon: 'send_money', label: 'Send Bulk Pay' },
          { icon: 'swap_horiz', label: 'Swap to USDC' },
          { icon: 'insights', label: 'View Trust Score' }
        ].map((action, idx) => (
          <button key={idx} className="flex flex-col items-center justify-center p-8 bg-white rounded-[20px] border border-[#E5E7EB] shadow-sm hover:border-emerald-200 hover:bg-[#F0FDF4] transition-all group active:scale-95">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] mb-4 flex items-center justify-center border border-emerald-50 group-hover:bg-white transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">{action.icon}</span>
            </div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest leading-none">{action.label}</span>
          </button>
        ))}
      </section>
    </MerchantLayout>
  )
}
