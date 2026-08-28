import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { formatKES as fmtKES } from '../utils/formatCurrency';

// Skeleton bar — mimics text height/width while data loads. No 0 → real flicker.
const Skel = ({ className = 'w-12 h-7' }) => (
  <span className={`inline-block ${className} bg-on-surface/10 rounded animate-pulse align-middle`} aria-hidden="true" />
);

// ── Client-side signup bucketer ──────────────────────────────────────
// Mirrors the backend's densified daily/weekly/monthly/yearly aggregations
// so the chart can always render — even before the new backend endpoints
// (dailySignups / weeklySignups / yearlySignups) have shipped to prod.
const ymdKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ymKey  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const isoWeekOf = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7) };
};

function bucketSignups(dailyEntries = [], granularity) {
  // Accept either `{ date, count }` (insights.signupsSeries) or `{ bucket, count }`.
  const safe = dailyEntries
    .map((e) => ({ date: e.date || e.bucket, count: Number(e.count) || 0 }))
    .filter((e) => e.date);

  if (granularity === 'daily') {
    const by = new Map(safe.map((e) => [e.date, e.count]));
    const out = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const key = ymdKey(d);
      out.push({
        bucket: key,
        label: i % 5 === 0 ? d.toLocaleString('en-US', { day: '2-digit', month: 'short' }) : '',
        tooltip: d.toLocaleString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }),
        count: by.get(key) || 0,
      });
    }
    return out;
  }

  if (granularity === 'weekly') {
    const by = new Map();
    safe.forEach((e) => {
      const { year, week } = isoWeekOf(new Date(e.date));
      const key = `${year}-W${String(week).padStart(2, '0')}`;
      by.set(key, (by.get(key) || 0) + e.count);
    });
    const out = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(); d.setDate(d.getDate() - 7 * i);
      const { year, week } = isoWeekOf(d);
      const key = `${year}-W${String(week).padStart(2, '0')}`;
      out.push({ bucket: key, label: `W${week}`, tooltip: `Week ${week} · ${year}`, count: by.get(key) || 0 });
    }
    return out;
  }

  if (granularity === 'yearly') {
    const by = new Map();
    safe.forEach((e) => {
      const yr = new Date(e.date).getFullYear();
      by.set(yr, (by.get(yr) || 0) + e.count);
    });
    const out = [];
    const cur = new Date().getFullYear();
    for (let i = 4; i >= 0; i -= 1) {
      const yr = cur - i;
      out.push({ bucket: String(yr), label: String(yr), tooltip: String(yr), count: by.get(yr) || 0 });
    }
    return out;
  }

  // Monthly (default)
  const by = new Map();
  safe.forEach((e) => {
    const d = new Date(e.date);
    const key = ymKey(d);
    by.set(key, (by.get(key) || 0) + e.count);
  });
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = ymKey(d);
    out.push({
      bucket: key,
      label: d.toLocaleString('en-US', { month: 'short' }),
      tooltip: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      count: by.get(key) || 0,
    });
  }
  return out;
}

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

// Rounding noise across many independently-rounded transaction amounts can
// add up to a few cents; anything past this is a real gap, not float drift.
// Mirrors services/reconciliationService.js's own TOLERANCE exactly.
const POOL_TOLERANCE = 1;

const Overview = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [merchantAnalytics, setMerchantAnalytics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState(null);
  const [fxLoading, setFxLoading] = useState(true);
  const [fxError, setFxError] = useState(null);
  const [networkVolume, setNetworkVolume] = useState(null);
  const [poolExpected, setPoolExpected] = useState(null);
  const [poolLive, setPoolLive] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [messagesRes, analyticsRes, insightsRes, revenueRes, poolExpectedRes, poolLiveRes] = await Promise.all([
        api.get('/api/contact'),
        api.get('/api/admin/merchants/analytics').catch(() => ({ data: { data: null } })),
        api.get('/api/admin/insights?range=30d').catch(() => ({ data: { data: null } })),
        // Same /api/admin/revenue endpoint the Revenue page reads its KPI
        // strip from (range=all = since launch) — reused as-is rather than
        // computed separately here, so this card can never drift from the
        // real revenue numbers elsewhere in admin.
        api.get('/api/admin/revenue', { params: { range: 'all' } }).catch(() => ({ data: { data: null } })),
        // Pool Health snapshot — same endpoints the full Pool Reconciliation
        // page uses, so this can never disagree with it.
        api.get('/api/admin/revenue/pool-balance/expected').catch(() => ({ data: { data: null } })),
        api.get('/api/admin/revenue/pool-balance/live').catch(() => ({ data: { data: null } })),
      ]);
      setMessages(Array.isArray(messagesRes.data) ? messagesRes.data : []);
      setMerchantAnalytics(analyticsRes.data?.data || null);
      setInsights(insightsRes.data?.data || null);
      setNetworkVolume(revenueRes.data?.data?.kpis || null);
      setPoolExpected(poolExpectedRes.data?.data || null);
      setPoolLive(poolLiveRes.data?.data || null);
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

  // Live FX rates. Both feeds are CORS-friendly + keyless. We never block
  // dashboard render on FX — if the call fails we show '—' and a small hint.
  const fetchFx = useCallback(async () => {
    setFxLoading(true);
    setFxError(null);
    try {
      const [fxRes, cgRes] = await Promise.allSettled([
        fetch('https://open.er-api.com/v6/latest/USD').then((r) => r.json()),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd,kes').then((r) => r.json()),
      ]);
      const usdKes  = fxRes.status === 'fulfilled' ? fxRes.value?.rates?.KES  : null;
      const usdEur  = fxRes.status === 'fulfilled' ? fxRes.value?.rates?.EUR  : null;
      const usdGbp  = fxRes.status === 'fulfilled' ? fxRes.value?.rates?.GBP  : null;
      const usdcUsd = cgRes.status === 'fulfilled' ? cgRes.value?.['usd-coin']?.usd : null;
      const usdcKes = (cgRes.status === 'fulfilled' && cgRes.value?.['usd-coin']?.kes)
        ? cgRes.value['usd-coin'].kes
        : (usdKes && usdcUsd ? usdKes * usdcUsd : null);
      if (!usdKes && !usdcUsd) throw new Error('rates unavailable');
      setFx({ usdKes, usdEur, usdGbp, usdcUsd, usdcKes, fetchedAt: new Date().toISOString() });
    } catch (e) {
      setFxError('Live rates temporarily unavailable');
    } finally {
      setFxLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFx();
    const id = setInterval(fetchFx, 60_000);
    return () => clearInterval(id);
  }, [fetchFx]);

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

  // Signups chart: user-selectable granularity. Prefer the densified
  // server-side series when present; fall back to client-side bucketing of
  // `signupsSeries` (the raw daily list) so the chart still renders during
  // the deploy window before the new endpoints land, AND when only the
  // legacy backend is available.
  const [signupGranularity, setSignupGranularity] = useState('monthly');
  const GRANULARITY_META = {
    daily:   { label: 'Daily',   field: 'dailySignups',   subtitle: 'Trailing 30 days · per day' },
    weekly:  { label: 'Weekly',  field: 'weeklySignups',  subtitle: 'Trailing 12 weeks · per ISO week' },
    monthly: { label: 'Monthly', field: 'monthlySignups', subtitle: 'Trailing 12 months · per month' },
    yearly:  { label: 'Yearly',  field: 'yearlySignups',  subtitle: 'Trailing 5 years · per year' },
  };
  const activeMeta = GRANULARITY_META[signupGranularity];

  const signupSeries = useMemo(() => {
    const fromServer = insights?.[activeMeta.field];
    if (Array.isArray(fromServer) && fromServer.length > 0) return fromServer;
    // Fallback: bucket the raw daily series (always returned by /insights).
    const daily = insights?.signupsSeries || [];
    return bucketSignups(daily, signupGranularity);
  }, [insights, activeMeta.field, signupGranularity]);

  const maxSignup = Math.max(1, ...signupSeries.map((s) => s.count));
  const signupTotal = signupSeries.reduce((s, x) => s + x.count, 0);

  return (
    <Layout>
      <div className="space-y-8 md:space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
          <div>
            <h2 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">System Overview</h2>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1">
              Real-time monitoring of PayChain ecosystem performance.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xs md:text-2xs font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">Last Update</p>
            <p className="text-sm font-semibold text-on-surface tracking-tight">{new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-2xs font-bold uppercase tracking-widest font-label">Platform Growth</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <Link to="/revenue" className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface transition-colors">
              Full Revenue Report →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {/* All-time GMV — the headline growth number. Sourced from the
                same /api/admin/revenue endpoint (range=all) the Revenue page
                itself uses, so this can never show a different figure than
                the page an admin would click through to for detail. */}
            <div className="bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] p-4 md:p-6 rounded-xl border border-emerald-900/40 flex flex-col gap-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
              <span className="text-2xs font-bold text-emerald-200/70 uppercase tracking-widest">Total Volume Processed · All-Time</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-32 h-9 bg-white/10" />
                  : <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter tabular-nums">{fmtKES(networkVolume?.gmv ?? 0)}</span>}
              </div>
              <p className="text-2xs text-emerald-200/50 mt-1">Every shilling moved through PayChain since launch</p>
            </div>
            <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-xs font-medium text-on-surface-variant/60">Total Transactions · All-Time</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-20 h-8" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">{(networkVolume?.totalCount ?? 0).toLocaleString()}</span>}
              </div>
              <p className="text-2xs text-on-surface-variant/60 mt-1">Successful, verified transactions only</p>
            </div>
            <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-xs font-medium text-on-surface-variant/60">Net Platform Revenue · All-Time</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-24 h-8" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">{fmtKES(networkVolume?.netRevenue ?? 0)}</span>}
              </div>
              <p className="text-2xs text-on-surface-variant/60 mt-1">After Safaricom/NCBA pass-through costs</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-2xs font-bold uppercase tracking-widest font-label">Merchant Pipeline</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-xs font-medium text-on-surface-variant/60">Total Merchants</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter">{merchantAnalytics?.totalMerchants ?? 0}</span>}
                <span className="text-xs font-bold text-secondary tracking-tight">Live</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-xs font-medium text-on-surface-variant/60">New This Week</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter">{merchantAnalytics?.recentMerchants ?? 0}</span>}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-premium-glow">
              <span className="text-xs font-medium text-on-surface-variant/60">Active This Month</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-14 h-7" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter">{merchantAnalytics?.activeMerchants30d ?? 0}</span>}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
              <span className="text-xs font-medium text-on-surface-variant/60">Verification Rate</span>
              <div className="flex items-baseline gap-2">
                {loading
                  ? <Skel className="w-16 h-7" />
                  : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter">
                      {merchantAnalytics?.totalMerchants > 0 ? ((merchantAnalytics.verifiedMerchants / merchantAnalytics.totalMerchants) * 100).toFixed(1) : 0}%
                    </span>}
                <span className="text-xs font-bold text-secondary tracking-tight">Live</span>
              </div>
            </div>
          </div>
        </section>

        {/* Digital Wallet Stats Section */}
        <section>
          <div className="flex items-center gap-2 md:gap-3 mb-4 text-slate-400">
            <span className="text-2xs md:text-2xs font-bold uppercase tracking-widest font-label whitespace-nowrap">Digital Wallet</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <div className="flex items-center gap-1.5 bg-[#0F141E] border border-[#1E2532] rounded-full px-2 md:px-3 py-1 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F] shadow-[0_0_6px_rgba(53,208,127,0.6)]"></div>
              <span className="text-2xs md:text-2xs font-black uppercase tracking-widest text-[#35D07F] whitespace-nowrap">Stellar Testnet</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Active Wallets */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#2775CA]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#2775CA]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#2775CA]/20 transition-all pointer-events-none"></div>
              <span className="text-2xs md:text-2xs font-bold text-[#8B98A9] uppercase tracking-widest">Active Wallets</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-16 h-8 bg-white/10" />
                  : <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter">{merchantAnalytics?.activeWallets ?? 0}</span>}
                <span className="text-2xs font-bold text-[#2775CA]">Merchants</span>
              </div>
              <p className="text-2xs text-[#8B98A9]/60 mt-1">Unique Stellar wallets provisioned</p>
            </div>

            {/* Total USDC Locked */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#35D07F]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#35D07F]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#35D07F]/20 transition-all pointer-events-none"></div>
              <span className="text-2xs md:text-2xs font-bold text-[#8B98A9] uppercase tracking-widest">USDC Locked</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-24 h-8 bg-white/10" />
                  : <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter tabular-nums">
                      {(merchantAnalytics?.totalUsdcLocked ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>}
                <span className="text-2xs font-bold text-[#35D07F]">USDC</span>
              </div>
              <p className="text-2xs text-[#8B98A9]/60 mt-1">Settled across all wallets</p>
            </div>

            {/* Wallet Activation Rate */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-3 md:p-5 rounded-xl border border-[#1E2532] flex flex-col gap-1 relative overflow-hidden group hover:border-[#F0B429]/40 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F0B429]/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#F0B429]/20 transition-all pointer-events-none"></div>
              <span className="text-2xs md:text-2xs font-bold text-[#8B98A9] uppercase tracking-widest">Activation Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-20 h-8 bg-white/10" />
                  : <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter">
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
              <span className="text-2xs md:text-2xs font-bold text-[#8B98A9] uppercase tracking-widest">Pending</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-16 h-8 bg-white/10" />
                  : <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter">
                      {(merchantAnalytics?.totalMerchants ?? 0) - (merchantAnalytics?.activeWallets ?? 0)}
                    </span>}
                <span className="text-2xs font-bold text-[#8B98A9]">Merchants</span>
              </div>
              <p className="text-2xs text-[#8B98A9]/60 mt-1">Yet to activate digital wallet</p>
            </div>
          </div>
        </section>

        {/* Live FX rates */}
        <section>
          <div className="flex items-center gap-2 md:gap-3 mb-4 text-slate-400">
            <span className="text-2xs md:text-2xs font-bold uppercase tracking-widest font-label whitespace-nowrap">Live Exchange Rates</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <button
              onClick={fetchFx}
              disabled={fxLoading}
              className="text-2xs md:text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface disabled:opacity-40 flex items-center gap-1"
              title="Refresh rates"
            >
              <span className={`material-symbols-outlined text-sm ${fxLoading ? 'animate-spin' : ''}`}>refresh</span>
              {fx?.fetchedAt && !fxLoading ? new Date(fx.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </button>
          </div>
          {fxError && (
            <div className="mb-3 text-2xs text-amber-500/80 font-medium">{fxError}</div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <FxCard
              label="USD → KES"
              value={fx?.usdKes}
              digits={2}
              hint="Fiat reference rate"
              loading={fxLoading}
            />
            <FxCard
              label="USDC → KES"
              value={fx?.usdcKes}
              digits={2}
              hint="Settlement rate for merchants"
              loading={fxLoading}
              accent="text-[#35D07F]"
            />
            <FxCard
              label="USDC → USD"
              value={fx?.usdcUsd}
              digits={4}
              hint="Peg health (target 1.0000)"
              loading={fxLoading}
              accent={fx?.usdcUsd != null && Math.abs(fx.usdcUsd - 1) > 0.005 ? 'text-amber-400' : 'text-[#2775CA]'}
            />
            <FxCard
              label="Float Value · KES"
              value={
                merchantAnalytics?.totalUsdcLocked != null && fx?.usdcKes != null
                  ? merchantAnalytics.totalUsdcLocked * fx.usdcKes
                  : null
              }
              digits={2}
              prefix="Ksh "
              hint="Total USDC locked × USDC/KES"
              loading={fxLoading || loading}
            />
          </div>
        </section>

        {/* Growth chart + composition */}
        <section className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6">
          <div className="lg:col-span-6 bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/10 shadow-editorial">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 md:mb-6">
              <div className="min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-on-surface">Merchant Signups · {activeMeta.label}</h3>
                <p className="text-xs text-slate-500">{activeMeta.subtitle}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 hidden sm:inline">
                  {signupSeries.length > 0 ? `${signupTotal} total` : ''}
                </span>
                <div className="inline-flex bg-surface-container-low border border-outline-variant/20 rounded-full p-0.5">
                  {Object.entries(GRANULARITY_META).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setSignupGranularity(key)}
                      className={`px-2.5 md:px-3 py-1 text-2xs md:text-2xs font-bold uppercase tracking-widest rounded-full transition-colors ${
                        signupGranularity === key
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-on-surface-variant/70 hover:text-on-surface'
                      }`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <SignupsBarChart series={signupSeries} max={maxSignup} loading={loading} />
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-outline-variant/10 shadow-editorial flex flex-col">
            <div className="flex items-baseline justify-between mb-4 md:mb-6">
              <h3 className="text-sm md:text-base font-semibold text-on-surface">Merchant Composition</h3>
              <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Lifecycle</span>
            </div>
            <CompositionDonut
              total={merchantAnalytics?.totalMerchants ?? 0}
              verified={merchantAnalytics?.verifiedMerchants ?? 0}
              wallet={merchantAnalytics?.activeWallets ?? 0}
              recent={merchantAnalytics?.recentMerchants ?? 0}
              loading={loading}
            />
          </div>
        </section>

        {/* Pool Health — is the pooled NCBA account holding what the ledger
            expects? Same figures as the full Pool Reconciliation page, kept
            in sync since both read the same two endpoints. */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-2xs font-bold uppercase tracking-widest font-label">Pool Health</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <button onClick={() => navigate('/pool-reconciliation')} className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface transition-colors">
              Full Reconciliation →
            </button>
          </div>
          {(() => {
            const discrepancy = (poolLive?.available && poolExpected)
              ? Math.round((poolLive.balance - poolExpected.expectedPoolBalance) * 100) / 100
              : null;
            const matches = discrepancy !== null && Math.abs(discrepancy) <= POOL_TOLERANCE;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1">
                  <span className="text-xs font-medium text-on-surface-variant/60">Live NCBA Balance</span>
                  {loading
                    ? <Skel className="w-24 h-7" />
                    : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">
                        {poolLive?.available ? fmtKES(poolLive.balance) : '—'}
                      </span>}
                  {!loading && !poolLive?.available && <span className="text-2xs text-amber-600 font-semibold">Unavailable</span>}
                </div>
                <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1">
                  <span className="text-xs font-medium text-on-surface-variant/60">Expected Balance</span>
                  {loading
                    ? <Skel className="w-24 h-7" />
                    : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">{fmtKES(poolExpected?.expectedPoolBalance ?? 0)}</span>}
                </div>
                <div className={`p-3 md:p-5 rounded-xl border flex flex-col gap-1 ${
                  discrepancy === null ? 'bg-surface-container-lowest border-outline-variant/20'
                  : matches ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  <span className={`text-xs font-medium ${discrepancy === null ? 'text-on-surface-variant/60' : matches ? 'text-emerald-700' : 'text-red-700'}`}>Discrepancy</span>
                  {loading
                    ? <Skel className="w-20 h-7" />
                    : discrepancy === null
                      ? <span className="text-sm font-semibold text-on-surface-variant/60">No live balance</span>
                      : <span className={`text-xl md:text-3xl font-semibold tracking-tighter tabular-nums ${matches ? 'text-emerald-700' : 'text-red-700'}`}>
                          {matches ? 'Matches' : `${discrepancy > 0 ? '+' : ''}${fmtKES(discrepancy)}`}
                        </span>}
                </div>
                <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1">
                  <span className="text-xs font-medium text-on-surface-variant/60">Total Merchant Money</span>
                  {loading
                    ? <Skel className="w-24 h-7" />
                    : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">{fmtKES(poolExpected?.merchantBalanceTotal ?? 0)}</span>}
                </div>
              </div>
            );
          })()}
        </section>

        {/* Recent activity + Top merchants */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm md:text-base font-semibold text-on-surface">Recent Activity</h3>
              <button onClick={() => navigate('/messages')} className="text-xs text-secondary font-bold hover:underline">View All</button>
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
                      <td className="px-2 py-3 text-xs font-semibold text-on-surface tracking-tight truncate max-w-[200px]">{act.label}</td>
                      <td className="px-3 py-3 text-xs text-on-surface-variant/70 truncate max-w-[120px]">{act.entity}</td>
                      <td className="px-4 py-3 text-2xs text-on-surface-variant/50 font-bold uppercase tracking-widest text-right whitespace-nowrap">{fmtTime(act.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm md:text-base font-semibold text-on-surface">Top Merchants · 30d</h3>
              <button onClick={() => navigate('/merchants')} className="text-xs text-secondary font-bold hover:underline">Full Directory</button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
              <table className="w-full text-left font-body">
                <thead className="bg-surface-container-low text-2xs font-bold text-on-surface-variant/40 uppercase tracking-widest border-b border-outline-variant/20">
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
                          <span className="text-xs font-bold text-on-surface tracking-tight truncate max-w-[180px]">{m.businessName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold text-on-surface tracking-tight tabular-nums text-right">
                        {fmtKES(m.volume)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold text-on-surface-variant/70 tabular-nums text-right">
                        {m.txnCount.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
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

// ── Signups bar chart (granularity-agnostic) ──────────────────────────
const SignupsBarChart = ({ series, max, loading }) => {
  if (loading) return <div className="h-[220px] bg-surface-container-low rounded-lg animate-pulse"></div>;
  if (!series || series.length === 0) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-on-surface-variant/40">No signup data yet.</div>;
  }
  const totalAcross = series.reduce((s, x) => s + (x.count || 0), 0);
  return (
    <div className="w-full">
      <div className="h-[180px] md:h-[220px] w-full relative flex items-end gap-1 md:gap-1.5 px-1">
        {series.map((d, i) => {
          const pct = d.count > 0 ? Math.max(8, (d.count / max) * 100) : 2;
          const tip = d.tooltip || d.bucket || d.month || d.label || '';
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {d.count > 0 && (
                <span className="text-2xs md:text-2xs font-bold text-emerald-700 tabular-nums mb-1 absolute -top-0">{d.count}</span>
              )}
              <div
                title={`${tip} — ${d.count} signup${d.count === 1 ? '' : 's'}`}
                className={`w-full rounded-t-sm transition-all hover:opacity-80 ${d.count > 0 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-surface-container-low'}`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 md:gap-1.5 px-1 mt-2">
        {series.map((d, i) => (
          <div key={i} className="flex-1 text-center text-2xs md:text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 truncate">
            {d.label}
          </div>
        ))}
      </div>
      {totalAcross === 0 && (
        <p className="mt-2 text-center text-2xs text-on-surface-variant/50">No signups in this window yet.</p>
      )}
    </div>
  );
};

// ── Composition donut ─────────────────────────────────────────────────
// Single ring, three mutually exclusive segments derived from the standard
// merchant funnel (wallet ⊆ verified ⊆ total). Counts are clamped defensively
// so dirty data never produces negative segments.
const CompositionDonut = ({ total = 0, verified = 0, wallet = 0, recent = 0, loading }) => {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-44 h-44 rounded-full bg-surface-container-low animate-pulse" />
        </div>
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => <Skel key={i} className="w-full h-5" />)}
        </div>
      </div>
    );
  }

  const v = Math.max(0, Math.min(verified, total));
  const w = Math.max(0, Math.min(wallet, v));
  const arcs = [
    {
      key: 'active', value: w,
      color: '#059669', // emerald-600 — arc + dot
      labelClass: 'text-emerald-700', valueClass: 'text-emerald-700',
      label: 'Active · Wallet',
    },
    {
      key: 'verified', value: v - w,
      color: '#2563eb', // blue-600
      labelClass: 'text-blue-700', valueClass: 'text-blue-700',
      label: 'Verified · No Wallet',
    },
    {
      key: 'pending', value: Math.max(0, total - v),
      color: '#d97706', // amber-600
      labelClass: 'text-amber-700', valueClass: 'text-amber-700',
      label: 'Pending KYC',
    },
  ];

  const r = 15.5;
  const circ = 2 * Math.PI * r;
  const denom = total > 0 ? total : 1;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);

  let cursor = 0;
  const drawArcs = arcs.map((a) => {
    const len = (a.value / denom) * circ;
    const arc = { ...a, len, offset: -cursor };
    cursor += len;
    return arc;
  });

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="3.5" />
            {total > 0 && drawArcs.map((a) => a.value > 0 && (
              <circle
                key={a.key}
                cx="18" cy="18" r={r}
                fill="none"
                stroke={a.color}
                strokeWidth="3.5"
                strokeDasharray={`${a.len} ${circ - a.len}`}
                strokeDashoffset={a.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-body">
            <span className="text-3xl md:text-4xl font-bold tracking-tight leading-none">{total}</span>
            <span className="text-2xs uppercase font-bold text-on-surface-variant/40 tracking-widest mt-1">Merchants</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {drawArcs.map((a) => (
          <div key={a.key} className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className={`${a.labelClass} truncate`}>{a.label}</span>
            </div>
            <div className="flex items-baseline gap-2 flex-shrink-0">
              <span className={`font-bold tabular-nums ${a.valueClass}`}>{a.value}</span>
              <span className={`text-2xs font-bold uppercase tracking-widest tabular-nums w-9 text-right ${a.labelClass} opacity-70`}>
                {pct(a.value).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Last 7 Days</span>
        <span className="text-xs font-bold tabular-nums">
          {recent > 0
            ? <span className="text-[#35D07F]">+{recent}</span>
            : <span className="text-on-surface-variant/40">0</span>}
          <span className="ml-1 text-on-surface-variant/60 font-medium">new signups</span>
        </span>
      </div>
    </div>
  );
};

const FxCard = ({ label, value, digits = 2, prefix = '', hint, loading, accent = 'text-secondary' }) => (
  <div className="bg-surface-container-lowest p-3 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1 transition-all hover:scale-[1.01] hover:shadow-sm">
    <span className="text-2xs md:text-2xs font-bold text-on-surface-variant/60 uppercase tracking-widest">{label}</span>
    <div className="flex items-baseline gap-2 mt-1">
      {loading
        ? <Skel className="w-20 h-7" />
        : value == null
          ? <span className="text-xl md:text-3xl font-semibold text-on-surface-variant/30 tracking-tighter">—</span>
          : <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">
              {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}
            </span>}
      <span className={`text-2xs font-bold tracking-tight ${accent}`}>LIVE</span>
    </div>
    {hint && <p className="text-2xs text-on-surface-variant/50 mt-0.5">{hint}</p>}
  </div>
);

export default Overview;
