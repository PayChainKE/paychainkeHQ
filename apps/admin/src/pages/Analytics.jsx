import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// ── Constants ─────────────────────────────────────────────────────────
const RANGES = [
  { v: '7d',  l: '7 Days' },
  { v: '30d', l: '30 Days' },
  { v: '90d', l: '90 Days' },
  { v: 'all', l: 'All Time' },
];

const TXN_TYPE_LABEL = {
  inbound:    'M-Pesa Collections',
  outbound:   'Payouts',
  bulk_pay:   'Bulk Payments',
  settlement: 'Settlements',
  fx_swap:    'FX Swaps',
  other:      'Other',
};

const fmtKES = (n) => {
  if (n == null || isNaN(n)) return 'KES 0';
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `KES ${(n / 1_000).toFixed(1)}k`;
  return `KES ${Math.round(n).toLocaleString()}`;
};
const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};

const Analytics = () => {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/insights', { params: { range } });
      if (res.data?.success) setData(res.data.data);
      else setError(res.data?.error || 'Could not load insights.');
    } catch (err) {
      console.error('Insights fetch failed:', err);
      const status  = err?.response?.status;
      const apiMsg  = err?.response?.data?.error || err?.response?.data?.message;
      // 401 is already handled globally by the response interceptor (redirects
      // to /login with a reason banner) — but if it slips through (e.g. mid-
      // redirect), still show a useful message instead of "404 endpoint missing"
      // copy that's been wrong for months.
      setError(
        apiMsg
          ? apiMsg
          : status === 401
            ? 'Your session expired. Sign in again.'
            : status === 404
              ? 'Insights API path not found. Check VITE_API_BASE_URL on the admin deploy.'
              : status >= 500
                ? `Backend error (${status}). Try again in a moment.`
                : 'Cannot reach the PayChain API. Check your connection or wait for the deploy to finish.'
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchData]);

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Executive Insights</p>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline leading-none">
              Pulse of the Network
            </h2>
            <p className="text-on-surface-variant/60 mt-2 text-xs md:text-sm font-body max-w-xl">
              Real-time gross transaction volume, merchant health, and growth velocity across the PayChain ecosystem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/20">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                    range === r.v ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant/60 hover:text-on-surface'
                  }`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <button onClick={fetchData} className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Refresh">
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>
        </div>

        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : data ? (
          <>
            {/* North Star — GTV hero */}
            <NorthStarCard data={data} />

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <KpiCard
                label="GTV (KES)"
                value={fmtKES(data.kpis?.gtv?.value)}
                change={data.kpis?.gtv?.change}
                icon="payments"
                tone="primary"
                subtitle="Master Paybill"
              />
              <KpiCard
                label="GMV (USDC)"
                value={`${fmtNum(data.kpis?.gmv?.value)} USDC`}
                change={data.kpis?.gmv?.change}
                icon="currency_exchange"
                tone="blue"
                subtitle="Stellar Network"
              />
              <KpiCard
                label="Lifetime KES"
                value={fmtKES(data.kpis?.lifetimeVolume)}
                icon="account_balance"
                tone="emerald"
                subtitle="All time total"
                noDelta
              />
              <KpiCard
                label="Lifetime USDC"
                value={`${fmtNum(data.kpis?.lifetimeUsdcVolume)} USDC`}
                icon="public"
                tone="blue"
                subtitle="All time total"
                noDelta
              />
              <KpiCard
                label="Transactions"
                value={fmtNum(data.kpis.txnCount.value)}
                change={data.kpis.txnCount.change}
                icon="receipt_long"
                tone="emerald"
                subtitle={`${fmtNum(data.kpis.txnCount.prev)} prev`}
              />
              <KpiCard
                label="New Merchants"
                value={fmtNum(data.kpis.newMerchants.value)}
                change={data.kpis.newMerchants.change}
                icon="storefront"
                tone="violet"
                subtitle={`${fmtNum(data.kpis.newMerchants.prev)} prev`}
              />
              <KpiCard
                label="Active Merchants"
                value={fmtNum(data.kpis.activeMerchants)}
                icon="bolt"
                tone="amber"
                subtitle={`${fmtNum(data.kpis.totalMerchants)} total`}
                noDelta
              />
            </div>

            {/* GTV chart + Health sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Volume Trajectory</p>
                    <h3 className="text-lg font-bold text-on-surface tracking-tight">Daily GTV ({range.toUpperCase()})</h3>
                  </div>
                  <div className="flex items-center gap-4 text-2xs font-bold">
                    <Legend color="bg-primary" label="Volume" />
                    <Legend color="bg-emerald-500" label="Txn Count" />
                  </div>
                </div>
                <AreaChart series={data.gtvSeries} />
              </div>

              <div className="lg:col-span-4 space-y-4">
                <HealthCard health={data.health} />
                <FunnelCard funnel={data.funnel} />
              </div>
            </div>

            {/* Top Merchants + Signups */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
                <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center justify-between">
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Leaderboard</p>
                    <h3 className="text-lg font-bold text-on-surface tracking-tight">Top Merchants by Volume</h3>
                  </div>
                  <span className="text-2xs text-on-surface-variant/40">Last {range === 'all' ? 'all time' : range}</span>
                </div>
                <TopMerchantsTable rows={data.topMerchants} />
              </div>

              <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Acquisition</p>
                    <h3 className="text-lg font-bold text-on-surface tracking-tight">Daily Signups</h3>
                  </div>
                </div>
                <BarChart series={data.signupsSeries} />
              </div>
            </div>

            {/* Transaction mix + Business types */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Product Mix</p>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-5">Volume by Transaction Type</h3>
                <TypeMix mix={data.txnTypeMix} />
              </div>
              <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Composition</p>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-5">Pipeline by Business Sector</h3>
                <BusinessTypeList items={data.businessTypes} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
};

// ── North Star ───────────────────────────────────────────────────────
const NorthStarCard = ({ data }) => {
  const gtv = data.kpis.gtv;
  const trend = data.gtvSeries.map((d) => d.volume);
  const positive = gtv.change >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#06201B] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-8">
      {/* Decorative orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl"></div>

      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">North Star · Live</p>
          </div>
          <p className="text-xs uppercase tracking-widest text-emerald-100/60 font-bold mb-2">Gross Transaction Volume</p>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tighter font-headline leading-none">
            {fmtKES(gtv.value)}
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              <span className="material-symbols-outlined text-sm">{positive ? 'trending_up' : 'trending_down'}</span>
              {positive ? '+' : ''}{gtv.change}%
            </span>
            <span className="text-xs text-emerald-100/50">vs previous period</span>
          </div>
        </div>
        <div className="lg:col-span-1">
          <Sparkline values={trend} stroke="#5EFEB3" fill="#5EFEB3" height={100} />
          <p className="text-2xs text-emerald-100/50 font-bold uppercase tracking-widest mt-2 text-right">{data.gtvSeries.length} day trend</p>
        </div>
      </div>
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────
const KpiCard = ({ label, value, change, icon, tone, subtitle, noDelta }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
    blue:    'bg-blue-50 text-blue-600',
  };
  const positive = (change ?? 0) >= 0;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneMap[tone] || toneMap.primary}`}>
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-bold text-on-surface tracking-tighter">{value}</p>
      <div className="flex items-center justify-between mt-3">
        {!noDelta && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <span className="material-symbols-outlined text-xs">{positive ? 'arrow_upward' : 'arrow_downward'}</span>
            {positive ? '+' : ''}{change}%
          </span>
        )}
        {subtitle && <p className="text-2xs text-on-surface-variant/50 ml-auto">{subtitle}</p>}
      </div>
    </div>
  );
};

// ── Health Card ──────────────────────────────────────────────────────
const HealthCard = ({ health }) => {
  const items = [
    { label: 'Active',   value: health.active, color: 'bg-emerald-500', pct: (health.active / Math.max(1, health.total)) * 100 },
    { label: 'Locked',   value: health.locked, color: 'bg-amber-500',   pct: (health.locked / Math.max(1, health.total)) * 100 },
    { label: 'Flagged',  value: health.flagged, color: 'bg-red-500',     pct: (health.flagged / Math.max(1, health.total)) * 100 },
    { label: 'Dormant',  value: health.dormant, color: 'bg-gray-400',    pct: (health.dormant / Math.max(1, health.total)) * 100 },
  ];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-editorial">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Network Health</p>
          <h3 className="text-base font-bold text-on-surface tracking-tight">Merchant Status</h3>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/30 text-xl">monitor_heart</span>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-on-surface-variant/70">{it.label}</span>
              <span className="font-bold text-on-surface">{it.value}</span>
            </div>
            <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
              <div className={`h-full ${it.color} rounded-full transition-all`} style={{ width: `${it.pct}%` }}></div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-outline-variant/10">
        <MiniStat label="Verified" value={health.verified} />
        <MiniStat label="KRA" value={health.kraVerified} />
        <MiniStat label="Wallets" value={health.withWallet} />
      </div>
    </div>
  );
};

const MiniStat = ({ label, value }) => (
  <div className="text-center">
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</p>
    <p className="text-base font-bold text-on-surface tracking-tight">{fmtNum(value)}</p>
  </div>
);

// ── Funnel Card ──────────────────────────────────────────────────────
const FunnelCard = ({ funnel }) => {
  const stages = [
    { label: 'Waitlist', value: funnel.waitlistTotal, color: 'from-blue-500 to-blue-600' },
    { label: 'Contacted', value: funnel.contacted + funnel.approved + funnel.converted, color: 'from-violet-500 to-violet-600' },
    { label: 'Approved', value: funnel.approved + funnel.converted, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Converted', value: funnel.converted, color: 'from-amber-500 to-amber-600' },
    { label: 'Active Merchants', value: funnel.activeMerchants, color: 'from-primary to-emerald-700' },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-editorial">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Acquisition Funnel</p>
          <h3 className="text-base font-bold text-on-surface tracking-tight">Pipeline → Platform</h3>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/30 text-xl">filter_alt</span>
      </div>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const prevValue = i > 0 ? stages[i - 1].value : null;
          const stageRate = prevValue ? Math.round((s.value / Math.max(1, prevValue)) * 100) : null;
          return (
            <div key={s.label} className="relative">
              <div className={`h-9 rounded-lg bg-gradient-to-r ${s.color} flex items-center px-3 transition-all`} style={{ width: `${Math.max(pct, 18)}%` }}>
                <span className="text-2xs font-bold text-white uppercase tracking-wide">{s.label}</span>
                <span className="ml-auto text-xs font-bold text-white">{fmtNum(s.value)}</span>
              </div>
              {stageRate != null && i > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs font-bold text-on-surface-variant/60 ml-2" style={{ left: `calc(${Math.max(pct, 18)}% + 8px)` }}>
                  {stageRate}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Top Merchants Table ──────────────────────────────────────────────
const TopMerchantsTable = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="p-10 text-center text-on-surface-variant/40 text-sm">No transaction activity in this range.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.volume));
  return (
    <div className="divide-y divide-outline-variant/10">
      {rows.map((m, i) => {
        const pct = (m.volume / max) * 100;
        return (
          <div key={m._id} className="px-6 py-3 flex items-center gap-4 hover:bg-secondary-container/5 transition-colors">
            <span className="text-lg font-bold text-on-surface-variant/30 w-6 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-2xs uppercase ring-2 ring-white shadow-sm ${m.flagged ? 'bg-red-500 text-white' : m.status === 'locked' ? 'bg-amber-500 text-white' : 'bg-primary-fixed-dim text-primary'}`}>
              {m.flagged ? '!' : (m.businessName || 'M').substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface tracking-tight truncate">{m.businessName}</p>
              <p className="text-2xs text-on-surface-variant/60 font-mono">#{m.paybillAccount || '—'} · {fmtNum(m.txnCount)} txns</p>
              <div className="h-1 bg-surface-container-low rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-on-surface tracking-tight tabular-nums">{fmtKES(m.volume)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Type Mix (donut + list) ──────────────────────────────────────────
const TypeMix = ({ mix }) => {
  const total = mix.reduce((s, r) => s + r.volume, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-on-surface-variant/40 text-sm">No transactions in this range.</p>;
  }
  const colors = ['#06201B', '#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#6B7280'];
  let offset = 0;
  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative w-36 h-36 md:w-40 md:h-40 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
          {mix.map((r, i) => {
            const pct = (r.volume / total) * 100;
            const circ = 2 * Math.PI * 15.5;
            const dash = (pct / 100) * circ;
            const seg = (
              <circle
                key={i}
                cx="18" cy="18" r="15.5" fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="3"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Total</p>
          <p className="text-base md:text-lg font-bold text-on-surface tracking-tight">{fmtKES(total)}</p>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {mix.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></span>
            <span className="text-xs font-bold text-on-surface-variant/80 flex-1 truncate">{TXN_TYPE_LABEL[r.type] || r.type}</span>
            <span className="text-xs font-bold text-on-surface tabular-nums">{fmtKES(r.volume)}</span>
            <span className="text-2xs text-on-surface-variant/50 tabular-nums w-12 text-right">{((r.volume / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Business Type List ───────────────────────────────────────────────
const BusinessTypeList = ({ items }) => {
  if (items.length === 0) {
    return <p className="py-10 text-center text-on-surface-variant/40 text-sm">No sector data yet.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2">
      {items.map((t, idx) => {
        const pct = (t.count / max) * 100;
        return (
          <div key={idx} className="flex items-center gap-3">
            <p className="text-xs font-bold text-on-surface w-32 truncate">{t.type}</p>
            <div className="flex-1 h-2.5 bg-surface-container-low rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
            </div>
            <p className="text-xs font-bold text-on-surface-variant tabular-nums w-10 text-right">{t.count}</p>
          </div>
        );
      })}
    </div>
  );
};

// ── Sparkline (used in North Star) ───────────────────────────────────
const Sparkline = ({ values, stroke = '#06201B', fill, height = 60 }) => {
  if (!values || values.length === 0) return <div style={{ height }} className="flex items-center justify-center text-2xs text-white/40">No data</div>;
  const w = 280;
  const h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [i * step, h - ((v - min) / range) * (h - 8) - 4]);
  const path = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill || stroke} stopOpacity="0.4" />
          <stop offset="100%" stopColor={fill || stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Area Chart (GTV trend) ───────────────────────────────────────────
const AreaChart = ({ series }) => {
  if (!series || series.length === 0) {
    return <div className="h-[240px] flex items-center justify-center text-on-surface-variant/40 text-sm">No transactions in this range yet.</div>;
  }
  const w = 800;
  const h = 240;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 32;
  const volumes = series.map((d) => d.volume);
  const counts = series.map((d) => d.count);
  const vMax = Math.max(...volumes, 1);
  const cMax = Math.max(...counts, 1);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const step = innerW / Math.max(series.length - 1, 1);

  const volPts = series.map((d, i) => [padL + i * step, padT + (1 - d.volume / vMax) * innerH]);
  const cntPts = series.map((d, i) => [padL + i * step, padT + (1 - d.count / cMax) * innerH]);
  const volPath = volPts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const cntPath = cntPts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const areaPath = `${volPath} L ${padL + (series.length - 1) * step} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  // y-axis labels — 4 gridlines
  const yLabels = [0, 0.25, 0.5, 0.75, 1].reverse();
  // X-axis: show first, middle, last date
  const xTicks = series.length <= 7
    ? series.map((d, i) => ({ x: padL + i * step, label: d.date.slice(5) }))
    : [
        { x: padL, label: series[0].date.slice(5) },
        { x: padL + innerW / 2, label: series[Math.floor(series.length / 2)].date.slice(5) },
        { x: padL + innerW, label: series[series.length - 1].date.slice(5) },
      ];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[600px]" style={{ height: 240 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06201B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06201B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Gridlines */}
        {yLabels.map((p, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={padT + p * innerH} y2={padT + p * innerH} stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" />
            <text x={padL - 6} y={padT + p * innerH + 3} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="end" fontWeight="600">
              {fmtKES(vMax * (1 - p))}
            </text>
          </g>
        ))}
        {/* X labels */}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={h - 12} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="middle" fontWeight="700">
            {t.label}
          </text>
        ))}
        {/* Volume area */}
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={volPath} fill="none" stroke="#06201B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Count line */}
        <path d={cntPath} fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
        {/* Data points (volume only) */}
        {volPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#06201B" stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
};

// ── Bar Chart (signups) ──────────────────────────────────────────────
const BarChart = ({ series }) => {
  if (!series || series.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-on-surface-variant/40 text-sm">No signups in this range.</div>;
  }
  const max = Math.max(...series.map((d) => d.count), 1);
  return (
    <div className="h-[200px] flex items-end justify-between gap-1">
      {series.slice(-30).map((d, i) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={i} className="flex-1 group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-white text-2xs px-2 py-0.5 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {d.count} on {d.date.slice(5)}
            </div>
            <div className="bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm hover:from-emerald-700 hover:to-emerald-500 transition-all" style={{ height: `${Math.max(pct, 4)}%` }}></div>
          </div>
        );
      })}
    </div>
  );
};

const Legend = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
    <span className="text-on-surface-variant/60">{label}</span>
  </span>
);

// ── Loading & Error states ───────────────────────────────────────────
const LoadingState = () => (
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-32 bg-surface-container-low rounded-2xl animate-pulse"></div>
    ))}
    <div className="lg:col-span-4 h-80 bg-surface-container-low rounded-2xl animate-pulse"></div>
  </div>
);

const ErrorState = ({ error }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
      <span className="material-symbols-outlined text-3xl">error</span>
    </div>
    <h3 className="text-lg font-bold text-red-900 mb-1">Couldn't load insights</h3>
    <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
  </div>
);

export default Analytics;
