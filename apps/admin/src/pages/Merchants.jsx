import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const Merchants = () => {
  const [merchantsData, setMerchantsData] = useState([]);
  const [merchantStats, setMerchantStats] = useState({
    active: 0,
    suspended: 0,
    underReview: 0,
    kycVerified: 0,
    total: 0,
    cashAdvanceEligible: 0
  });

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await api.get('/api/admin/merchants');
        if (res.data?.success) {
          const mData = res.data.data;
          setMerchantsData(mData);
          
          setMerchantStats({
            total: mData.length,
            active: mData.filter(m => m.isVerified).length,
            suspended: 0,
            underReview: mData.filter(m => !m.isVerified).length,
            kycVerified: mData.filter(m => m.isVerified).length,
            cashAdvanceEligible: 0
          });
        }
      } catch (err) {
        console.error('Failed to fetch merchants:', err);
      }
    };
    fetchMerchants();
  }, []);

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
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">#</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Merchant</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Phone/Email</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Status</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Certificate</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">Registered</th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-right"></th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {merchantsData.map((m, i) => (
                  <tr key={m._id || i} className="hover:bg-secondary-container/5 transition-colors group">
                    <td className="py-3 px-4 text-on-surface-variant/40 border-b border-outline-variant/5">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow-sm uppercase">
                          {m.businessName ? m.businessName.substring(0, 2) : 'M'}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface tracking-tight">{m.businessName || 'N/A'}</p>
                          <p className="text-[11px] text-on-surface-variant/60">{m.name || 'Unknown'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <p className="text-on-surface-variant/80 font-medium">{m.phone}</p>
                      <p className="text-[11px] text-on-surface-variant/60">{m.email}</p>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-tight uppercase ${
                        m.isVerified ? 'bg-secondary-container/20 text-secondary border-secondary-container/50' : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {m.isVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5">
                      {m.certificateUrl ? (
                        <a href={m.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-secondary hover:underline text-[12px] font-bold">
                          <span className="material-symbols-outlined text-[14px]">description</span> View Doc
                        </a>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant/40 italic">Not Uploaded</span>
                      )}
                    </td>
                    <td className="py-3 px-4 border-b border-outline-variant/5 text-on-surface-variant/60">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right border-b border-outline-variant/5">
                      <button className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant/30 hover:text-secondary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {merchantsData.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-on-surface-variant/40">No merchants found.</td>
                  </tr>
                )}
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
