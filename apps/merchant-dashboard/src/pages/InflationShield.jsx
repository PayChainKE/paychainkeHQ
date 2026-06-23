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

  const [kesAmount, setKesAmount] = useState('')
  const [rate, setRate] = useState(132.45)
  const feeRate = 0.005
  const usdcAmount = kesAmount ? (Number(kesAmount) * (1 - feeRate) / rate).toFixed(2) : '0.00'

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
    const amount = Number(kesAmount);
    if (!amount || amount <= 0) {
      return addToast({ title: 'Invalid Amount', message: 'Please enter a valid amount to swap.', type: 'error' });
    }
    if (amount > (merchant?.kesBalance || 0)) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough KES.', type: 'error' });
    }
    if (!merchant?.stellarPublicKey) {
      return addToast({ title: 'Wallet Not Activated', message: 'Please activate your Digital Wallet first.', type: 'error' });
    }

    setIsSwapping(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      await axios.post(`${API_URL}/api/transactions/swap`, { amount }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: 'Swap Successful', message: `Successfully swapped ${amount} KES to USDC!`, type: 'success' });
      await refreshSession();
      setKesAmount('');
    } catch (err) {
      addToast({ title: 'Swap Failed', message: err.response?.data?.error || 'Failed to swap KES', type: 'error' });
    } finally {
      setIsSwapping(false);
    }
  }

  const swapHistory = liveTransactions.filter(t => t.type === 'fx_swap')

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
              <p className="font-headline text-base md:text-lg text-primary leading-tight">1 USDC = KES {rate.toFixed(2)}</p>
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
            <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
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
                  <span className={`text-[11px] text-gray-600 font-medium transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>Balance: {formatKES(merchant?.kesBalance || 0)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex shrink-0 items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">K</div>
                    <span className="text-sm font-bold text-gray-900">KES</span>
                  </div>
                  <input 
                    type="number" 
                    value={kesAmount} 
                    onChange={(e) => setKesAmount(e.target.value === '' ? '' : e.target.value)}
                    className="flex-1 min-w-0 w-full bg-transparent border-none text-right font-headline text-2xl md:text-3xl text-gray-900 focus:ring-0 p-0 placeholder-gray-300 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center -my-3 relative z-20">
                <div className="bg-[#0f172a] text-emerald-400 w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] border-4 border-[#0a0f1a] hover:rotate-180 transition-transform duration-500 cursor-pointer">
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
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">U</div>
                    <span className="text-sm font-bold text-gray-900">USDC</span>
                  </div>
                  <p className="flex-1 min-w-0 w-full text-right font-headline text-2xl md:text-3xl text-gray-900 truncate">{usdcAmount}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="relative z-10 mt-8 space-y-3 pt-6 border-t border-white/10">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-white/50">Fee (0.5%)</span>
                <span className="text-white/80">{formatKES(kesAmount * feeRate)}</span>
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
