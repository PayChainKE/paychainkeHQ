import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { transactionsData } from '../mockData/transactions'
import { formatDateISO } from '../utils/formatDate'
import { formatKES } from '../utils/formatCurrency'

export default function Transactions() {
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTx, setSelectedTx] = useState(transactionsData[0])

  const filteredRows = transactionsData.filter(t => {
    const matchesSearch = !searchQuery || 
      (t.sender?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'All') return matchesSearch
    if (activeTab === 'Inbound') return matchesSearch && t.type === 'inbound'
    if (activeTab === 'Outbound') return matchesSearch && (t.type === 'bulk_pay' || t.type === 'settlement')
    if (activeTab === 'FX Swaps') return matchesSearch && t.type === 'fx_swap'
    return matchesSearch
  })

  const stats = [
    { label: 'Today', value: 'KES 12,450.00' },
    { label: 'This Week', value: 'KES 84,920.50' },
    { label: 'This Month', value: 'KES 245,100.00' },
    { label: 'All Time', value: 'KES 1.84M' },
  ]

  return (
    <MerchantLayout title="Collections">
      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Page Title & Subtext */}
        <div className="mb-8">
          <h2 className="font-headline text-4xl text-primary tracking-tight">Collections</h2>
          <p className="text-on-surface-variant font-medium mt-1">All verified inbound payments to Till PC847291</p>
        </div>

        {/* Section 1: Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 animate-fade-in-up [animation-delay:100ms]">
          {[
            { label: 'Today', value: 'KES 12,450.00', bg: 'bg-emerald-500/5', text: 'text-emerald-700' },
            { label: 'This Week', value: 'KES 84,920.50', bg: 'bg-amber-500/5', text: 'text-amber-700' },
            { label: 'This Month', value: 'KES 245,100.00', bg: 'bg-blue-500/5', text: 'text-blue-700' },
            { label: 'All Time', value: 'KES 1.84M', bg: 'bg-indigo-500/5', text: 'text-indigo-700' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} p-8 rounded-[32px] border border-outline-variant/10 editorial-shadow transition-transform hover:scale-105`}>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`${stat.text} font-headline text-2xl`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Section 2: Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full w-full md:w-auto">
            {['All', 'Inbound', 'Outbound', 'FX Swaps'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 text-xs font-bold rounded-full transition-all ${
                  activeTab === tab
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant"
                placeholder="Search reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="bg-primary text-white p-2 rounded-full transition-colors flex items-center gap-2 px-4 shadow-md active:scale-95 duration-150">
              <span className="material-symbols-outlined text-sm">download</span>
              <span className="text-xs font-bold">Export</span>
            </button>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Section 3: Transaction Table */}
          <div className="col-span-12 xl:col-span-8 bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10 editorial-shadow">
            <div className="overflow-x-auto text-on-surface">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Date/Time</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Party</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {filteredRows.map((tx) => (
                    <tr 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-surface-container-low transition-colors cursor-pointer group ${selectedTx?.id === tx.id ? 'bg-surface-container-low/50' : ''}`}
                    >
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-primary">{formatDateISO(tx.timestamp).split(',')[0]}</p>
                        <p className="text-[11px] text-on-surface-variant">{formatDateISO(tx.timestamp).split(',')[1]}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter ${
                          tx.type === 'inbound' ? 'bg-green-500/10 text-green-700' :
                          tx.type === 'fx_swap' ? 'bg-blue-500/10 text-blue-700' :
                          'bg-amber-500/10 text-amber-700'
                        }`}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-primary">{tx.sender?.name || tx.recipient?.name || 'Treasury'}</p>
                        <p className="text-[11px] font-mono text-on-surface-variant group-hover:text-primary transition-colors">{tx.reference}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className={`text-sm font-bold ${tx.type === 'inbound' ? 'text-green-600' : 'text-primary'}`}>
                          {tx.type === 'fx_swap' ? `${tx.usdcAmount} USDC` : `KES ${tx.amount}`}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'verified' || tx.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                          <span className="text-xs font-semibold capitalize">{tx.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Detail Sidebar */}
          {selectedTx && (
            <div className="col-span-12 xl:col-span-4 bg-[#0A2540] rounded-[40px] shadow-2xl overflow-hidden border border-white/5 flex flex-col sticky top-[80px] h-fit text-white">
              <div className="p-10 flex flex-col items-center text-center border-b border-white/5 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border border-white/10 backdrop-blur-md ${selectedTx.type === 'inbound' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>
                    {selectedTx.type === 'inbound' ? 'verified_user' : 'currency_exchange'}
                  </span>
                </div>
                <h3 className="font-headline text-3xl capitalize tracking-tight">{selectedTx.type.replace('_', ' ')}</h3>
                <p className="text-blue-100/60 text-xs font-medium mt-2 tracking-widest uppercase opacity-60">REF: {selectedTx.reference}</p>
              </div>
              <div className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-blue-200/40 font-bold uppercase tracking-[0.2em] mb-2">Settlement</p>
                    <p className="text-2xl font-headline text-white">{selectedTx.type === 'fx_swap' ? `${selectedTx.usdcAmount} USDC` : `KES ${selectedTx.amount}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-blue-200/40 font-bold uppercase tracking-[0.2em] mb-2">Status</p>
                    <div className="inline-flex items-center gap-2 text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse"></div>
                      <p className="text-sm font-bold uppercase tracking-tighter">{selectedTx.status}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 pt-8 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-blue-200/40 font-bold uppercase tracking-[0.2em]">Counterparty</p>
                    <p className="text-sm font-bold text-white">{selectedTx.sender?.name || selectedTx.recipient?.name || 'Treasury'}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-blue-200/40 font-bold uppercase tracking-[0.2em]">Verification</p>
                    <div className="bg-white/10 px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[10px] text-blue-200">lock</span>
                      <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Protocol V4</span>
                    </div>
                  </div>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 mt-4">
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                  Download Global Ledger
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MerchantLayout>
  )
}
