import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'

export default function MyAccounts() {
  const { merchant } = useMerchantAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [entries, setEntries] = useState(10)

  const accountsData = [
    {
      service: 'PayChain Account',
      // ncbaVirtualAccountNumber is null until NCBA_INSTITUTION_PREFIX is
      // configured on the backend (i.e. until NCBA assigns PayChain's
      // 4-digit institution code) — falls back to the 8-digit merchant
      // code, which is already safe to use as an interim account number
      // (PayChain's webhook matches it inside NCBA's Narrative field).
      accountNumber: merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending bank assignment',
      type: 'M-Pesa / Bank Transfer / EFT / PesaLink',
      name: merchant?.businessName || 'Merchant',
      // NCBA's real M-Pesa Paybill business number — how a customer sends
      // money into the account number above via M-Pesa (Pay Bill > 880100 >
      // Account No. = the NCBA virtual account above). Constant, not
      // merchant-specific.
      linkedTransferAccount: 'M-Pesa Paybill 880100',
      manager: merchant?.name || 'Owner',
      status: (merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode) ? 'Active' : 'Pending'
    }
  ]

  return (
    <MerchantLayout title="My Accounts">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full space-y-8 lg:space-y-12">

        {/* Page Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">My Accounts</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed">
            Manage your registered PayChain accounts, linked transfer accounts, and assigned managers.
          </p>
        </div>

        {/* Data Grid Section */}
        <div className="bg-white rounded-[32px] border border-slate-300 shadow-sm editorial-shadow overflow-hidden animate-fade-in-up">

          <div className="p-6 lg:p-8 border-b border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">point_of_sale</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-primary">Accounts</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-70">All Registered Accounts</p>
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="text-on-surface-variant opacity-70">Show</span>
                <select
                  className="bg-surface-container-low border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500/50"
                  value={entries}
                  onChange={(e) => setEntries(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-on-surface-variant opacity-70">entries</span>
              </div>

              <div className="relative w-full md:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search accounts..."
                  className="w-full bg-surface-container-low border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-primary focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar pb-4">
              <table className="w-full text-left min-w-[900px] border-collapse border border-slate-300">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Service</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Account Number</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Type</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Name</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Linked Transfer Account</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {accountsData.map((account, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-5 px-4 border border-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-sm font-bold text-primary">{account.service}</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold tracking-tight text-primary">{account.accountNumber}</td>
                      <td className="py-5 px-4 border border-slate-300 text-xs font-medium text-on-surface-variant"><span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{account.type}</span></td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold text-primary">{account.name}</td>
                      <td className="py-5 px-4 border border-slate-300 text-xs font-medium text-on-surface-variant italic opacity-60">{account.linkedTransferAccount}</td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold text-primary">{account.manager}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t border-slate-300">
              <p className="text-xs font-medium text-on-surface-variant opacity-80">
                Showing {accountsData.length} to {accountsData.length} of {accountsData.length} entries
              </p>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50" disabled>Previous</button>
                <button className="px-4 py-2 rounded-lg bg-[#06201B] text-white text-xs font-bold shadow-md">1</button>
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50" disabled>Next</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
