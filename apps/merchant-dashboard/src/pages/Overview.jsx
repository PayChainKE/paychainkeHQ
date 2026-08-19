import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import RevenueChart from '../components/charts/RevenueChart'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatAccountNumber } from '../utils/formatAccountNumber'
import { formatTxDate, formatTxTime } from '../utils/formatDate'
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay'
import { formatName } from '../utils/formatName'
import { getAmountSign, getAmountColorClassWithHover, isCreditTransaction, isDebitTransaction, isSwapTransaction } from '../utils/transactionDirection'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNavigate } from 'react-router-dom'
import FundAccountModal from '../components/modals/FundAccountModal'

export default function Overview() {
  const navigate = useNavigate()
  const { showAmounts, togglePrivacy } = usePrivacyMode()
  const { merchant } = useMerchantAuth()
  
  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [trustData, setTrustData] = useState(null)
  const [activeTimeframe, setActiveTimeframe] = useState('7D')
  const [showMoveMoney, setShowMoveMoney] = useState(false)
  const [showFundAccount, setShowFundAccount] = useState(false)
  const [activeFundMethod, setActiveFundMethod] = useState(null)
  const [showDigitalWallet, setShowDigitalWallet] = useState(() => localStorage.getItem('paychain_show_wallet') !== 'false')
  const [liveRate, setLiveRate] = useState(132.45)

  // A merchant only sees the Digital Wallet card after they've provisioned a
  // Stellar wallet (presence of `stellarPublicKey`). Until then the card —
  // and its show/hide toggle — would just be a confusing empty surface.
  // Additionally, Admins can globally disable the feature for a merchant.
  const featureEnabled = merchant?.features?.digitalWallet !== false;
  const walletActivated = !!merchant?.stellarPublicKey && featureEnabled;
  const showWalletCard  = walletActivated && showDigitalWallet

  const toggleDigitalWallet = () => {
    const newVal = !showDigitalWallet
    setShowDigitalWallet(newVal)
    localStorage.setItem('paychain_show_wallet', newVal)
  }

  const fetchData = React.useCallback(async () => {
    if (!merchant) return
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')
      const config = { headers: { Authorization: `Bearer ${token}` } }

      const [txRes, trustRes] = await Promise.all([
        axios.get(`${API_URL}/api/transactions`, config),
        axios.get(`${API_URL}/api/trust-score`, config).catch(() => ({ data: { current: 0, eligibleForAdvance: false } }))
      ])
      setLiveTransactions(txRes.data)
      setTrustData(trustRes.data)
    } catch (err) {
      console.error('Failed to fetch dashboard data', err)
    } finally {
      setIsLoading(false)
    }
  }, [merchant])

  // Live USDC->KES rate for the digital wallet card's estimate — was
  // previously a hardcoded *130 multiplier that would silently drift from
  // the real market rate shown on the Wallet page.
  useEffect(() => {
    if (!merchant) return
    const fetchRate = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const token = localStorage.getItem('paychain_merchant_token')
        const res = await axios.get(`${API_URL}/api/transactions/live-rate`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data?.rate) setLiveRate(res.data.rate)
      } catch (err) {
        console.error('Failed to fetch live rate', err)
      }
    }
    fetchRate()
  }, [merchant])

  // Initial load
  useEffect(() => {
    if (merchant) fetchData()
    else setIsLoading(false)
  }, [merchant, fetchData])

  // Poll every 5s so revenue chart and recent transactions stay live
  useEffect(() => {
    if (!merchant) return
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [merchant, fetchData])

  // Also refresh instantly when the user returns to the tab
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchData])

  // Dynamic calculations
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthAgo = new Date(today)
  monthAgo.setMonth(today.getMonth() - 1)

  const todaysRevenue = liveTransactions
    .filter(t => isCreditTransaction(t.type) && new Date(t.createdAt) >= today)
    .reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0)

  const thisMonthRevenue = liveTransactions
    .filter(t => isCreditTransaction(t.type) && new Date(t.createdAt) >= monthAgo)
    .reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0)

  const recentTx = [...liveTransactions]
    .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp))
    .slice(0, 5)

  // --- Dynamic Chart Data Aggregation ---
  // Uses the same credit/debit classification as every other amount in the
  // app (transactionDirection.js) so real NCBA-routed transactions
  // (ncba_inbound/ncba_outbound) are counted here too, not just 'inbound'.
  const generateChartData = () => {
    const inboundTxs = liveTransactions.filter(t => isCreditTransaction(t.type));
    const outboundTxs = liveTransactions.filter(t => isDebitTransaction(t.type));
    const now = new Date();

    const sumFor = (txs, matches) => txs
      .filter(matches)
      .reduce((sum, t) => sum + (t.kesAmount || t.amount || 0), 0);

    // Helper to format date
    const getDayName = (date) => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
    const getMonthName = (date) => ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getMonth()];

    // 1. 7D Data
    const labels7D = [];
    const inbound7D = [];
    const outbound7D = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      labels7D.push(getDayName(d));
      const sameDay = (t) => new Date(t.createdAt).toDateString() === d.toDateString();
      inbound7D.push(sumFor(inboundTxs, sameDay));
      outbound7D.push(sumFor(outboundTxs, sameDay));
    }

    // 2. 30D Data (Last 4 weeks basically)
    const labels30D = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const inbound30D = [0, 0, 0, 0];
    const outbound30D = [0, 0, 0, 0];
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);

    const bucketByWeek = (txs, bucket) => {
      txs.forEach(t => {
        const txDate = new Date(t.createdAt);
        if (txDate >= thirtyDaysAgo) {
          const diffTime = Math.abs(now - txDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const weekIndex = 3 - Math.floor(diffDays / 7);
          if (weekIndex >= 0 && weekIndex < 4) {
            bucket[weekIndex] += (t.kesAmount || t.amount || 0);
          }
        }
      });
    };
    bucketByWeek(inboundTxs, inbound30D);
    bucketByWeek(outboundTxs, outbound30D);

    // 3. 6M Data
    const labels6M = [];
    const inbound6M = [];
    const outbound6M = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      labels6M.push(getMonthName(d));
      const sameMonth = (t) => {
        const txDate = new Date(t.createdAt);
        return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
      };
      inbound6M.push(sumFor(inboundTxs, sameMonth));
      outbound6M.push(sumFor(outboundTxs, sameMonth));
    }

    return {
      '7D': { labels: labels7D, inbound: inbound7D, outbound: outbound7D },
      '30D': { labels: labels30D, inbound: inbound30D, outbound: outbound30D },
      '6M': { labels: labels6M, inbound: inbound6M, outbound: outbound6M }
    };
  };

  const timeframes = generateChartData();

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
      <section className="mb-6 px-1 lg:px-0 overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="font-headline font-bold text-[24px] sm:text-3xl lg:text-4xl text-primary tracking-tight leading-tight whitespace-nowrap">
            {getGreeting()}, {merchant?.businessName?.split(' ')[0] || 'Merchant'}. 👋
          </h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm mt-1.5 opacity-80 font-medium leading-relaxed">Here's how your business is doing today.</p>
        </div>
        
        {walletActivated && (
          <button
            onClick={toggleDigitalWallet}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-surface-container-low transition-all shadow-sm group"
          >
            <span className={`material-symbols-outlined text-[16px] transition-colors ${showDigitalWallet ? 'text-primary/60 group-hover:text-red-500' : 'text-emerald-500'}`}>
              {showDigitalWallet ? 'visibility_off' : 'account_balance_wallet'}
            </span>
            <span className="text-[10px] font-bold text-primary opacity-80 uppercase tracking-widest">
              {showDigitalWallet ? 'Hide Wallet' : 'Show Wallet'}
            </span>
          </button>
        )}
      </section>

      {/* Section 1: Balance Cards Row */}
      <section className={`grid grid-cols-1 ${showWalletCard ? 'lg:grid-cols-2' : ''} gap-8 animate-fade-in-up [animation-delay:100ms] relative z-20`}>
        {/* KES Balance Card */}
        <div className="bg-gradient-to-br from-[#00351D] via-[#022916] to-[#011C0F] text-white p-6 lg:p-8 rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,53,29,0.5)] relative z-20 group border border-emerald-900/50 hover:border-emerald-500/30 transition-all duration-500">
          {/* Ambient Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[24px]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 rounded-full -mr-20 -mt-20 blur-[80px] group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 rounded-full -ml-20 -mb-20 blur-[60px] group-hover:scale-110 transition-transform duration-1000"></div>
          </div>
          
          {/* Card Texture/Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay rounded-[24px] overflow-hidden" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
          
          {/* Glass Top Highlight */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent rounded-t-[24px]"></div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8 lg:mb-10">
              <span className="bg-[#1F4D3C] text-[#5EFEB3] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Business Account</span>
              <div className="flex items-center gap-3 lg:gap-4 text-[8px] lg:text-[9px]">
                <span className="text-white/40 uppercase font-bold tracking-[0.15em] hidden sm:inline">Acc: {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}</span>
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

            <div className="flex gap-3 lg:gap-4 mt-8 relative">
              <button 
                onClick={() => { setShowFundAccount(!showFundAccount); setShowMoveMoney(false); }}
                className={`flex-1 py-3 px-4 ${showFundAccount ? 'bg-white text-[#00351D] shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100'} rounded-[14px] text-[10px] font-black transition-all duration-300 border border-emerald-500/20 hover:border-emerald-500/40 uppercase tracking-widest leading-none flex items-center justify-center gap-2 z-50`}
              >
                Fund Account
                <span className={`material-symbols-outlined text-sm leading-none transition-transform duration-500 ${showFundAccount ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              <button 
                onClick={() => { setShowMoveMoney(!showMoveMoney); setShowFundAccount(false); }}
                className={`flex-1 py-3 px-4 ${showMoveMoney ? 'bg-white text-[#00351D] shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100'} rounded-[14px] text-[10px] font-black transition-all duration-300 border border-emerald-500/20 hover:border-emerald-500/40 uppercase tracking-widest leading-none flex items-center justify-center gap-2 z-50`}
              >
                Move money
                <span className={`material-symbols-outlined text-sm leading-none transition-transform duration-500 ${showMoveMoney ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              
              {showFundAccount && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]" onClick={() => setShowFundAccount(false)}></div>
                  <div className="absolute left-0 sm:left-auto sm:right-auto top-full mt-4 w-[calc(100vw-4rem)] sm:w-[280px] bg-white rounded-[20px] shadow-[0_25px_70px_rgba(0,0,0,0.4)] border border-slate-200 z-[100] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 ease-out overflow-hidden">
                    <div className="bg-[#F8FAFC] px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Top-up Methods</span>
                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Secure</span>
                    </div>
                    
                    <div className="p-1.5 space-y-0.5">
                      <button onClick={() => { setActiveFundMethod('mobile'); setShowFundAccount(false); }} className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-xl transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-[#00351D] text-[#5EFEB3] flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-lg">phone_iphone</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#00351D]">Mobile Money</p>
                              <span className="material-symbols-outlined text-slate-300 text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1">M-Pesa, Airtel Money</p>
                          </div>
                        </div>
                      </button>

                      <button onClick={() => { setActiveFundMethod('bank'); setShowFundAccount(false); }} className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-xl transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-lg">account_balance</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#00351D]">Bank Account</p>
                              <span className="material-symbols-outlined text-slate-300 text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1">Direct Bank Transfer</p>
                          </div>
                        </div>
                      </button>

                      <button onClick={() => { setActiveFundMethod('paybill'); setShowFundAccount(false); }} className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-xl transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-lg">storefront</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#00351D]">Paybill</p>
                              <span className="material-symbols-outlined text-slate-300 text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1">Lipa na M-Pesa instructions</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}

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

                      <button onClick={() => navigate('/request-money')} className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-xl transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-lg">request_quote</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#00351D]">Request Money</p>
                              <span className="material-symbols-outlined text-slate-300 text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1">STK prompt or payment link</p>
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

        {/* USDC Balance Card — only after the merchant has activated their Stellar wallet */}
        {showWalletCard && (
          <div className="bg-gradient-to-br from-[#0A162B] via-[#050B14] to-[#02050A] text-white p-6 lg:p-8 rounded-[24px] shadow-[0_20px_40px_-15px_rgba(10,22,43,0.6)] relative z-10 group border border-blue-900/30 hover:border-blue-500/30 transition-all duration-500 animate-in fade-in zoom-in duration-500">
            {/* Ambient Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[24px]">
              <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -ml-20 -mt-20 blur-[80px] group-hover:scale-110 transition-transform duration-1000"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-20 -mb-20 blur-[60px] group-hover:scale-110 transition-transform duration-1000"></div>
            </div>

            {/* Card Texture/Pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay rounded-[24px] overflow-hidden" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            {/* Glass Top Highlight */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/30 to-transparent rounded-t-[24px]"></div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-8 lg:mb-10">
                <span className="bg-[#243B5C] text-[#A6C8FF] px-3 lg:px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black tracking-[0.15em] uppercase border border-white/10">Business Digital wallet</span>
                <button onClick={togglePrivacy} className="text-white/40 hover:text-white transition-colors p-1">
                  <span className="material-symbols-outlined text-base lg:text-lg leading-none">{showAmounts ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              <div className="flex-1">
                <h3 className={`font-headline font-bold text-3xl lg:text-4xl tracking-tighter tabular-nums mb-2 lg:mb-3 transition-all duration-300 ${!showAmounts && 'blur-lg grayscale'}`}>
                  {formatUSDC(merchant?.usdcBalance || 0)}
                </h3>
                <p className={`text-white/40 text-[9px] lg:text-[10px] font-bold tracking-tight opacity-70 uppercase transition-all duration-300 ${!showAmounts && 'blur-sm grayscale'}`}>
                  ≈ {formatKES((merchant?.usdcBalance || 0) * liveRate)}
                </p>
              </div>
              <div className="flex gap-3 lg:gap-4 mt-8">
                <button onClick={() => navigate('/inflation-shield')} className="flex-1 py-3 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-100 rounded-[14px] text-[10px] font-black transition-all duration-300 border border-blue-500/20 hover:border-blue-500/40 uppercase tracking-widest leading-none flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">currency_exchange</span>
                  Swap
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Stats Row */}
      <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-fade-in-up [animation-delay:200ms] relative z-10">
        {[
          { label: "Today's Revenue", value: formatKES(todaysRevenue), trend: "", trendColor: "text-on-surface-variant" },
          { label: "This Month", value: formatKES(thisMonthRevenue), trend: "", trendColor: "text-emerald-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 lg:p-8 rounded-[12px] border border-[#E5E7EB] shadow-sm editorial-shadow transition-all group">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <p className="text-[9px] lg:text-[10px] text-primary font-black uppercase tracking-widest leading-none">{stat.label}</p>
            </div>
            <p className="text-2xl lg:text-3xl font-headline text-primary mb-2 leading-none">{stat.value}</p>
            <p className={`text-[9px] lg:text-[10px] ${stat.trendColor} font-bold tracking-tight opacity-90`}>{stat.trend}</p>
          </div>
        ))}

        {/* Quick Actions — the two fastest ways to get paid, replacing the old
            Total Transactions / Trust Score stat cards. Both deep-link into
            RequestMoney with the relevant option pre-selected via nav state.
            Back to full stat-card height/padding (grid-stretches to match
            the stat cards beside them) — the frame border color is still
            per-action so the two read as distinct at a glance. */}
        {[
          { label: 'Send STK Push', description: 'Prompt a customer to pay instantly', icon: 'bolt', preset: 'mpesa', frame: 'border-amber-400/30 hover:border-amber-400/60', glow: 'bg-amber-400/10' },
          { label: 'Get Payment Link', description: 'Share a link for any amount', icon: 'link', preset: 'link', frame: 'border-sky-400/30 hover:border-sky-400/60', glow: 'bg-sky-400/10' },
        ].map((action) => (
          <button
            key={action.preset}
            onClick={() => navigate('/request-money', { state: { preset: action.preset } })}
            className={`relative overflow-hidden text-left bg-[#00351D] p-6 lg:p-8 rounded-[12px] border-2 ${action.frame} shadow-sm editorial-shadow transition-all group hover:shadow-xl hover:shadow-emerald-900/20 active:scale-[0.98]`}
          >
            {/* Fine dot-grid texture — same "security paper" treatment as the
                Business Digital Wallet card above, for a matching premium feel. */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
            <div className={`absolute top-0 right-0 w-24 h-24 ${action.glow} rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none`} />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 lg:mb-6">
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400 text-lg leading-none">{action.icon}</span>
                </div>
                <span className="material-symbols-outlined text-white/30 text-base group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">arrow_outward</span>
              </div>
              <p className="text-sm lg:text-base font-headline font-bold text-white leading-tight mb-1">{action.label}</p>
              <p className="text-[9px] lg:text-[10px] text-white/40 font-bold tracking-tight opacity-90 leading-snug">{action.description}</p>
            </div>
          </button>
        ))}
      </section>

      {/* Section 3: Revenue Chart */}
      <section className="bg-white p-4 lg:p-6 rounded-[16px] border border-[#E5E7EB] shadow-sm editorial-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-1">
          <div>
            <h3 className="font-headline font-bold text-lg lg:text-xl text-primary">Revenue Overview</h3>
            <p className="text-[11px] lg:text-xs text-on-surface-variant opacity-60 font-medium mt-0.5">Money moving in and out of your account</p>
          </div>
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

        {/* Legend + period totals — a compact "at a glance" summary above the graph */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 mb-3 lg:mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00855D]"></span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Money In</span>
            <span className={`text-xs font-headline font-bold text-primary ${!showAmounts && 'blur-sm'}`}>
              {formatKES(timeframes[activeTimeframe].inbound.reduce((s, v) => s + v, 0))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Money Out</span>
            <span className={`text-xs font-headline font-bold text-primary ${!showAmounts && 'blur-sm'}`}>
              {formatKES(timeframes[activeTimeframe].outbound.reduce((s, v) => s + v, 0))}
            </span>
          </div>
        </div>

        <div className="h-48 lg:h-60 w-full">
          <RevenueChart
            labels={timeframes[activeTimeframe].labels}
            inbound={timeframes[activeTimeframe].inbound}
            outbound={timeframes[activeTimeframe].outbound}
            key={activeTimeframe}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        {/* Section 4: Recent Collections */}
        <section className="lg:col-span-2 bg-white rounded-[16px] border border-slate-300 shadow-sm editorial-shadow overflow-hidden">
          <div className="p-6 lg:p-8 border-b border-slate-200 flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-headline font-bold text-2xl lg:text-3xl text-primary">Recent Transactions</h3>
              <button
                onClick={fetchData}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-emerald-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                title="Refresh"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>
            <button onClick={() => navigate('/transactions')} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg transition-colors border border-emerald-100 shrink-0">
              View All
            </button>
          </div>
          <div className="flex flex-col">
            {recentTx.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant font-medium">
                No recent transactions yet.
              </div>
            ) : (
              recentTx.map(tx => {
                const party = formatName(tx.sender?.name) || formatName(tx.recipient?.name) || 'PayChain'
                const initials = party.slice(0, 2).toUpperCase()
                const isIn  = isCreditTransaction(tx.type)
                const isSwp = isSwapTransaction(tx.type)
                const sign  = getAmountSign(tx.type)
                const displayAmt = isSwp
                  ? `${(tx.usdcAmount || 0).toFixed(4)} USDC`
                  : formatKES(tx.kesAmount || tx.amount || 0)
                const amtColor = getAmountColorClassWithHover(tx.type)
                const TYPE_LABEL = { inbound: 'Payment In', outbound: 'Withdrawal', fx_swap: 'FX Swap', bulk_pay: 'Bulk Pay', settlement: 'Settlement', top_up: 'Top Up', withdrawal: 'Withdrawal', ncba_inbound: 'Payment In', ncba_outbound: 'Bank Transfer', mpesa_b2c: 'M-PESA Withdrawal', ncba_mobile_b2w: 'Mobile Money Withdrawal', mpesa_b2b: 'Paybill/Till Payout', ncba_lipa_na_mpesa: 'Paybill/Till Payout', ncba_kplc: 'KPLC Bill Payment', ncba_kplc_prepaid: 'KPLC Prepaid Token', ncba_ncwsc: 'NCWSC Bill Payment' }
                return (
                  <div key={tx._id || tx.id} className="px-4 lg:px-8 py-2.5 lg:py-3 flex items-center justify-between hover:bg-[#00351D] transition-all group cursor-pointer border-b border-slate-200 last:border-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-emerald-100 flex items-center justify-center font-black text-primary text-[9px] lg:text-[10px] border border-white/20 shadow-sm shrink-0 group-hover:bg-emerald-900 group-hover:text-emerald-300 transition-colors">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] lg:text-[13px] font-black text-primary leading-tight group-hover:text-white transition-colors truncate">{party}</p>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isIn ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-900 group-hover:text-emerald-300' :
                            isSwp ? 'bg-purple-100 text-purple-700 group-hover:bg-purple-900 group-hover:text-purple-300' :
                            'bg-amber-100 text-amber-700 group-hover:bg-amber-900 group-hover:text-amber-300'
                          } transition-colors`}>
                            {TYPE_LABEL[tx.type] || tx.type}
                          </span>
                        </div>
                        <p className="text-[8px] lg:text-[9px] text-on-surface-variant font-mono opacity-40 group-hover:text-white/40 group-hover:opacity-100 transition-colors truncate mt-0.5 tabular-nums">
                          {[formatPhoneDisplay(tx.sender?.id || tx.recipient?.id), tx.reference].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 ml-3">
                      <p className={`text-[12px] lg:text-[13px] font-black tabular-nums transition-colors leading-none mb-1 ${amtColor}`}>
                        {sign}{displayAmt}
                      </p>
                      <p className="text-[8px] text-on-surface-variant font-bold opacity-30 tracking-widest group-hover:text-white/30 transition-colors uppercase tabular-nums">
                        {formatTxDate(tx.createdAt || tx.timestamp)}
                      </p>
                      <p className="text-[8px] text-on-surface-variant font-bold opacity-30 tracking-widest group-hover:text-white/30 transition-colors tabular-nums">
                        {formatTxTime(tx.createdAt || tx.timestamp)}
                      </p>
                    </div>
                  </div>
                )
              })
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
            <h4 className="font-headline text-xl font-bold text-primary mb-2">
              {trustData?.eligibleForAdvance ? 'Cash Advance Available' : 'Unlock Cash Advances'}
            </h4>
            <p className="text-sm text-on-surface-variant mb-6">
              {trustData?.eligibleForAdvance
                ? `Trust Score ${trustData?.current || 0}/100 — you're eligible to apply for instant liquidity.`
                : 'Process payments through your Paybill to build your Trust Score and unlock instant liquidity.'}
            </p>
            <button
              onClick={() => navigate('/cash-advance')}
              className="block w-full py-3 bg-[#00351D] text-white rounded-xl text-[11px] font-bold hover:brightness-110 transition-all shadow-lg uppercase tracking-widest text-center"
            >
              {trustData?.eligibleForAdvance ? 'Apply Now' : 'View Cash Advance'}
            </button>
          </section>

          <section className="bg-[#E6FFFA] p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-emerald-100 shrink-0">
              <span className="material-symbols-outlined text-emerald-600 text-lg">lightbulb</span>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-[0.2em] mb-1">Growth Tip</p>
              <p className="text-[11px] text-emerald-900 leading-snug font-medium opacity-80">Instruct your customers to pay via M-Pesa Paybill 880100, Account Number {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || '...')}, to increase your daily volume.</p>
            </div>
          </section>
        </div>
      </div>

      {/* Render Modal */}
      {activeFundMethod && (
        <FundAccountModal method={activeFundMethod} onClose={() => setActiveFundMethod(null)} />
      )}
    </MerchantLayout>
  )
}
