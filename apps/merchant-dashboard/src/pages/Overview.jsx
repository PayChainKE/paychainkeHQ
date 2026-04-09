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
  const [activeTimeframe, setActiveTimeframe] = useState('7D')
  
  const timeframes = {
    '7D': {
      labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      data: revenueByDay.data
    },
    '30D': {
      labels: ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'],
      data: [84000, 72000, 95000, 110000]
    },
    '6M': {
      labels: ['OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'],
      data: [240000, 280000, 310000, 290000, 350000, 420000]
    }
  }

  useEffect(() => {
    localStorage.setItem('paychain_privacy_mode', JSON.stringify(showAmounts))
    window.dispatchEvent(new Event('paychain_privacy_toggle'))
  }, [showAmounts])

  useEffect(() => {
    // Logic scaffolding: Simulate data loading or calculation
    const totalTransactions = mockMerchant.financials.totalTransactions
    const alerts = 0 // In a real app, this would come from an API
    const settlement = mockMerchant.financials.kesBalance + (mockMerchant.financials.usdcBalance * 130)
    
    setFraudAlerts(alerts)
    setSettlementBalance(settlement)
  }, [])

  const recentTx = transactionsData.filter(t => t.type === 'inbound').slice(0, 5)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <MerchantLayout title="Overview">
      {/* Greeting */}
      <section className="mb-6 px-1 lg:px-0">
        <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">{getGreeting()}, {mockMerchant.name.split(' ')[0]}. 👋</h2>
        <p className="text-on-surface-variant text-[11px] lg:text-sm mt-1.5 opacity-80 font-medium leading-relaxed">Here's how {mockMerchant.businessName} is doing today.</p>
      </section>

      {/* Section 1: Balance Cards Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms]">
        {/* KES Balance Card */}
        <div className="bg-[#00351D] text-white p-6 lg:p-7 rounded-[16px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <span className="bg-[#1F4D3C] text-[#5EFEB3] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Primary Ledger</span>
              <div className="flex items-center gap-3 lg:gap-4 text-[8px] lg:text-[9px]">
                <span className="text-white/40 uppercase font-bold tracking-[0.15em] hidden sm:inline">Till: {mockMerchant.tillNumber}</span>
                <button 
                  onClick={() => setShowAmounts(!showAmounts)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                  title={showAmounts ? "Hide Amounts" : "Show Amounts"}
                >
                  <span className="material-symbols-outlined text-base lg:text-lg leading-none">
                    {showAmounts ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 lg:gap-0 mb-8 lg:mb-10">
              <div>
                <h3 className={`font-headline font-bold text-3xl lg:text-4xl tracking-tighter tabular-nums mb-1 transition-all duration-300 ${!showAmounts && 'blur-lg grayscale'}`}>KES 184,250</h3>
                <div className={`flex items-center gap-2 text-[#5EFEB3] font-bold text-[9px] lg:text-[10px] tracking-wide transition-all duration-300 ${!showAmounts && 'blur-sm grayscale'}`}>
                  <span className="material-symbols-outlined text-[10px]" style={{fontVariationSettings: "'FILL' 1"}}>trending_up</span>
                  <span>+KES 18,450 today</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="bg-[#0D2444] text-white p-6 lg:p-7 rounded-[16px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <span className="bg-[#243B5C] text-[#A6C8FF] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Global Settlements</span>
              <button 
                onClick={() => setShowAmounts(!showAmounts)}
                className="text-white/40 hover:text-white transition-colors p-1"
                title={showAmounts ? "Hide Amounts" : "Show Amounts"}
              >
                <span className="material-symbols-outlined text-base lg:text-lg leading-none">
                  {showAmounts ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
            <div className="flex-1">
              <h3 className={`font-headline font-bold text-3xl lg:text-4xl tracking-tighter tabular-nums mb-2 lg:mb-3 transition-all duration-300 ${!showAmounts && 'blur-lg grayscale'}`}>312.50 USDC</h3>
              <p className={`text-white/40 text-[9px] lg:text-[10px] font-bold tracking-tight opacity-70 uppercase transition-all duration-300 ${!showAmounts && 'blur-sm grayscale'}`}>≈ {formatKES(mockMerchant.financials.usdcBalance * 130)}</p>
            </div>
            <div className="flex gap-3 lg:gap-4 mt-6 lg:mt-8">
              <button className="flex-1 py-3 px-3 lg:px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] lg:text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest leading-none">Swap</button>
              <button className="flex-1 py-3 px-3 lg:px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] lg:text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest leading-none">Send</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-fade-in-up [animation-delay:200ms]">
        {[
          { label: "Today's Revenue", value: "KES 18,450", trend: "12 payments", trendColor: "text-on-surface-variant" },
          { label: "This Month", value: "KES 284,500", trend: "↓ 14% vs last", trendColor: "text-red-500" },
          { label: "Total Transactions", value: "847", trend: "Since Oct 2025", trendColor: "text-on-surface-variant" },
          { label: "Trust Score", value: "74/100", trend: "Eligible ✔", trendColor: "text-emerald-600", showBadge: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 lg:p-8 rounded-[12px] border border-[#E5E7EB] shadow-sm editorial-shadow transition-all group">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <p className="text-[9px] lg:text-[10px] text-primary font-black uppercase tracking-widest leading-none">{stat.label}</p>
              {stat.showBadge && <span className="material-symbols-outlined text-xs text-emerald-600" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>}
            </div>
            <p className="text-2xl lg:text-3xl font-headline text-primary mb-2 leading-none">{stat.value}</p>
            <p className={`text-[9px] lg:text-[10px] ${stat.trendColor} font-bold tracking-tight opacity-90`}>{stat.trend}</p>
          </div>
        ))}
      </section>

      {/* Section 3: Revenue Chart */}
      <section className="bg-white p-4 lg:p-5 rounded-[12px] border border-[#E5E7EB] shadow-sm editorial-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 lg:mb-5">
          <h3 className="font-headline font-bold text-lg lg:text-xl text-primary">Revenue Overview</h3>
          <div className="flex bg-[#F0FDF4] p-0.5 rounded-md border border-emerald-100 self-end lg:self-auto">
            {['7D', '30D', '6M'].map((period) => (
              <button 
                key={period}
                onClick={() => setActiveTimeframe(period)}
                className={`px-2 lg:px-3 py-0.5 text-[8px] lg:text-[9px] font-bold rounded-md transition-all uppercase tracking-wider ${
                  activeTimeframe === period 
                  ? 'bg-white text-emerald-800 shadow-sm' 
                  : 'text-emerald-800/40 hover:text-emerald-800'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48 lg:h-60 w-full">
          <RevenueChart 
            labels={timeframes[activeTimeframe].labels} 
            data={timeframes[activeTimeframe].data} 
            key={activeTimeframe} 
            accentColor="#00855D" 
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section 4: Recent Collections */}
        <section className="lg:col-span-2 bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm editorial-shadow overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="font-headline font-bold text-3xl text-primary">Recent Collections</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { id: 1, name: 'Mary Wanjiku', ref: 'QJX8472KL', amount: 4250, time: '2 min ago', initials: 'MW', color: 'bg-emerald-100' },
              { id: 2, name: 'John Okoth', ref: 'ZXC9021MM', amount: 1200, time: '15 min ago', initials: 'JO', color: 'bg-blue-100' },
              { id: 3, name: 'Sarah Njoki', ref: 'BNM3382LL', amount: 850, time: '42 min ago', initials: 'SN', color: 'bg-amber-100' },
              { id: 4, name: 'Evans Kiprono', ref: 'PLM992OSS', amount: 12500, time: '1 hour ago', initials: 'EK', color: 'bg-indigo-100' },
              { id: 5, name: 'Alice Nyambura', ref: 'VFR4451PP', amount: 2100, time: '2 hours ago', initials: 'AN', color: 'bg-purple-100' }
            ].map(tx => (
              <div key={tx.id} className="px-8 py-5 flex items-center justify-between hover:bg-[#00351D] transition-all group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${tx.color} flex items-center justify-center overflow-hidden font-bold text-primary text-xs border border-white/20 shadow-sm group-hover:bg-white/10 group-hover:text-white group-hover:border-white/10 transition-colors`}>
                    {tx.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug group-hover:text-white transition-colors">{tx.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider opacity-60 group-hover:text-white/60 transition-colors">REF: {tx.ref}</p>
                  </div>
                </div>
                <div className="flex items-center gap-10 text-right">
                  <div className="flex items-center gap-1.5 text-emerald-600 group-hover:text-[#5EFEB3] transition-colors">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Verified</span>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-700 group-hover:text-[#5EFEB3] transition-colors">+{formatKES(tx.amount)}</p>
                    <p className="text-[10px] text-on-surface-variant font-bold opacity-50 tracking-tight group-hover:text-white/40 transition-colors">{tx.time}</p>
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
          <section className="bg-white p-8 rounded-[16px] border border-[#E5E7EB] border-t-4 border-t-[#00351D] shadow-sm editorial-shadow">
            <div className="flex justify-between items-center mb-8">
              <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Active Cash Advance</p>
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
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 pb-20">
        {[
          { icon: 'add_card', label: 'Request Advance' },
          { icon: 'send_money', label: 'Send Bulk Pay' },
          { icon: 'swap_horiz', label: 'Swap USDC' },
          { icon: 'insights', label: 'Trust Score' }
        ].map((action, idx) => (
          <button key={idx} className="flex flex-col items-center justify-center p-6 lg:p-8 bg-white rounded-[16px] lg:rounded-[20px] border border-[#E5E7EB] border-t-2 border-t-[#00351D] shadow-sm hover:bg-[#00351D] hover:border-[#00351D] transition-all group active:scale-95">
            <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-[#F0FDF4] mb-3 lg:mb-4 flex items-center justify-center border border-emerald-50 group-hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:text-[#5EFEB3] text-xl lg:text-2xl group-hover:scale-110 transition-all">{action.icon}</span>
            </div>
            <span className="text-[9px] lg:text-[11px] font-bold text-primary uppercase tracking-widest leading-none group-hover:text-white transition-colors">{action.label}</span>
          </button>
        ))}
      </section>
    </MerchantLayout>
  )
}
