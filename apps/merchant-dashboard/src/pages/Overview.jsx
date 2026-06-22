import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import RevenueChart from '../components/charts/RevenueChart'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNavigate } from 'react-router-dom'

export default function Overview() {
  const navigate = useNavigate()
  const { showAmounts, togglePrivacy } = usePrivacyMode()
  const { merchant } = useMerchantAuth()
  
  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [trustData, setTrustData] = useState(null)
  const [activeTimeframe, setActiveTimeframe] = useState('7D')
  const [showMoveMoney, setShowMoveMoney] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const [txRes, trustRes] = await Promise.all([
          axios.get(`${API_URL}/api/transactions`),
          axios.get(`${API_URL}/api/trust-score`).catch(() => ({ data: { current: 0, eligibleForAdvance: false } }))
        ])
        setLiveTransactions(txRes.data)
        setTrustData(trustRes.data)
      } catch (err) {
        console.error('Failed to fetch dashboard data', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (merchant) {
      fetchData()
    } else {
      setIsLoading(false)
    }
  }, [merchant])

  // Dynamic calculations
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthAgo = new Date(today)
  monthAgo.setMonth(today.getMonth() - 1)

  const todaysRevenue = liveTransactions
    .filter(t => t.type === 'inbound' && new Date(t.createdAt) >= today)
    .reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0)

  const thisMonthRevenue = liveTransactions
    .filter(t => t.type === 'inbound' && new Date(t.createdAt) >= monthAgo)
    .reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0)

  const totalTransactionsCount = liveTransactions.length
  
  const recentTx = liveTransactions.filter(t => t.type === 'inbound').slice(0, 5)

  // Chart Logic scaffolding (empty if no data)
  const hasData = liveTransactions.length > 0
  const timeframes = {
    '7D': {
      labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      data: hasData ? [0, 0, 0, 0, 0, todaysRevenue, todaysRevenue] : [0,0,0,0,0,0,0] // Simplified for mock removal
    },
    '30D': {
      labels: ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'],
      data: hasData ? [0, 0, 0, thisMonthRevenue] : [0,0,0,0]
    },
    '6M': {
      labels: ['OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'],
      data: [0, 0, 0, 0, 0, 0]
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (isLoading) {
    return (
      <MerchantLayout title="Overview">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MerchantLayout>
    )
  }

  return (
    <MerchantLayout title="Overview">
      {/* Greeting */}
      <section className="mb-6 px-1 lg:px-0 overflow-hidden">
        <h2 className="font-headline font-bold text-[24px] sm:text-3xl lg:text-4xl text-primary tracking-tight leading-tight whitespace-nowrap">
          {getGreeting()}, {merchant?.businessName?.split(' ')[0] || 'Merchant'}. 👋
        </h2>
        <p className="text-on-surface-variant text-[11px] lg:text-sm mt-1.5 opacity-80 font-medium leading-relaxed">Here's how your business is doing today.</p>
      </section>

      {/* Section 1: Balance Cards Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms] relative z-20">
        {/* KES Balance Card */}
        <div className="bg-[#00351D] text-white p-6 lg:p-7 rounded-[16px] shadow-2xl relative z-20 group border border-white/5">
          <div className="absolute inset-0 overflow-hidden rounded-[16px] pointer-events-none">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <span className="bg-[#1F4D3C] text-[#5EFEB3] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Business Till Account</span>
              <div className="flex items-center gap-3 lg:gap-4 text-[8px] lg:text-[9px]">
                <span className="text-white/40 uppercase font-bold tracking-[0.15em] hidden sm:inline">Paybill: 400200 | Acc: {merchant?.paybillAccount || '...'}</span>
                <button
                  onClick={togglePrivacy}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-base lg:text-lg leading-none">
                    {showAmounts ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className={`font-headline font-bold text-3xl lg:text-4xl tracking-tighter tabular-nums mb-1 transition-all duration-300 ${!showAmounts && 'blur-lg grayscale'}`}>
                {formatKES(merchant?.kesBalance || 0)}
              </h3>
              <div className={`flex items-center gap-2 text-[#5EFEB3] font-bold text-[9px] lg:text-[10px] tracking-wide transition-all duration-300 ${!showAmounts && 'blur-sm grayscale'}`}>
                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                <span>+{formatKES(todaysRevenue)} today</span>
              </div>
            </div>

            <div className="flex gap-3 lg:gap-4 mt-6 lg:mt-8 relative">
              <button 
                onClick={() => setShowMoveMoney(!showMoveMoney)}
                className={`flex-1 py-2 px-4 ${showMoveMoney ? 'bg-white text-[#00351D]' : 'bg-white/5 hover:bg-white/10 text-white'} rounded-xl text-[9px] lg:text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest leading-none flex items-center justify-center gap-2 z-50`}
              >
                Move money
                <span className={`material-symbols-outlined text-xs leading-none transition-transform duration-300 ${showMoveMoney ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              
              {showMoveMoney && (
                <>
                  {/* Backdrop for closing */}
                  <div className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]" onClick={() => setShowMoveMoney(false)}></div>
                  
                  {/* Floating Action Menu */}
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-4 w-[calc(100vw-4rem)] sm:w-[280px] bg-white rounded-[20px] shadow-[0_25px_70px_rgba(0,0,0,0.4)] border border-slate-200 z-[100] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 ease-out overflow-hidden">
                    <div className="bg-[#F8FAFC] px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Operation</span>
                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Secure</span>
                    </div>
                    
                    <div className="p-1.5 space-y-0.5">
                      <button onClick={() => navigate('/send-money')} className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-xl transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-[#00351D] text-[#5EFEB3] flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-lg">send_money</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#00351D]">Send Money</p>
                              <span className="material-symbols-outlined text-slate-300 text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1">via M-pesa or Bank</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="bg-[#0D2444] text-white p-6 lg:p-7 rounded-[16px] shadow-2xl relative z-10 overflow-hidden group border border-white/5">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <span className="bg-[#243B5C] text-[#A6C8FF] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Business Digital wallet</span>
              <button onClick={togglePrivacy} className="text-white/40 hover:text-white transition-colors p-1">
                <span className="material-symbols-outlined text-base lg:text-lg leading-none">{showAmounts ? 'visibility' : 'visibility_off'}</span>
              </button>
            </div>
            <div className="flex-1">
              <h3 className={`font-headline font-bold text-3xl lg:text-4xl tracking-tighter tabular-nums mb-2 lg:mb-3 transition-all duration-300 ${!showAmounts && 'blur-lg grayscale'}`}>
                {merchant?.usdcBalance || '0.00'} USDC
              </h3>
              <p className={`text-white/40 text-[9px] lg:text-[10px] font-bold tracking-tight opacity-70 uppercase transition-all duration-300 ${!showAmounts && 'blur-sm grayscale'}`}>
                ≈ {formatKES((merchant?.usdcBalance || 0) * 130)}
              </p>
            </div>
            <div className="flex gap-3 lg:gap-4 mt-6 lg:mt-8">
              <button onClick={() => navigate('/inflation-shield')} className="flex-1 py-3.5 px-3 lg:px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] lg:text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest leading-none">
                Swap
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-fade-in-up [animation-delay:200ms] relative z-10">
        {[
          { label: "Today's Revenue", value: formatKES(todaysRevenue), trend: "", trendColor: "text-on-surface-variant" },
          { label: "This Month", value: formatKES(thisMonthRevenue), trend: "", trendColor: "text-emerald-600" },
          { label: "Total Transactions", value: totalTransactionsCount, trend: "", trendColor: "text-on-surface-variant" },
          { label: "Trust Score", value: `${trustData?.current || 0}/100`, trend: trustData?.eligibleForAdvance ? "Eligible ✔" : "Building", trendColor: "text-emerald-600", showBadge: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 lg:p-8 rounded-[12px] border border-[#E5E7EB] shadow-sm editorial-shadow transition-all group">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <p className="text-[9px] lg:text-[10px] text-primary font-black uppercase tracking-widest leading-none">{stat.label}</p>
              {stat.showBadge && <span className="material-symbols-outlined text-xs text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
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
                className={`px-2 lg:px-3 py-0.5 text-[8px] lg:text-[9px] font-bold rounded-md transition-all uppercase tracking-wider ${activeTimeframe === period ? 'bg-white text-emerald-800 shadow-sm' : 'text-emerald-800/40 hover:text-emerald-800'}`}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        {/* Section 4: Recent Collections */}
        <section className="lg:col-span-2 bg-white rounded-[16px] border border-slate-300 shadow-sm editorial-shadow overflow-hidden">
          <div className="p-8 border-b border-slate-300 flex justify-between items-center">
            <h3 className="font-headline font-bold text-3xl text-primary">Recent Transactions</h3>
          </div>
          <div className="flex flex-col">
            {recentTx.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant font-medium">
                No recent transactions found.
              </div>
            ) : (
              recentTx.map(tx => (
                <div key={tx._id || tx.id} className="px-4 lg:px-8 py-4 lg:py-5 flex items-center justify-between hover:bg-[#00351D] transition-all group cursor-pointer border-b border-slate-300">
                  <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden font-black text-primary text-[10px] lg:text-xs border border-white/20 shadow-sm transition-all duration-300 shrink-0">
                      {tx.senderName ? tx.senderName.substring(0, 2).toUpperCase() : 'TX'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] lg:text-sm font-black text-primary leading-tight group-hover:text-white transition-colors truncate">{tx.senderName || 'Customer'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] lg:text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 group-hover:text-white/40 group-hover:opacity-100 transition-colors truncate">REF: {tx.receiptNumber || tx.reference}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[13px] lg:text-sm font-black text-emerald-700 group-hover:text-[#5EFEB3] transition-colors leading-none mb-1">
                      +{formatKES(tx.kesAmount || tx.amount || 0)}
                    </p>
                    <p className="text-[9px] lg:text-[10px] text-on-surface-variant font-black opacity-30 tracking-widest group-hover:text-white/30 transition-colors uppercase">
                      {new Date(tx.createdAt || tx.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 text-center bg-surface-container-low/30 border-t border-slate-300">
            <button onClick={() => navigate('/transactions')} className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] hover:underline transition-all">View All Transactions</button>
          </div>
        </section>

        {/* Section 5: Cash Advance & Tips */}
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-[16px] border border-[#E5E7EB] border-t-4 border-t-[#00351D] shadow-sm editorial-shadow text-center">
            <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-emerald-600/50">account_balance_wallet</span>
            </div>
            <h4 className="font-headline text-xl font-bold text-primary mb-2">Unlock Cash Advances</h4>
            <p className="text-sm text-on-surface-variant mb-6">Process payments through your Paybill to build your Trust Score and unlock instant liquidity.</p>
            <button onClick={() => navigate('/cash-advance')} className="w-full py-3 bg-[#00351D] text-white rounded-xl text-[11px] font-bold hover:brightness-110 transition-all shadow-lg uppercase tracking-widest">
              Learn More
            </button>
          </section>

          <section className="bg-[#E6FFFA] p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-emerald-100 shrink-0">
              <span className="material-symbols-outlined text-emerald-600 text-lg">lightbulb</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-[0.2em] mb-1">Growth Tip</p>
              <p className="text-[11px] text-emerald-900 leading-snug font-medium opacity-80">Instruct your customers to use Paybill {merchant?.paybillAccount || '...'} to increase your daily volume.</p>
            </div>
          </section>
        </div>
      </div>
    </MerchantLayout>
  )
}
