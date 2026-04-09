import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { transactionsData } from '../mockData/transactions'
import { formatDateISO } from '../utils/formatDate'

export default function InflationShield() {
  const [kesAmount, setKesAmount] = useState(10000)
  const rate = 132.45
  const feeRate = 0.005
  const usdcAmount = (kesAmount * (1 - feeRate) / rate).toFixed(2)

  const swapHistory = transactionsData.filter(tx => tx.type === 'fx_swap')

  return (
    <MerchantLayout title="Inflation Shield">
      <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
        {/* Section 1: Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="font-headline text-4xl text-primary tracking-tight">Inflation Shield</h2>
            <p className="text-on-surface-variant font-medium mt-1">Swap your KES revenue into USDC to protect against local currency depreciation.</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary-fixed/5 p-4 rounded-2xl border border-secondary-fixed/10">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-lg pulse">monitoring</span>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Live Exchange Rate</p>
              <p className="font-headline text-lg text-primary leading-tight">1 USDC = KES {rate.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Asset Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up [animation-delay:100ms]">
          <div className="bg-[#00351D] text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-[0.2em] mb-2">Local Revenue</p>
                <h4 className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">KES Balance</h4>
                <p className="font-headline text-4xl tracking-tighter tabular-nums">{formatKES(184250)}</p>
              </div>
              <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-emerald-300 border border-white/10 backdrop-blur-md">
                <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>account_balance</span>
              </div>
            </div>
          </div>
          <div className="bg-[#0A2540] p-10 rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-blue-300 font-bold uppercase tracking-[0.2em] mb-2">Shield Protection</p>
                <h4 className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">USDC Assets</h4>
                <p className="font-headline text-4xl tracking-tighter tabular-nums text-white">{formatUSDC(312.50)}</p>
              </div>
              <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-blue-300 border border-white/10 backdrop-blur-md">
                <span className="material-symbols-outlined text-3xl text-white" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Swap Interface & History Grid */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Swap Card */}
          <div className="col-span-12 lg:col-span-12 xl:col-span-5 bg-surface-container-lowest p-10 rounded-[40px] border border-outline-variant/10 shadow-2xl editorial-shadow relative overflow-hidden animate-fade-in-up [animation-delay:200ms]">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-blue-600"></div>
            <div className="mb-10">
              <h3 className="font-headline text-3xl text-primary tracking-tight">Swap Engine</h3>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Verified Settlement Path</p>
            </div>
            
            <div className="space-y-4">
              {/* You Send */}
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest">You Send</span>
                  <span className="text-[11px] text-on-surface-variant font-medium">Balance: {formatKES(184250)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full border border-outline-variant/10">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold">K</div>
                    <span className="text-sm font-bold text-primary">KES</span>
                  </div>
                  <input 
                    type="number" 
                    value={kesAmount} 
                    onChange={(e) => setKesAmount(Number(e.target.value))}
                    className="flex-1 bg-transparent border-none text-right font-headline text-3xl text-primary focus:ring-0 p-0"
                  />
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-4 border-surface-container-lowest">
                  <span className="material-symbols-outlined text-lg">south</span>
                </div>
              </div>

              {/* You Receive */}
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest">You Receive</span>
                  <span className="text-[11px] text-on-surface-variant font-medium">Slippage: 0.1%</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full border border-outline-variant/10">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">U</div>
                    <span className="text-sm font-bold text-primary">USDC</span>
                  </div>
                  <p className="flex-1 text-right font-headline text-3xl text-primary">{usdcAmount}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-8 space-y-3 pt-6 border-t border-outline-variant/10 text-on-surface">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-on-surface-variant">Fee (0.5%)</span>
                <span>{formatKES(kesAmount * feeRate)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-on-surface-variant">Estimated Value Protection</span>
                <span className="text-emerald-600">+12.4% / yr</span>
              </div>
            </div>

            <button className="w-full bg-[#00351D] text-white py-5 rounded-2xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all mt-8 flex items-center justify-center gap-3 group border border-white/5">
              Confirm Protection Swap
              <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-700">sync</span>
            </button>
          </div>

          {/* Swap History */}
          <div className="col-span-12 xl:col-span-7 bg-surface-container-lowest rounded-[40px] border border-outline-variant/5 shadow-sm overflow-hidden editorial-shadow">
            <div className="p-8 border-b border-surface-container">
              <h3 className="font-headline text-xl text-primary">Swap History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-on-surface-variant uppercase font-bold tracking-wider bg-surface-container-low/50">
                    <th className="px-8 py-4">Date</th>
                    <th className="px-4 py-4">Conversion</th>
                    <th className="px-4 py-4">Execution Rate</th>
                    <th className="px-8 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {swapHistory.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-primary">{formatDateISO(tx.timestamp).split(',')[0]}</p>
                        <p className="text-[10px] text-on-surface-variant">{formatDateISO(tx.timestamp).split(',')[1]}</p>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface-variant">{formatKES(tx.kesAmount || 0)}</span>
                          <span className="material-symbols-outlined text-[12px] text-on-surface-variant">arrow_forward</span>
                          <span className="text-xs font-bold text-primary">{tx.usdcAmount} USDC</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-xs font-medium text-on-surface">1 : {rate.toFixed(2)}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="px-3 py-1 bg-green-500/10 text-green-700 rounded-full text-[10px] font-bold uppercase">Completed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
