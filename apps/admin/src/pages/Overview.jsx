import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const Overview = () => {
  const [waitlist, setWaitlist] = useState([]);
  const [messages, setMessages] = useState([]);
  const [merchantAnalytics, setMerchantAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [waitlistRes, messagesRes, analyticsRes] = await Promise.all([
          api.get('/api/waitlist'),
          api.get('/api/contact'),
          api.get('/api/admin/merchants/analytics').catch(() => ({ data: { data: null } }))
        ]);
        
        setWaitlist(Array.isArray(waitlistRes.data) ? waitlistRes.data : []);
        setMessages(Array.isArray(messagesRes.data) ? messagesRes.data : []);
        setMerchantAnalytics(analyticsRes.data?.data || null);
      } catch (err) {
        console.error('Error fetching overview data:', err);
        setWaitlist([]);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = {
    total: Array.isArray(waitlist) ? waitlist.length : 0,
    pending: Array.isArray(waitlist) ? waitlist.filter(w => w.status?.toLowerCase() === 'pending').length : 0,
    approved: Array.isArray(waitlist) ? waitlist.filter(w => w.status?.toLowerCase() === 'approved').length : 0,
    converted: Array.isArray(waitlist) ? waitlist.filter(w => w.status?.toLowerCase() === 'converted' || w.status?.toLowerCase() === 'active').length : 0,
    kyc: Array.isArray(waitlist) ? waitlist.filter(w => w.status?.toLowerCase() === 'kyc').length : 0,
  };

  const recentActivity = Array.isArray(messages) ? messages.slice(0, 5).map(m => ({
    type: 'Message',
    label: m.subject || 'No Subject',
    entity: m.name || 'Anonymous',
    time: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A',
    color: 'bg-blue-500'
  })) : [];

  const topMerchants = []; // Placeholder

  return (
    <Layout>
      <div className="space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">System Overview</h2>
            <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1">
              Real-time monitoring of PayChain ecosystem performance.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">Last Update</p>
            <p className="text-[14px] font-semibold text-on-surface tracking-tight">{new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-widest font-label">Waitlist Pipeline</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Total Entries</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold text-on-surface tracking-tighter">{stats.total}</span>
                <span className="text-[12px] font-bold text-secondary tracking-tight">Live</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-sm">
              <div className="absolute top-0 right-0 w-1 h-full bg-amber-400 animate-pulse"></div>
              <span className="text-[12px] font-medium text-on-surface-variant/60">Pending Review</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold text-on-surface tracking-tighter">{stats.pending}</span>
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Approved</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold text-on-surface tracking-tighter">{stats.approved}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Conversion Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold text-on-surface tracking-tighter">
                  {stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : 0}%
                </span>
                <span className="text-[12px] font-bold text-secondary tracking-tight">Stable</span>
              </div>
            </div>
          </div>
        </section>

        {/* Digital Wallet Stats Section */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-widest font-label">Digital Wallet Ecosystem</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <div className="flex items-center gap-1.5 bg-[#0F141E] border border-[#1E2532] rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F] animate-pulse shadow-[0_0_6px_rgba(53,208,127,0.6)]"></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#35D07F]">Stellar Testnet Live</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Active Wallets */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#2775CA]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#2775CA]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#2775CA]/20 transition-all pointer-events-none"></div>
              <span className="text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Active Wallets</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[32px] font-bold text-white tracking-tighter">{merchantAnalytics?.activeWallets ?? 0}</span>
                <span className="text-[11px] font-bold text-[#2775CA]">Merchants</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Unique Stellar wallets provisioned</p>
            </div>

            {/* Total USDC Locked */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#35D07F]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#35D07F]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#35D07F]/20 transition-all pointer-events-none"></div>
              <span className="text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Total USDC Locked</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[32px] font-bold text-white tracking-tighter">
                  {(merchantAnalytics?.totalUsdcLocked ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-bold text-[#35D07F]">USDC</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Settled via Inflation Shield</p>
            </div>

            {/* Wallet Activation Rate */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#F0B429]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F0B429]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#F0B429]/20 transition-all pointer-events-none"></div>
              <span className="text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Activation Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[32px] font-bold text-white tracking-tighter">
                  {merchantAnalytics?.totalMerchants > 0
                    ? ((merchantAnalytics.activeWallets / merchantAnalytics.totalMerchants) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-[#1A212D] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F0B429] to-[#35D07F] rounded-full transition-all duration-700"
                  style={{ width: `${merchantAnalytics?.totalMerchants > 0 ? (merchantAnalytics.activeWallets / merchantAnalytics.totalMerchants) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Wallets Without Activation */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#8B98A9]/30 transition-all">
              <span className="text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Pending Activation</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[32px] font-bold text-white tracking-tighter">
                  {(merchantAnalytics?.totalMerchants ?? 0) - (merchantAnalytics?.activeWallets ?? 0)}
                </span>
                <span className="text-[11px] font-bold text-[#8B98A9]">Merchants</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Yet to activate digital wallet</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          <div className="lg:col-span-6 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-editorial">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-[16px] font-semibold text-on-surface">Growth Over Time</h3>
                <p className="text-[12px] text-slate-500">Daily application volume vs conversions</p>
              </div>
              <select className="text-[12px] font-medium border-0 bg-surface-container-low rounded-lg focus:ring-0">
                <option>Last 30 Days</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-[240px] w-full relative flex items-end gap-1 px-2">
              <div className="flex-1 bg-secondary-container/20 h-[30%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary-container/40 h-[45%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary-container/60 h-[40%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary-container h-[55%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary-fixed-dim/80 h-[70%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary-fixed-dim h-[65%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary/80 h-[80%] rounded-t-sm"></div>
              <div className="flex-1 bg-secondary h-[90%] rounded-t-sm"></div>
              <div className="flex-1 bg-primary/80 h-[85%] rounded-t-sm"></div>
              <div className="flex-1 bg-primary-fixed-dim h-[75%] rounded-t-sm"></div>
              <div className="flex-1 bg-primary-container h-[60%] rounded-t-sm"></div>
              <div className="flex-1 bg-primary h-[50%] rounded-t-sm"></div>
            </div>
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-editorial flex flex-col">
            <h3 className="text-[16px] font-semibold text-on-surface mb-6">Merchant Composition</h3>
            <div className="flex-1 flex items-center justify-center relative">
              <div className="w-40 h-40 rounded-full border-[16px] border-primary flex items-center justify-center relative">
                <div className="absolute inset-[-16px] w-40 h-40 rounded-full border-[16px] border-transparent border-t-secondary border-r-secondary-container rotate-[45deg]"></div>
                <div className="text-center font-body">
                  <span className="block text-xl font-bold tracking-tight">{merchantAnalytics?.totalMerchants || 0}</span>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Total</span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-[12px] font-medium">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Verified Accounts</div>
                <span className="font-bold">{merchantAnalytics?.verifiedMerchants || 0}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] font-medium">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Unverified Accounts</div>
                <span className="font-bold">{merchantAnalytics?.unverifiedMerchants || 0}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] font-medium">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary-container"></span> Signups (Last 7 Days)</div>
                <span className="font-bold">{merchantAnalytics?.recentMerchants || 0}</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-widest font-label">Pipeline Funnel</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
            <div className="flex w-full gap-2 overflow-x-auto no-scrollbar">
              <div className="flex-1 min-w-[80px] h-12 bg-primary rounded-lg flex items-center justify-center text-on-primary text-[10px] font-bold tracking-widest uppercase">WAITLIST ({stats.total})</div>
              <div className="flex-[0.85] min-w-[80px] h-12 bg-primary/90 rounded-lg flex items-center justify-center text-on-primary text-[10px] font-bold tracking-widest uppercase">APPROVED ({stats.approved})</div>
              <div className="flex-[0.7] min-w-[80px] h-12 bg-primary/80 rounded-lg flex items-center justify-center text-on-primary text-[10px] font-bold tracking-widest uppercase">KYC ({stats.kyc})</div>
              <div className="flex-[0.55] min-w-[80px] h-12 bg-secondary rounded-lg flex items-center justify-center text-on-secondary text-[10px] font-bold tracking-widest uppercase">CONVERTED ({stats.converted})</div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[16px] font-semibold text-on-surface">Recent activity</h3>
              <button className="text-[12px] text-secondary font-bold hover:underline">View Audit Log</button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
              <table className="w-full text-left font-body">
                <tbody className="divide-y divide-outline-variant/10">
                  {recentActivity.map((act, i) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-5 py-4"><div className={`w-2 h-2 rounded-full ${act.type === 'KYC' || act.type === 'Payment' ? 'bg-secondary' : 'bg-amber-400'}`}></div></td>
                      <td className="px-2 py-4 text-[13px] font-semibold text-on-surface tracking-tight">{act.label}</td>
                      <td className="px-5 py-4 text-[13px] text-on-surface-variant/70">{act.entity}</td>
                      <td className="px-5 py-4 text-[11px] text-on-surface-variant/40 font-bold uppercase tracking-widest text-right">{act.time}</td>
                    </tr>
                  ))}
                  {recentActivity.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-on-surface-variant/40">No recent activity detected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[16px] font-semibold text-on-surface">Top ranked merchants</h3>
              <button className="text-[12px] text-secondary font-bold hover:underline">Full Directory</button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
              <table className="w-full text-left font-body">
                <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest border-b border-outline-variant/20">
                  <tr>
                    <th className="px-6 py-3">Business</th>
                    <th className="px-6 py-3">Revenue Hub</th>
                    <th className="px-6 py-3">Trust</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {topMerchants.map((m) => (
                    <tr key={m.id} className="hover:bg-secondary-container/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-on-surface tracking-tight">{m.businessName}</span>
                          <span className="text-[11px] text-on-surface-variant/60 font-medium">{m.businessType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-bold text-on-surface tracking-tight">
                        KES {m.financials.totalCollected.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1 bg-surface-container rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${m.trustScore.current}%` }}></div>
                          </div>
                          <span className="text-[11px] font-bold text-secondary">{m.trustScore.current}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-on-surface-variant/30 hover:text-secondary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {topMerchants.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-on-surface-variant/40">No high-ranking merchants identified yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Overview;
