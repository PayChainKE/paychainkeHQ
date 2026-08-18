import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatDateISO } from '../utils/formatDate'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useToast } from '../context/NotificationContext'
export default function InflationShield() {
  const { showAmounts } = usePrivacyMode()
  const { merchant, refreshSession } = useMerchantAuth()
  const { addToast } = useToast()
  const [isSwapping, setIsSwapping] = useState(false)
  const [usdBalance, setUsdBalance] = useState(0)

  const [inputAmount, setInputAmount] = useState('')
  const [swapDirection, setSwapDirection] = useState('KES_TO_USDC')
  const [rate, setRate] = useState(132.45)
  // Swap execution (transactionController.js's KES_TO_USDC/USDC_TO_KES
  // branches) charges no fee at all today — it credits amount * liveRate
  // with no deduction (see revenueRateCard.js's FX_SPREAD_RATE comment:
  // "not wired to a real payout yet, pilot/reporting-only"). This used to
  // subtract a flat 0.5% here that was never actually charged server-side,
  // understating what the merchant would really receive.
  const estimatedOutput = inputAmount ? (
    swapDirection === 'KES_TO_USDC'
      ? (Number(inputAmount) / rate).toFixed(2)
      : (Number(inputAmount) * rate).toFixed(2)
  ) : '0.00'

  const [liveTransactions, setLiveTransactions] = useState([])
  useEffect(() => {
    const fetchLiveRate = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const token = localStorage.getItem('paychain_merchant_token')
        const res = await axios.get(`${API_URL}/api/transactions/live-rate`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data.success && res.data.rate) {
          setRate(res.data.rate)
        }
      } catch (err) {
        console.error('Failed to fetch live exchange rate', err)
      }
    }
    const fetchTransactions = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const token = localStorage.getItem('paychain_merchant_token');
        const res = await axios.get(`${API_URL}/api/transactions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiveTransactions(res.data);
      } catch (err) {
        console.error('Failed to load transactions', err);
      }
    };

    const fetchUsdBalance = async () => {
      if (!merchant?.stellarPublicKey) return;
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const token = localStorage.getItem('paychain_merchant_token');
        const res = await axios.post(`${API_URL}/api/transactions/sync-wallet`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setUsdBalance(res.data.balance);
        }
      } catch (err) {
        console.error('Failed to sync USDC balance', err);
      }
    };

    fetchLiveRate()
    fetchTransactions()
    if (merchant) {
      fetchUsdBalance()
    }
  }, [merchant])

  const handleSwap = async () => {
    const amount = Number(inputAmount);
    if (!amount || amount <= 0) {
      return addToast({ title: 'Invalid Amount', message: 'Please enter a valid amount to swap.', type: 'error' });
    }
    if (swapDirection === 'KES_TO_USDC' && amount > (merchant?.kesBalance || 0)) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough KES.', type: 'error' });
    }
    if (swapDirection === 'USDC_TO_KES' && amount > usdBalance) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough USDC.', type: 'error' });
    }
    if (!merchant?.stellarPublicKey) {
      return addToast({ title: 'Wallet Not Activated', message: 'Please activate your Digital Wallet first.', type: 'error' });
    }

    setIsSwapping(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      await axios.post(`${API_URL}/api/transactions/swap`, { amount, direction: swapDirection }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: 'Swap Successful', message: `Successfully swapped ${amount} ${swapDirection === 'KES_TO_USDC' ? 'KES to USDC' : 'USDC to KES'}!`, type: 'success' });
      await refreshSession();
      setInputAmount('');
      
      const syncRes = await axios.post(`${API_URL}/api/transactions/sync-wallet`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (syncRes.data.success) {
        setUsdBalance(syncRes.data.usdcBalance || syncRes.data.balance);
      }
    } catch (err) {
      addToast({ title: 'Swap Failed', message: err.response?.data?.error || 'Failed to swap currency', type: 'error' });
    } finally {
      setIsSwapping(false);
    }
  }

  const swapHistory = liveTransactions.filter(t => t.type === 'fx_swap')
  const walletActivated = !!merchant?.stellarPublicKey

  // Hard gate: Inflation Shield is a wallet-only feature. Without an active
  // Stellar wallet there's nothing to swap into, so we show an activation CTA
  // instead of letting the merchant submit a swap that the backend would just
  // reject with "Wallet Not Activated".
  if (!walletActivated) {
    return (
      <MerchantLayout title="Inflation Shield">
        <div className="px-4 lg:px-0 max-w-3xl mx-auto w-full pb-20">
          <div className="bg-gradient-to-br from-[#0A2540] via-[#081d34] to-[#02101e] text-white rounded-[32px] lg:rounded-[40px] p-8 lg:p-14 border border-blue-500/15 shadow-[0_30px_60px_-25px_rgba(10,37,64,0.7)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/10 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-200 backdrop-blur-md mb-7">
                <span className="material-symbols-outlined text-3xl lg:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              </div>

              <p className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.3em] text-blue-300 mb-3">Activate to unlock</p>
              <h2 className="font-headline text-3xl lg:text-5xl tracking-tight leading-[1.05] mb-4">
                Inflation Shield needs an active Digital Wallet
              </h2>
              <p className="text-white/70 text-sm lg:text-base leading-relaxed max-w-xl mb-8">
                Shielding KES into USDC requires a provisioned Stellar wallet on your account. Activation takes under a minute — once it's live you can swap, hold and convert at any time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-9">
                {[
                  { icon: 'shield', label: 'USDC-pegged', sub: 'Dollar-stable savings' },
                  { icon: 'currency_exchange', label: 'Live FX rate', sub: 'Real-time KES ↔ USDC' },
                  { icon: 'bolt', label: 'On-chain settle', sub: 'Stellar Mainnet' },
                ].map((b) => (
                  <div key={b.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <span className="material-symbols-outlined text-blue-300 text-xl mb-2">{b.icon}</span>
                    <p className="text-[12px] font-bold text-white">{b.label}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{b.sub}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/wallet"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#031813] font-black text-sm uppercase tracking-[0.18em] px-7 py-4 rounded-2xl transition-all shadow-[0_10px_30px_-12px_rgba(16,185,129,0.6)] active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  Activate Digital Wallet
                </Link>
                <Link
                  to="/overview"
                  className="inline-flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white px-5 py-4"
                >
                  Back to overview
                </Link>
              </div>

              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-8 font-bold">
                You'll be redirected to the Wallet page to provision your address.
              </p>
            </div>
          </div>
        </div>
      </MerchantLayout>
    )
  }

  return (
    <MerchantLayout title="Inflation Shield">
      <div className="px-4 lg:px-0 max-w-7xl mx-auto w-full space-y-8 lg:space-y-12 pb-20">
        {/* Section 1: Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-6">
          <div className="max-w-xl">
            <h2 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight leading-tight">Inflation Shield</h2>
            <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 lg:mt-2 opacity-80 leading-relaxed">Swap your KES revenue into USDC to protect against local currency depreciation.</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary-fixed/5 p-4 rounded-2xl border border-secondary-fixed/10 self-start md:self-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-lg pulse">monitoring</span>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Live Exchange Rate</p>
              <p className="font-headline text-base md:text-lg text-primary leading-tight">1 USDC = {formatKES(rate)}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Asset Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms]">
          <div className="bg-[#00351D] text-white p-6 md:p-10 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-[11px] text-emerald-400 font-bold uppercase tracking-[0.2em] mb-2">Local Revenue</p>
                <h4 className="text-[10px] md:text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">KES Balance</h4>
                <p className={`font-headline text-2xl md:text-3xl lg:text-4xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(merchant?.kesBalance || 0)}</p>
              </div>
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white/10 flex items-center justify-center text-emerald-300 border border-white/10 backdrop-blur-md shrink-0">
                <span className="material-symbols-outlined text-2xl md:text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>account_balance</span>
              </div>
            </div>
          </div>
          <div className="bg-[#0A2540] p-6 md:p-10 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-[11px] text-blue-300 font-bold uppercase tracking-[0.2em] mb-2">Shield Protection</p>
                <h4 className="text-[10px] md:text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">USDC Assets</h4>
                <p className={`font-headline text-2xl md:text-3xl lg:text-4xl tracking-tighter tabular-nums text-white transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatUSDC(usdBalance)}</p>
              </div>
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white/10 flex items-center justify-center text-blue-300 border border-white/10 backdrop-blur-md shrink-0">
                <span className="material-symbols-outlined text-2xl md:text-3xl text-white" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
              </div>
            </div>

            {/* Wallet address pill — same address shown on the Digital Wallet page */}
            {merchant?.stellarPublicKey && (
              <div
                onClick={() => {
                  navigator.clipboard.writeText(merchant.stellarPublicKey)
                  addToast({ title: 'Address Copied', message: 'Stellar wallet address copied to clipboard.', type: 'success' })
                }}
                className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 cursor-pointer transition-all active:scale-95 group/pill"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.7)] animate-pulse shrink-0"></div>
                <span className="text-[10px] text-white/50 font-mono tracking-wider group-hover/pill:text-white/80 transition-colors">
                  {merchant.stellarPublicKey.slice(0, 8)}...{merchant.stellarPublicKey.slice(-6)}
                </span>
                <span className="material-symbols-outlined text-[11px] text-white/30 group-hover/pill:text-white/60 transition-colors">content_copy</span>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10 flex justify-end">
              <Link
                to="/wallet"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300 hover:text-white transition-colors flex items-center gap-2"
              >
                Manage in Wallet
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Section 3: Swap Interface & History Grid */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Swap Card */}
          <div className="col-span-12 lg:col-span-12 xl:col-span-5 bg-gradient-to-br from-[#0f172a] to-[#020617] text-white p-6 md:p-10 rounded-[32px] lg:rounded-[40px] border border-white/10 shadow-[0_0_40px_rgba(16,185,129,0.1)] relative overflow-hidden animate-fade-in-up [animation-delay:200ms] group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-32 -mb-32 transition-transform duration-1000 group-hover:scale-110"></div>
            
            <div className="relative z-10 mb-6 md:mb-10 flex items-center justify-between">
              <div>
                <h3 className="font-headline text-2xl md:text-3xl text-white tracking-tight">Swap Engine</h3>
                <p className="text-[9px] md:text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1">Verified Settlement Path</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                <span className="material-symbols-outlined text-white/70 text-sm">currency_exchange</span>
              </div>
            </div>
            
            <div className="relative z-10 space-y-4">
              {/* You Send */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">You Send</span>
                  <span className={`text-[11px] text-gray-600 font-medium transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>
                    Balance: {swapDirection === 'KES_TO_USDC' ? formatKES(merchant?.kesBalance || 0) : formatUSDC(usdBalance)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex shrink-0 items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${swapDirection === 'KES_TO_USDC' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                      {swapDirection === 'KES_TO_USDC' ? 'K' : 'U'}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{swapDirection === 'KES_TO_USDC' ? 'KES' : 'USDC'}</span>
                  </div>
                  <input 
                    type="number" 
                    value={inputAmount} 
                    onChange={(e) => setInputAmount(e.target.value === '' ? '' : e.target.value)}
                    className="flex-1 min-w-0 w-full bg-transparent border-none text-right font-headline text-2xl md:text-3xl text-gray-900 focus:ring-0 p-0 placeholder-gray-300 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center -my-3 relative z-20">
                <div 
                  onClick={() => setSwapDirection(prev => prev === 'KES_TO_USDC' ? 'USDC_TO_KES' : 'KES_TO_USDC')}
                  className="bg-[#0f172a] text-emerald-400 w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] border-4 border-[#0a0f1a] hover:rotate-180 transition-transform duration-500 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">swap_vert</span>
                </div>
              </div>

              {/* You Receive */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-500/30 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">You Receive</span>
                  <span className="text-[11px] text-gray-500 font-medium">Slippage: 0.1%</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex shrink-0 items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${swapDirection === 'USDC_TO_KES' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                      {swapDirection === 'USDC_TO_KES' ? 'K' : 'U'}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{swapDirection === 'USDC_TO_KES' ? 'KES' : 'USDC'}</span>
                  </div>
                  <p className="flex-1 min-w-0 w-full text-right font-headline text-2xl md:text-3xl text-gray-900 truncate">{estimatedOutput}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="relative z-10 mt-8 space-y-3 pt-6 border-t border-white/10">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-white/50">Fee</span>
                <span className="text-white/80">None — no PayChain fee on swaps today</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-white/70">Estimated Value Protection</span>
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">+12.4% / yr</span>
              </div>
            </div>

            <button 
              onClick={handleSwap}
              disabled={isSwapping}
              className="relative z-10 w-full bg-gradient-to-r from-emerald-600 to-emerald-400 text-white py-5 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all mt-8 flex items-center justify-center gap-3 group border border-emerald-400/20 disabled:opacity-50 disabled:grayscale"
            >
              {isSwapping ? 'Processing Swap...' : 'Confirm Protection Swap'}
              <span className={`material-symbols-outlined transition-transform duration-700 ${isSwapping ? 'animate-spin' : 'group-hover:rotate-180'}`}>sync</span>
            </button>
          </div>

          {/* Swap History */}
          <div className="col-span-12 xl:col-span-7 bg-surface-container-lowest rounded-[32px] lg:rounded-[40px] border border-outline-variant/5 shadow-sm overflow-hidden editorial-shadow">
            <div className="p-6 md:p-8 border-b border-surface-container flex items-center justify-between">
              <h3 className="font-headline text-lg md:text-xl text-primary">Swap History</h3>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-on-surface-variant uppercase font-bold tracking-wider bg-surface-container-low/50">
                    <th className="px-8 py-3">Date/Time</th>
                    <th className="px-4 py-3">Conversion</th>
                    <th className="px-4 py-3">Execution Rate</th>
                    <th className="px-8 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50">
                  {swapHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-on-surface-variant font-medium">No swap history yet.</td>
                    </tr>
                  ) : swapHistory.map((tx) => (
                    <tr key={tx._id || tx.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-8 py-2.5">
                        <p className="text-[11px] font-bold text-primary">{formatDateISO(tx.createdAt || tx.timestamp).split(',')[0]}</p>
                        <p className="text-[9px] text-on-surface-variant font-medium">{formatDateISO(tx.createdAt || tx.timestamp).split(',')[1]}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold text-on-surface-variant transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>{formatKES(tx.kesAmount || tx.amount || 0)}</span>
                          <span className="material-symbols-outlined text-[10px] text-on-surface-variant">arrow_forward</span>
                          <span className={`text-[11px] font-bold text-primary transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>{tx.usdcAmount || ((tx.kesAmount || tx.amount) / rate).toFixed(2)} USDC</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] font-medium text-on-surface">1 : {rate.toFixed(2)}</span>
                      </td>
                      <td className="px-8 py-2.5 text-right">
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-700 rounded text-[9px] font-bold uppercase">Completed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-surface-container">
              {swapHistory.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant font-medium">No swap history yet.</div>
              ) : swapHistory.map((tx) => (
                <div key={tx.id} className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-primary">{formatDateISO(tx.timestamp).split(',')[0]}</p>
                      <p className="text-[10px] text-on-surface-variant">{formatDateISO(tx.timestamp).split(',')[1]}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-700 rounded-full text-[8px] font-bold uppercase tracking-widest">Completed</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">From</span>
                      <span className={`text-xs font-bold text-on-surface-variant ${!showAmounts && 'blur-sm'}`}>{formatKES(tx.kesAmount || 0)}</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/40">arrow_forward</span>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">To</span>
                      <span className={`text-xs font-bold text-emerald-600 ${!showAmounts && 'blur-sm'}`}>{tx.usdcAmount} USDC</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-on-surface-variant font-medium">Rate: 1 : {rate.toFixed(2)}</span>
                    <span className="text-[#00351D] font-bold">Verified Shield Settlement</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
