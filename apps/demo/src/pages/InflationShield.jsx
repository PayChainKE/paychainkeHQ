import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatDateISO } from '../utils/formatDate'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import StellarConnectPanel from '../components/ui/StellarConnectPanel'
import api from '../api/config'

// Testnet-only — matches backend/utils/stellarHelper.js's STELLAR_NETWORK
// default. Every tx hash produced here is independently verifiable by
// pasting it (or the link below) into this explorer.
const EXPLORER_TX_BASE = 'https://stellar.expert/explorer/testnet/tx/'

export default function InflationShield() {
  const { showAmounts } = usePrivacyMode()
  const { realMerchant, realLoading, refreshRealMerchant } = useMerchantAuth()
  const hasRealWallet = !!realMerchant?.stellarPublicKey

  const [kesAmount, setKesAmount] = useState(10000)
  const [rate, setRate] = useState(null) // KES per 1 USDC, fetched live
  const [swapHistory, setSwapHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [lastTxHash, setLastTxHash] = useState('')

  const loadRate = useCallback(async () => {
    try {
      const res = await api.get('/api/transactions/live-rate')
      if (res.data?.success) setRate(res.data.rate)
    } catch (err) {
      console.error('Failed to load live KES/USDC rate', err)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await api.get('/api/transactions')
      const swaps = (Array.isArray(res.data) ? res.data : []).filter((tx) => tx.type === 'fx_swap')
      setSwapHistory(swaps)
    } catch (err) {
      console.error('Failed to load swap history', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasRealWallet) {
      loadRate()
      loadHistory()
    }
  }, [hasRealWallet, loadRate, loadHistory])

  const usdcAmount = rate ? (kesAmount / rate) : 0

  async function handleSwap() {
    setSwapError('')
    setLastTxHash('')
    if (!kesAmount || kesAmount <= 0) return setSwapError('Enter an amount greater than zero.')
    if (kesAmount > (realMerchant?.kesBalance || 0)) return setSwapError('Amount exceeds available KES balance.')

    setSwapping(true)
    try {
      const res = await api.post('/api/transactions/swap', { amount: Number(kesAmount), direction: 'KES_TO_USDC' })
      setLastTxHash(res.data.txHash)
      await Promise.all([refreshRealMerchant(), loadHistory()])
    } catch (err) {
      setSwapError(err.response?.data?.error || 'Swap failed. Please try again.')
    } finally {
      setSwapping(false)
    }
  }

  const kesBalance = hasRealWallet ? Number(realMerchant.kesBalance || 0) : 0
  const usdcBalance = hasRealWallet ? Number(realMerchant.usdcBalance || 0) : 0

  return (
    <MerchantLayout title="Inflation Shield">
      <div className="px-4 lg:px-0 max-w-7xl mx-auto w-full space-y-8 lg:space-y-12 pb-20">
        {/* Section 1: Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-6">
          <div className="max-w-xl">
            <h2 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight leading-tight">Inflation Shield</h2>
            <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 lg:mt-2 opacity-80 leading-relaxed">Swap your KES revenue into USDC on the Stellar network to protect against local currency depreciation.</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary-fixed/5 p-4 rounded-2xl border border-secondary-fixed/10 self-start md:self-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-lg pulse">monitoring</span>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Live Exchange Rate</p>
              <p className="font-headline text-base md:text-lg text-primary leading-tight">
                {rate ? `1 USDC = ${formatKES(rate)}` : hasRealWallet ? 'Loading…' : '—'}
              </p>
            </div>
          </div>
        </div>

        {!hasRealWallet && !realLoading && (
          <div className="animate-fade-in-up">
            <StellarConnectPanel />
            <p className="text-center text-[11px] text-on-surface-variant/60 mt-4">
              Or explore the <Link to="/wallet" className="text-emerald-600 font-bold underline">Wallet page</Link> first.
            </p>
          </div>
        )}

        {hasRealWallet && (
          <>
            {/* Section 2: Asset Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms]">
              <div className="bg-[#00351D] text-white p-6 md:p-10 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-[11px] text-emerald-400 font-bold uppercase tracking-[0.2em] mb-2">Local Revenue</p>
                    <h4 className="text-[10px] md:text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">KES Balance</h4>
                    <p className={`font-headline text-2xl md:text-3xl lg:text-4xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(kesBalance)}</p>
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
                    <h4 className="text-[10px] md:text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">USDC Assets (Stellar Testnet)</h4>
                    <p className={`font-headline text-2xl md:text-3xl lg:text-4xl tracking-tighter tabular-nums text-white transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatUSDC(usdcBalance)}</p>
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
                    <p className="text-[9px] md:text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1">Real Stellar Testnet Settlement</p>
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
                      <span className={`text-[11px] text-gray-600 font-medium transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>Balance: {formatKES(kesBalance)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex shrink-0 items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">K</div>
                        <span className="text-sm font-bold text-gray-900">KES</span>
                      </div>
                      <input
                        type="number"
                        value={kesAmount}
                        onChange={(e) => setKesAmount(Number(e.target.value))}
                        className="flex-1 min-w-0 w-full bg-transparent border-none text-right font-headline text-2xl md:text-3xl text-gray-900 focus:ring-0 p-0 placeholder-gray-300 outline-none"
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
                      <span className="text-[11px] text-gray-500 font-medium">Network: Stellar</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex shrink-0 items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">U</div>
                        <span className="text-sm font-bold text-gray-900">USDC</span>
                      </div>
                      <p className="flex-1 min-w-0 w-full text-right font-headline text-2xl md:text-3xl text-gray-900 truncate">{usdcAmount.toFixed(4)}</p>
                    </div>
                  </div>
                </div>

                {swapError && (
                  <div className="relative z-10 mt-4 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3 text-[12px] text-red-300 font-medium">
                    {swapError}
                  </div>
                )}

                {lastTxHash && (
                  <div className="relative z-10 mt-4 bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-emerald-300 font-bold mb-1">Swap settled on-chain</p>
                    <a
                      href={`${EXPLORER_TX_BASE}${lastTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-emerald-200 underline break-all hover:text-white"
                    >
                      View on StellarExpert: {lastTxHash}
                    </a>
                  </div>
                )}

                <div className="relative z-10 mt-8 space-y-3 pt-6 border-t border-white/10">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white/70">Settlement</span>
                    <span className="text-emerald-400">Real Stellar testnet transaction</span>
                  </div>
                </div>

                <button
                  onClick={handleSwap}
                  disabled={swapping || !rate || !kesAmount || kesAmount <= 0}
                  className="relative z-10 w-full bg-gradient-to-r from-emerald-600 to-emerald-400 text-white py-5 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all mt-8 flex items-center justify-center gap-3 group border border-emerald-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {swapping ? 'Settling on Stellar…' : 'Confirm Protection Swap'}
                  <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-700">sync</span>
                </button>
              </div>

              {/* Swap History */}
              <div className="col-span-12 xl:col-span-7 bg-surface-container-lowest rounded-[32px] lg:rounded-[40px] border border-outline-variant/5 shadow-sm overflow-hidden editorial-shadow">
                <div className="p-6 md:p-8 border-b border-surface-container flex items-center justify-between">
                  <h3 className="font-headline text-lg md:text-xl text-primary">Swap History</h3>
                </div>

                {historyLoading ? (
                  <div className="p-10 text-center text-[12px] text-on-surface-variant/50">Loading…</div>
                ) : swapHistory.length === 0 ? (
                  <div className="p-10 text-center text-[12px] text-on-surface-variant/50">No swaps yet — run one above to see it here with a real testnet transaction hash.</div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-left text-[10px] text-on-surface-variant uppercase font-bold tracking-wider bg-surface-container-low/50">
                            <th className="px-8 py-4">Date</th>
                            <th className="px-4 py-4">Conversion</th>
                            <th className="px-4 py-4">Tx Hash</th>
                            <th className="px-8 py-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          {swapHistory.map((tx) => (
                            <tr key={tx._id} className="hover:bg-surface-container-low/30 transition-colors">
                              <td className="px-8 py-5">
                                <p className="text-sm font-bold text-primary">{formatDateISO(tx.createdAt).split(',')[0]}</p>
                                <p className="text-[10px] text-on-surface-variant">{formatDateISO(tx.createdAt).split(',')[1]}</p>
                              </td>
                              <td className="px-4 py-5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold text-on-surface-variant transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>{formatKES(tx.kesAmount || 0)}</span>
                                  <span className="material-symbols-outlined text-[12px] text-on-surface-variant">arrow_forward</span>
                                  <span className={`text-xs font-bold text-primary transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>{tx.usdcAmount} USDC</span>
                                </div>
                              </td>
                              <td className="px-4 py-5">
                                <a
                                  href={`${EXPLORER_TX_BASE}${tx.reference}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-mono text-emerald-700 underline"
                                >
                                  {tx.reference?.slice(0, 10)}…
                                </a>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <span className="px-3 py-1 bg-green-500/10 text-green-700 rounded-full text-[10px] font-bold uppercase">{tx.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden divide-y divide-surface-container">
                      {swapHistory.map((tx) => (
                        <div key={tx._id} className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold text-primary">{formatDateISO(tx.createdAt).split(',')[0]}</p>
                              <p className="text-[10px] text-on-surface-variant">{formatDateISO(tx.createdAt).split(',')[1]}</p>
                            </div>
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-700 rounded-full text-[8px] font-bold uppercase tracking-widest">{tx.status}</span>
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
                          <a
                            href={`${EXPLORER_TX_BASE}${tx.reference}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[10px] font-mono text-emerald-700 underline text-center"
                          >
                            View on StellarExpert
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MerchantLayout>
  )
}
