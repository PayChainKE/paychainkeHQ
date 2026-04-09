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
      <section>
        <h2 className="font-headline text-3xl text-primary tracking-tight">Good morning, {mockMerchant.name.split(' ')[0]}. 👋</h2>
        <p className="text-on-surface-variant mt-1">Here's how {mockMerchant.businessName} is doing today.</p>
      </section>

      {/* Section 1: Balance Cards Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up [animation-delay:100ms]">
        {/* KES Balance Card */}
        <div className="bg-[#00351D] text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-12">
              <span className="bg-emerald-500/20 text-emerald-300 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase border border-emerald-500/10">Primary Ledger</span>
              <span className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">Till: {mockMerchant.tillNumber}</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2">Available KES</p>
            <h3 className="font-headline text-5xl tracking-tighter tabular-nums mb-4">{formatKES(mockMerchant.financials.kesBalance)}</h3>
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <span className="material-symbols-outlined text-sm pulse" style={{fontVariationSettings: "'FILL' 1"}}>circle</span>
              <span>Real-time Verified</span>
            </div>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="bg-[#0A2540] text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-12">
              <span className="bg-blue-500/20 text-blue-300 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase border border-blue-500/10">Global Settlements</span>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300 mb-2">Total USDC</p>
              <h3 className="font-headline text-5xl tracking-tighter tabular-nums mb-2">{mockMerchant.financials.usdcBalance} USDC</h3>
              <p className="text-white/40 text-sm font-medium">≈ {formatKES(mockMerchant.financials.usdcBalance * 130)}</p>
            </div>
            <div className="flex gap-4 mt-12 pb-2">
              <button className="flex-1 py-4 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10 backdrop-blur-sm">Swap KES → USDC</button>
              <button className="flex-1 py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xs font-bold transition-all shadow-lg">Send Assets</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up [animation-delay:200ms]">
        {[
          { label: 'Today Revenue', value: formatKES(mockMerchant.financials.todayRevenue), trend: '+18.4%', bg: 'bg-emerald-500/5', icon: 'payments', text: 'text-emerald-700', sub: `${stats.todayCount} payments` },
          { label: 'Settlement Due', value: 'KES 284,500', trend: '3h left', bg: 'bg-amber-500/5', icon: 'schedule', text: 'text-amber-700', sub: 'Next batch' },
          { label: 'Protected Logic', value: formatKES(settlementBalance), trend: 'KES/USDC', bg: 'bg-blue-500/5', icon: 'shield_moon', text: 'text-blue-700', sub: 'Combined' },
          { label: 'Trust Score', value: `${mockMerchant.trustScore.current}/100`, trend: 'Secured', bg: 'bg-indigo-500/5', icon: 'center_focus_weak', text: 'text-indigo-700', sub: 'Eligible ✓' }
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-8 rounded-[32px] border border-outline-variant/10 shadow-sm editorial-shadow hover:translate-y-[-4px] transition-all cursor-pointer`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center ${stat.text} shadow-sm border border-outline-variant/5`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full bg-white/50 border border-outline-variant/10 ${stat.text}`}>{stat.trend}</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-headline text-primary">{stat.value}</p>
            <p className="text-[10px] text-on-surface-variant font-medium mt-1 uppercase tracking-tighter opacity-70">{stat.sub}</p>
          </div>
        ))}
      </section>

      {/* Section 3: Revenue Chart */}
      <section className="bg-surface-container-lowest p-8 rounded-xl editorial-shadow">
        <div className="flex justify-between items-center mb-10">
          <h3 className="font-headline text-2xl text-primary">Revenue Overview</h3>
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            <button className="px-4 py-1 text-[10px] font-bold rounded-md bg-white text-primary editorial-shadow transition-all">7D</button>
            <button className="px-4 py-1 text-[10px] font-bold text-on-surface-variant hover:text-primary transition-all">30D</button>
            <button className="px-4 py-1 text-[10px] font-bold text-on-surface-variant hover:text-primary transition-all">6M</button>
          </div>
        </div>
        <div className="h-64 w-full">
          <RevenueChart labels={revenueByDay.labels} data={revenueByDay.data} accentColor="#006c4e" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section 4: Recent Collections */}
        <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="font-headline text-xl text-primary">Recent Collections</h3>
          </div>
          <div className="divide-y divide-outline-variant/5">
            {recentTx.map(tx => (
              <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-high transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center overflow-hidden font-bold text-primary text-xs">
                    {tx.sender.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug">{tx.sender.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">REF: {tx.reference}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div className="flex items-center gap-1 text-secondary">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-secondary">+{formatKES(tx.amount)}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 text-center">
            <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View All Collections</button>
          </div>
        </section>

        {/* Section 5: Cash Advance Card */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-surface-container-lowest p-8 rounded-xl editorial-shadow border-t-4 border-primary">
            <div className="flex justify-between items-center mb-6">
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Active Cash Advance</p>
              <span className="material-symbols-outlined text-primary text-sm">credit_score</span>
            </div>
            <h4 className="font-headline text-3xl text-primary mb-6">{formatKES(mockMerchant.cashAdvance.currentAdvance.amount)}</h4>
            <div className="space-y-4">
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-secondary-fixed-dim h-full rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${(mockMerchant.cashAdvance.currentAdvance.repaidAmount / mockMerchant.cashAdvance.currentAdvance.amount) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-on-surface-variant">{formatKES(mockMerchant.cashAdvance.currentAdvance.repaidAmount)} repaid</p>
                <p className="text-[10px] font-extrabold text-primary">{Math.round((mockMerchant.cashAdvance.currentAdvance.repaidAmount / mockMerchant.cashAdvance.currentAdvance.amount) * 100)}% complete</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/10">
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Repayment rate is set to <span className="text-primary font-bold">{mockMerchant.cashAdvance.currentAdvance.repaymentRate}% of daily collections</span>. You are on track to finish 4 days early.
                </p>
              </div>
              <button className="w-full py-3 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                Manage Advance
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Section 6: Quick Actions Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12">
        {[
          { icon: 'add_card', label: 'Request Advance' },
          { icon: 'send_money', label: 'Send Bulk Pay' },
          { icon: 'swap_horiz', label: 'Swap to USDC' },
          { icon: 'insights', label: 'View Trust Score' }
        ].map((action, idx) => (
          <button key={idx} className="flex flex-col items-center justify-center p-6 bg-white rounded-xl editorial-shadow group hover:bg-primary transition-all">
            <div className="w-12 h-12 rounded-full bg-surface-container mb-3 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:text-white transition-colors">{action.icon}</span>
            </div>
            <span className="text-xs font-bold text-on-surface group-hover:text-white">{action.label}</span>
          </button>
        ))}
      </section>
    </MerchantLayout>
  )
}
