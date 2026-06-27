import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// Skeleton bar — mimics text height/width while data loads. No 0 → real flicker.
const Skel = ({ className = 'w-12 h-7' }) => (
  <span className={`inline-block ${className} bg-on-surface/10 rounded animate-pulse align-middle`} aria-hidden="true" />
);

const fmtKES = (n) => {
  if (n == null || isNaN(n)) return 'KES 0';
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(n).toLocaleString()}`;
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const Overview = () => {
  const navigate = useNavigate();
  const [waitlist, setWaitlist] = useState([]);
  const [messages, setMessages] = useState([]);
  const [merchantAnalytics, setMerchantAnalytics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [waitlistRes, messagesRes, analyticsRes, insightsRes] = await Promise.all([
        api.get('/api/waitlist'),
        api.get('/api/contact'),
        api.get('/api/admin/merchants/analytics').catch(() => ({ data: { data: null } })),
        api.get('/api/admin/insights?range=30d').catch(() => ({ data: { data: null } })),
      ]);
      setWaitlist(Array.isArray(waitlistRes.data) ? waitlistRes.data : []);
      setMessages(Array.isArray(messagesRes.data) ? messagesRes.data : []);
      setMerchantAnalytics(analyticsRes.data?.data || null);
      setInsights(insightsRes.data?.data || null);
    } catch (err) {
      console.error('Error fetching overview data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const h = () => fetchAll();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchAll]);

  const stats = useMemo(() => ({
    total: waitlist.length,
    pending: waitlist.filter((w) => w.status?.toLowerCase() === 'pending').length,
    approved: waitlist.filter((w) => w.status?.toLowerCase() === 'approved').length,
    converted: waitlist.filter((w) => ['converted', 'active'].includes((w.status || '').toLowerCase())).length,
    kyc: waitlist.filter((w) => w.status?.toLowerCase() === 'kyc').length,
  }), [waitlist]);

  // Recent activity merges messages + recent merchants for a real cross-system pulse.
  const recentActivity = useMemo(() => {
    const items = [];
    messages.slice(0, 5).forEach((m) => items.push({
      type: 'message',
      label: m.subject || 'New message',
      entity: m.name || 'Anonymous',
      ts: m.createdAt,
      dot: 'bg-blue-500',
      onClick: () => navigate('/messages'),
    }));
    return items.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 5);
  }, [messages, navigate]);

  const topMerchants = insights?.topMerchants || [];

  // Signups series → bar chart heights. Computed from real Mongo aggregation.
  const signupsSeries = insights?.signupsSeries || [];
  const maxSignups = Math.max(1, ...signupsSeries.map((s) => s.count));

  // Donut percentages from merchantAnalytics; defaults to 0 segments when empty.
  const total = merchantAnalytics?.totalMerchants || 0;
  const verifiedPct  = total > 0 ? (merchantAnalytics.verifiedMerchants / total) * 100 : 0;
  const walletPct    = total > 0 ? (merchantAnalytics.activeWallets / total) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-8 md:space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
          <div>
            <h2 className="text-[22px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">System Overview</h2>
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
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Total Entries</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-[20px] md:text-[28px] font-semibold text-on-surface tracking-tighter">{stats.total}</span>}
                <span className="text-[12px] font-bold text-secondary tracking-tight">Live</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-sm">
              {!loading && stats.pending > 0 && <div className="absolute top-0 right-0 w-1 h-full bg-amber-400"></div>}
              <span className="text-[12px] font-medium text-on-surface-variant/60">Pending Review</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-[20px] md:text-[28px] font-semibold text-on-surface tracking-tighter">{stats.pending}</span>}
                {!loading && stats.pending > 0 && <span className="w-2 h-2 bg-amber-400 rounded-full"></span>}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Approved</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-[20px] md:text-[28px] font-semibold text-on-surface tracking-tighter">{stats.approved}</span>}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-[12px] font-medium text-on-surface-variant/60">Conversion Rate</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-16 h-7" />
                  : <span className="text-[20px] md:text-[28px] font-semibold text-on-surface tracking-tighter">
                      {stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : 0}%
                    </span>}
                <span className="text-[12px] font-bold text-secondary tracking-tight">Live</span>
              </div>
            </div>
          </div>
        </section>

        {/* Digital Wallet Stats Section */}
        <section>
          <div className="flex items-center gap-2 md:gap-3 mb-4 text-slate-400">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-label whitespace-nowrap">Digital Wallet</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <div className="flex items-center gap-1.5 bg-[#0F141E] border border-[#1E2532] rounded-full px-2 md:px-3 py-1 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F] shadow-[0_0_6px_rgba(53,208,127,0.6)]"></div>
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-[#35D07F] whitespace-nowrap">Stellar Testnet</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Active Wallets */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#2775CA]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#2775CA]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#2775CA]/20 transition-all pointer-events-none"></div>
              <span className="text-[10px] md:text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Active Wallets</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-16 h-8 bg-white/10" />
                  : <span className="text-[22px] md:text-[32px] font-bold text-white tracking-tighter">{merchantAnalytics?.activeWallets ?? 0}</span>}
                <span className="text-[11px] font-bold text-[#2775CA]">Merchants</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Unique Stellar wallets provisioned</p>
            </div>

            {/* Total USDC Locked */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#35D07F]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#35D07F]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#35D07F]/20 transition-all pointer-events-none"></div>
              <span className="text-[10px] md:text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">USDC Locked</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-24 h-8 bg-white/10" />
                  : <span className="text-[22px] md:text-[32px] font-bold text-white tracking-tighter tabular-nums">
                      {(merchantAnalytics?.totalUsdcLocked ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>}
                <span className="text-[11px] font-bold text-[#35D07F]">USDC</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Settled across all wallets</p>
            </div>

            {/* Wallet Activation Rate */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#F0B429]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F0B429]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#F0B429]/20 transition-all pointer-events-none"></div>
              <span className="text-[10px] md:text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Activation Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-20 h-8 bg-white/10" />
                  : <span className="text-[22px] md:text-[32px] font-bold text-white tracking-tighter">
                      {merchantAnalytics?.totalMerchants > 0
                        ? ((merchantAnalytics.activeWallets / merchantAnalytics.totalMerchants) * 100).toFixed(1)
                        : '0.0'}%
                    </span>}
              </div>
              <div className="mt-2 w-full h-1.5 bg-[#1A212D] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F0B429] to-[#35D07F] rounded-full transition-all duration-700"
                  style={{ width: `${!loading && merchantAnalytics?.totalMerchants > 0 ? (merchantAnalytics.activeWallets / merchantAnalytics.totalMerchants) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Wallets Without Activation */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#8B98A9]/30 transition-all">
              <span className="text-[10px] md:text-[11px] font-bold text-[#8B98A9] uppercase tracking-widest">Pending</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-16 h-8 bg-white/10" />
                  : <span className="text-[22px] md:text-[32px] font-bold text-white tracking-tighter">
                      {(merchantAnalytics?.totalMerchants ?? 0) - (merchantAnalytics?.activeWallets ?? 0)}
                    </span>}
                <span className="text-[11px] font-bold text-[#8B98A9]">Merchants</span>
              </div>
              <p className="text-[10px] text-[#8B98A9]/60 mt-1">Yet to activate digital wallet</p>
            </div>
          </div>
        </section>

        {/* Growth chart + composition */}
        <section className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6">
          <div className="lg:col-span-6 bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/10 shadow-editorial">
            <div className="flex items-center justify-between mb-5 md:mb-8">
              <div>
                <h3 className="text-[15px] md:text-[16px] font-semibold text-on-surface">Merchant Signups · 30d</h3>
                <p className="text-[12px] text-slate-500">Daily new merchant onboarding volume</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {signupsSeries.length > 0 ? `${signupsSeries.reduce((s, x) => s + x.count, 0)} total` : ''}
              </span>
            </div>
            <SignupsBarChart series={signupsSeries} max={maxSignups} loading={loading} />
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/10 shadow-editorial flex flex-col">
            <h3 className="text-[15px] md:text-[16px] font-semibold text-on-surface mb-4 md:mb-6">Merchant Composition</h3>
            <div className="flex-1 flex items-center justify-center">
              <CompositionDonut verifiedPct={verifiedPct} walletPct={walletPct} total={total} loading={loading} />
            </div>
            <div className="mt-6 space-y-2">
              <LegendRow color="bg-primary" label="Verified Accounts" value={merchantAnalytics?.verifiedMerchants ?? 0} loading={loading} />
              <LegendRow color="bg-secondary" label="With Wallet" value={merchantAnalytics?.activeWallets ?? 0} loading={loading} />
              <LegendRow color="bg-secondary-container" label="Signups (Last 7d)" value={merchantAnalytics?.recentMerchants ?? 0} loading={loading} />
            </div>
          </div>
        </section>

        {/* Pipeline funnel */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-widest font-label">Pipeline Funnel</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/20">
            <div className="flex w-full gap-2 overflow-x-auto no-scrollbar">
              <div className="flex-1 min-w-[80px] h-12 bg-primary rounded-lg flex items-center justify-center text-white text-[10px] font-bold tracking-widest uppercase">WAITLIST {loading ? '' : `(${stats.total})`}</div>
              <div className="flex-[0.85] min-w-[80px] h-12 bg-primary/90 rounded-lg flex items-center justify-center text-white text-[10px] font-bold tracking-widest uppercase">APPROVED {loading ? '' : `(${stats.approved})`}</div>
              <div className="flex-[0.7] min-w-[80px] h-12 bg-primary/80 rounded-lg flex items-center justify-center text-white text-[10px] font-bold tracking-widest uppercase">KYC {loading ? '' : `(${stats.kyc})`}</div>
              <div className="flex-[0.55] min-w-[80px] h-12 bg-secondary rounded-lg flex items-center justify-center text-on-secondary text-[10px] font-bold tracking-widest uppercase">CONVERTED {loading ? '' : `(${stats.converted})`}</div>
            </div>
          </div>
        </section>

        {/* Recent activity + Top merchants */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[15px] md:text-[16px] font-semibold text-on-surface">Recent Activity</h3>
              <button onClick={() => navigate('/messages')} className="text-[12px] text-secondary font-bold hover:underline">View All</button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
              <table className="w-full text-left font-body">
                <tbody className="divide-y divide-outline-variant/10">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}><td colSpan="4" className="px-4 py-3"><Skel className="w-full h-5" /></td></tr>
                    ))
                  ) : recentActivity.length === 0 ? (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-on-surface-variant/40 text-sm">No recent activity yet.</td></tr>
                  ) : recentActivity.map((act, i) => (
                    <tr key={i} onClick={act.onClick} className="hover:bg-surface-container-low transition-colors cursor-pointer">
                      <td className="px-4 py-3"><div className={`w-2 h-2 rounded-full ${act.dot}`}></div></td>
                      <td className="px-2 py-3 text-[13px] font-semibold text-on-surface tracking-tight truncate max-w-[200px]">{act.label}</td>
                      <td className="px-3 py-3 text-[12px] text-on-surface-variant/70 truncate max-w-[120px]">{act.entity}</td>
                      <td className="px-4 py-3 text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-widest text-right whitespace-nowrap">{fmtTime(act.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[15px] md:text-[16px] font-semibold text-on-surface">Top Merchants · 30d</h3>
              <button onClick={() => navigate('/merchants')} className="text-[12px] text-secondary font-bold hover:underline">Full Directory</button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
              <table className="w-full text-left font-body">
                <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest border-b border-outline-variant/20">
                  <tr>
                    <th className="px-4 py-2">Business</th>
                    <th className="px-4 py-2 text-right">30d Volume</th>
                    <th className="px-4 py-2 text-right">Txns</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}><td colSpan="4" className="px-4 py-3"><Skel className="w-full h-5" /></td></tr>
                    ))
                  ) : topMerchants.length === 0 ? (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-on-surface-variant/40 text-sm">No transaction volume yet.</td></tr>
                  ) : topMerchants.slice(0, 5).map((m) => (
                    <tr key={m._id} onClick={() => navigate('/merchants')} className="hover:bg-secondary-container/10 transition-colors cursor-pointer">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-on-surface tracking-tight truncate max-w-[180px]">{m.businessName}</span>
                          {m.paybillAccount && <span className="text-[10px] text-on-surface-variant/60 font-mono">#{m.paybillAccount}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-bold text-on-surface tracking-tight tabular-nums text-right">
                        {fmtKES(m.volume)}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-on-surface-variant/70 tabular-nums text-right">
                        {m.txnCount.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="material-symbols-outlined text-on-surface-variant/30 text-[18px]">chevron_right</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

// ── Signups bar chart (real data) ─────────────────────────────────────
const SignupsBarChart = ({ series, max, loading }) => {
  if (loading) return <div className="h-[200px] bg-surface-container-low rounded-lg animate-pulse"></div>;
  if (!series || series.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-sm text-on-surface-variant/40">No signups in this range.</div>;
  }
  return (
    <div className="h-[200px] md:h-[240px] w-full relative flex items-end gap-[3px] md:gap-1 px-2">
      {series.map((d, i) => {
        const pct = Math.max(4, (d.count / max) * 100);
        return (
          <div
            key={i}
            title={`${d.date} — ${d.count} signups`}
            className="flex-1 bg-gradient-to-t from-primary to-secondary rounded-t-sm transition-all hover:opacity-80"
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
};

// ── Composition donut (real percentages) ──────────────────────────────
const CompositionDonut = ({ verifiedPct, walletPct, total, loading }) => {
  if (loading) return <div className="w-40 h-40 rounded-full bg-surface-container-low animate-pulse"></div>;
  const circ = 2 * Math.PI * 15.5;
  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r="15.5" fill="none"
          stroke="rgb(var(--md-sys-color-primary))" strokeWidth="3.5"
          strokeDasharray={`${(verifiedPct / 100) * circ} ${circ}`}
          strokeLinecap="round"
        />
        <circle
          cx="18" cy="18" r="11.5" fill="none"
          stroke="rgb(var(--md-sys-color-secondary))" strokeWidth="3.5"
          strokeDasharray={`${(walletPct / 100) * (2 * Math.PI * 11.5)} ${2 * Math.PI * 11.5}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-body">
        <span className="block text-2xl font-bold tracking-tight">{total}</span>
        <span className="text-[10px] uppercase font-bold text-on-surface-variant/40 tracking-widest">Total</span>
      </div>
    </div>
  );
};

const LegendRow = ({ color, label, value, loading }) => (
  <div className="flex items-center justify-between text-[12px] font-medium">
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
      {label}
    </div>
    {loading ? <Skel className="w-6 h-4" /> : <span className="font-bold tabular-nums">{value}</span>}
  </div>
);

export default Overview;
