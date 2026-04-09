import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { payees, bulkPayHistory } from '../mockData/bulkPay'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'

export default function BulkPay() {
  const { showAmounts } = usePrivacyMode()
  const [step, setStep] = useState(1)
  const [selectedPayees, setSelectedPayees] = useState(
    payees.slice(0, 3).reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  )
  const [payoutAmounts, setPayoutAmounts] = useState(
    payees.reduce((acc, p) => ({ ...acc, [p.id]: p.salary || p.amount || 0 }), {})
  )

  const togglePayee = (id) => {
    setSelectedPayees((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const updateAmount = (id, val) => {
    const num = parseFloat(val.replace(/,/g, ''))
    if (!isNaN(num)) {
      setPayoutAmounts((prev) => ({ ...prev, [id]: num }))
    }
  }

  const batchTotal = Object.keys(selectedPayees)
    .filter((id) => selectedPayees[id])
    .reduce((sum, id) => sum + (payoutAmounts[id] || 0), 0)

  const balance = 184250
  const isLiquidityLow = batchTotal > balance

  return (
    <MerchantLayout title="Bulk Pay">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8">
        
        {/* Left Column: Saved Payees (380px) */}
        <section className="w-full lg:w-[380px] flex flex-col gap-4 lg:gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-2xl lg:text-3xl text-primary tracking-tight">Saved Payees</h2>
            <button className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm">add</span>
              Add Payee
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl overflow-x-auto no-scrollbar">
            {['All', 'Employees', 'Suppliers', 'Utilities'].map((tab, i) => (
              <button
                key={tab}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  i === 0 ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high font-medium'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Payee List */}
          <div className="flex flex-col gap-3">
            {payees.map((p) => (
              <div
                key={p.id}
                onClick={() => togglePayee(p.id)}
                className={`bg-surface-container-lowest p-5 rounded-[24px] flex items-center justify-between group hover:bg-emerald-500/5 hover:translate-x-1 transition-all cursor-pointer border border-outline-variant/5 shadow-sm ${
                  selectedPayees[p.id] ? 'border-primary/40 bg-emerald-500/[0.03] shadow-md' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary font-bold shadow-inner group-hover:scale-110 transition-transform">
                      {p.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    {selectedPayees[p.id] && (
                      <div className="absolute -top-1 -right-1 bg-primary p-1 rounded-full border-2 border-white shadow-sm scale-in">
                        <span className="material-symbols-outlined text-[10px] text-white" style={{fontVariationSettings: "'FILL' 1"}}>check</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                        p.type === 'Employee' ? 'bg-blue-500/10 text-blue-700' : 'bg-amber-500/10 text-amber-700'
                      }`}>{p.type}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold text-primary transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(p.salary || p.amount || 0)}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium opacity-60">Cycle</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Create Payment Batch */}
        <section className="flex-1 flex flex-col gap-6">
          {/* Step Indicator */}
          <div className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between relative overflow-hidden editorial-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-6 md:gap-12 relative z-10">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-6">
                  <div className={`flex items-center gap-3 ${step < s ? 'opacity-40' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      step === s ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {s}
                    </div>
                    <span className={`text-sm ${step === s ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}`}>
                      {s === 1 ? 'Select' : s === 2 ? 'Review' : 'Done'}
                    </span>
                  </div>
                  {s < 3 && <div className="hidden md:block h-[2px] w-12 bg-outline-variant/30"></div>}
                </div>
              ))}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest leading-none mb-1">Available liquidity</p>
              <p className={`font-headline text-lg lg:text-xl text-primary leading-tight transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(balance)}</p>
            </div>
          </div>

          {/* Batch Selection View */}
          <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/5 editorial-shadow">
            <div className="p-6 border-b border-surface-container">
              <h3 className="font-headline text-xl text-primary">Create Payment Batch</h3>
              <p className="text-xs text-on-surface-variant mt-1">Select recipients and verify their payment amounts for this cycle.</p>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-on-surface-variant uppercase font-bold tracking-wider bg-surface-container-low/50">
                    <th className="px-8 py-4 w-12">
                      <input 
                        type="checkbox" 
                        checked={Object.values(selectedPayees).every(v=>v)}
                        className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4" 
                      />
                    </th>
                    <th className="px-4 py-4">Recipient</th>
                    <th className="px-4 py-4">Reference</th>
                    <th className="px-8 py-4 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {payees.filter(p => selectedPayees[p.id]).map((p) => (
                    <tr key={p.id} className="group hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-8 py-5">
                        <input 
                          type="checkbox" 
                          checked={!!selectedPayees[p.id]}
                          onChange={() => togglePayee(p.id)}
                          className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4" 
                        />
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-primary">
                            {p.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{p.name}</p>
                            <p className="text-[10px] text-on-surface-variant capitalize">{p.type} • May 2024</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <input 
                          className="bg-surface-container-low border-none rounded-lg text-xs font-medium text-on-surface w-40 focus:ring-1 focus:ring-primary px-3 py-2" 
                          placeholder="Reference..." 
                          defaultValue="MAY_PAYOUT_24"
                        />
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-on-surface-variant font-medium">KES</span>
                          <input 
                            className="bg-transparent border-none text-right font-headline text-lg text-primary focus:ring-0 p-0 w-28" 
                            value={payoutAmounts[p.id].toLocaleString()}
                            onChange={(e) => updateAmount(p.id, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Action Bar */}
            <div className="p-10 bg-[#00351D] text-white flex items-center justify-between border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
              <div className="flex items-center gap-10 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-1">Batch Load</span>
                  <span className="text-sm font-bold">{Object.values(selectedPayees).filter(Boolean).length} Verified Recipients</span>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-1">Total Payout</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-emerald-400">KES</span>
                    <span className={`font-headline text-2xl lg:text-4xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-lg'}`}>{batchTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 relative z-10">
                {isLiquidityLow && (
                  <div className="text-right">
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1">Insufficient Liquidity</p>
                    <p className="text-[10px] text-white/60">Balance: {formatKES(balance)}</p>
                  </div>
                )}
                <button 
                  disabled={batchTotal === 0 || isLiquidityLow}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#00351D] px-10 py-5 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-2xl active:scale-95 group disabled:opacity-20 disabled:grayscale disabled:active:scale-100"
                >
                  Authorize Batch
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">bolt</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MerchantLayout>
  )
}
