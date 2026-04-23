import React from 'react';
import Layout from '../components/layout/Layout';
import { merchantsData, merchantStats } from '../mockData/merchants';

const Merchants = () => {
  return (
    <Layout>
      <div className="space-y-8">
        {/* Page Title Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Merchant Directory</h2>
            <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1">Manage all registered businesses and their active status.</p>
          </div>
          <button className="w-full sm:w-auto bg-primary text-on-primary px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold hover:shadow-lg transition-all active:scale-95 font-label uppercase tracking-widest">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Merchant
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-premium-glow transition-all hover:scale-[1.02]">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Active</p>
              <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{merchantStats.active}</h3>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-secondary-container/20 items-center justify-center text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-premium-glow transition-all hover:scale-[1.02]">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Suspended</p>
              <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{merchantStats.suspended}</h3>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-error-container/40 items-center justify-center text-error">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-premium-glow transition-all hover:scale-[1.02]">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Review</p>
              <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{merchantStats.underReview}</h3>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container items-center justify-center text-on-surface-variant/60">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-premium-glow transition-all hover:scale-[1.02]">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">KYC Pending</p>
              <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{merchantStats.total - merchantStats.kycVerified}</h3>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container items-center justify-center text-on-surface-variant/60">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-sm transition-all hover:scale-[1.02] col-span-2 md:col-span-1">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Advance Elig.</p>
              <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{merchantStats.cashAdvanceEligible}</h3>
            </div>
            <div className="hidden sm:flex w-10 h-10 rounded-full bg-secondary-container/20 items-center justify-center text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
          </div>
        </div>

        {/* Merchant Table Section */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-4 md:px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[20px]">search</span>
                <input
                  className="pl-10 pr-4 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm w-full transition-all font-body text-on-surface"
                  placeholder="Search till, name or phone..."
                  type="text"
                />
              </div>
              <button className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-lg transition-colors font-label tracking-tight">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filters
              </button>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="py-3 px-4 border-b border-outline-variant/10 w-10">
                    <input className="rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox" />
                  </th>
                  <th className="py-3 px-2 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">#</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Merchant</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Phone</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Type</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Till #</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">KYC</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Trust Score</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Revenue (KES)</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Status</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-right"></th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {merchantsData.map((m, i) => (
                  <tr key={m.id} className="hover:bg-secondary-container/5 transition-colors group">
                    <td className="py-3 px-4 border-b border-outline-variant/5"><input className="rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox" /></td>
                    <td className="py-3 px-2 text-on-surface-variant/40 border-b border-outline-variant/5">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow-sm">
                          {m.businessName.split(' ')[0][0]}{m.businessName.split(' ')[1]?.[0] || 'M'}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface tracking-tight">{m.businessName}</p>
                          <p className="text-[11px] text-on-surface-variant/60">{m.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant/80 font-medium border-b border-outline-variant/5">{m.phone}</td>
                    <td className="py-3 px-4 border-b border-outline-variant/5"><span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-bold uppercase tracking-tight">{m.businessType}</span></td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant/60 border-b border-outline-variant/5">{m.tillNumber || 'N/A'}</td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <div className={`flex items-center gap-1.5 font-bold text-[11px] tracking-tight ${m.kycStatus === 'verified' ? 'text-secondary' : 'text-amber-600'}`}>
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {m.kycStatus === 'verified' ? 'verified' : 'hourglass_top'}
                        </span>
                        {m.kycStatus.charAt(0)?.toUpperCase() + m.kycStatus.slice(1)}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <div className="w-[56px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${m.trustScore.current > 70 ? 'bg-secondary' : 'bg-amber-500'}`} style={{ width: `${m.trustScore.current}%` }}></div>
                      </div>
                      <p className={`text-[10px] mt-1 font-bold ${m.trustScore.current > 70 ? 'text-secondary' : 'text-amber-600'}`}>
                         ({m.trustScore.current})
                      </p>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <p className="font-bold text-on-surface tracking-tight">{m.financials.totalCollected.toLocaleString()}</p>
                      <p className="text-[11px] text-on-surface-variant/40 leading-tight">~KES {Math.floor(m.financials.monthlyAvgRevenue / 1000)}K/mo</p>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-tight uppercase ${
                        m.accountStatus === 'active' ? 'bg-secondary-container/20 text-secondary border-secondary-container/50' : 'bg-error-container/20 text-error border-error-container/50'
                      }`}>
                        {m.accountStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right border-b border-outline-variant/5">
                      <button className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant/30 hover:text-secondary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface flex items-center justify-between border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant/60 font-body">Showing 1 to {merchantsData.length} of {merchantStats.total} merchants</p>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/30 hover:text-secondary transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold tracking-tight">1</button>
              <button className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/30 hover:text-secondary transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Merchants;
