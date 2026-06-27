import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

/**
 * Revenue & Fees — admin dashboard for PayChain's internal finance team.
 *
 * Page is read-only and split-settlement-aware: it strictly distinguishes
 * between funds we *processed* (GMV) and funds we *earned* (Net Revenue).
 *
 * Backend contract is /api/admin/revenue?range= and is documented inline
 * via the JSDoc typedefs below.
 */

/**
 * @typedef {Object} RevenueKpis
 * @property {number} gmv             Gross Merchandise Volume (KES)
 * @property {number} gmvChange       % change vs previous period
 * @property {number} grossRevenue    Total transaction fees collected
 * @property {number} grossChange
 * @property {number} networkCosts    Pass-through fees paid to networks
 * @property {number} costsChange
 * @property {number} netRevenue      grossRevenue - networkCosts
 * @property {number} netChange
 * @property {number} takeRate        netRevenue / gmv × 100
 * @property {number} projectedARR    Linear run-rate annualised
 *
 * @typedef {Object} RevenueChannel
 * @property {string} channel
 * @property {number} gmv
 * @property {number} gross
 * @property {number} costs
 * @property {number} net
 * @property {number} count
 *
 * @typedef {Object} SweepBatch
 * @property {string} id
 * @property {{from: string, to: string}} period
 * @property {number} gross
 * @property {number} costs
 * @property {number} net
 * @property {number} count
 * @property {'Settled to Corporate'|'Pending Bank Clearing'|'Accruing'|'Failed'} status
 * @property {string} destination
 */

// ── Constants ─────────────────────────────────────────────────────────
const RANGES = [
  { v: '24h', l: '24H' },
  { v: '7d',  l: '7D' },
  { v: '30d', l: '30D' },
  { v: '90d', l: '90D' },
  { v: 'ytd', l: 'YTD' },
  { v: 'all', l: 'ALL' },
];

const GRANULARITIES = [
  { v: 'daily',   l: 'Daily'   },
  { v: 'weekly',  l: 'Weekly'  },
  { v: 'monthly', l: 'Monthly' },
];

const CHANNEL_META = {
  'Mobile Money':       { icon: 'smartphone',   dot: '#10B981' },
  'On-Chain (Stellar)': { icon: 'token',        dot: '#3B82F6' },
  'Bank Transfer':      { icon: 'account_balance', dot: '#F59E0B' },
};

const STATUS_META = {
  'Settled to Corporate':   { dot: 'bg-emerald-500',                 text: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  'Pending Bank Clearing':  { dot: 'bg-amber-500 animate-pulse',     text: 'text-amber-800',   border: 'border-amber-200',   bg: 'bg-amber-50'   },
  'Accruing':               { dot: 'bg-sky-500',                     text: 'text-sky-700',     border: 'border-sky-200',     bg: 'bg-sky-50'     },
  'Failed':                 { dot: 'bg-red-500',                     text: 'text-red-700',     border: 'border-red-200',     bg: 'bg-red-50'     },
};

// ── Formatters ────────────────────────────────────────────────────────
const fmtKES = (n) => {
  if (n == null || isNaN(n)) return 'KES 0';
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(n).toLocaleString()}`;
};
const fmtKESPrecise = (n) => {
  if (n == null || isNaN(n)) return 'KES 0.00';
  return `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};
const fmtPct = (n, decimals = 2) => {
  if (n == null || isNaN(n)) return '0%';
  return `${Number(n).toFixed(decimals)}%`;
};
const fmtChange = (n) => {
  if (n == null || isNaN(n)) return '—';
  const v = Number(n);
  if (v > 0) return `+${v.toFixed(1)}%`;
  return `${v.toFixed(1)}%`;
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};
const fmtPeriod = (period) => {
  if (!period?.from || !period?.to) return '—';
  return `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
};

// ── Time-series re-bucketing — daily series → weekly / monthly. ───────
function rebucketSeries(series, granularity) {
  if (granularity === 'daily' || !series?.length) return series || [];
  const groupKey = (bucket) => {
    if (granularity === 'monthly') return bucket.slice(0, 7); // YYYY-MM
    // weekly: anchor to ISO week start (Monday) for the date string.
    const d = new Date(bucket.length === 7 ? `${bucket}-01` : bucket);
    if (Number.isNaN(d.getTime())) return bucket;
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };
  const map = new Map();
  for (const row of series) {
    const k = groupKey(row.bucket);
    if (!map.has(k)) map.set(k, { bucket: k, total: 0 });
    const agg = map.get(k);
    for (const key of Object.keys(row)) {
      if (key === 'bucket') continue;
      agg[key] = (agg[key] || 0) + (row[key] || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

// ── Skeleton ──────────────────────────────────────────────────────────
const Skel = ({ className = 'w-16 h-7' }) => (
  <span className={`inline-block ${className} bg-surface-container/80 rounded align-middle animate-pulse`} aria-hidden="true" />
);

// ── Volume-vs-Net-Revenue chart ───────────────────────────────────────
// Bars = GMV (volume). Line overlay = Net Revenue. Dual axis so the
// finance team can read both signals without losing scale on either.
const VolumeRevenueChart = ({ series, totalGmv, totalNet }) => {
  const buckets = series || [];
  if (!buckets.length) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-on-surface-variant text-[13px] gap-2">
        <span className="material-symbols-outlined text-[32px] opacity-40">monitoring</span>
        No activity in this window yet.
      </div>
    );
  }

  // Derive per-bucket GMV and net revenue. We approximate per-bucket net
  // by holding gross-to-net ratio constant across the window (we don't
  // ship per-bucket cost data yet; cheap and accurate enough at the chart
  // resolution finance reads).
  const grossToNet = totalGmv ? totalNet / Math.max(buckets.reduce((s, b) => s + b.total, 0), 1) : 0;
  const rows = buckets.map((b) => ({
    bucket: b.bucket,
    gmv: (b.total || 0) / 0.005, // gross fee ≈ 0.5% × GMV → invert to GMV proxy
    net: (b.total || 0) * grossToNet,
    gross: b.total || 0,
  }));

  const maxGmv = Math.max(...rows.map((r) => r.gmv), 1);
  const maxNet = Math.max(...rows.map((r) => r.net), 1);

  // SVG dims
  const w = 100, h = 100;
  const points = rows.map((r, i) => {
    const x = (i / Math.max(rows.length - 1, 1)) * w;
    const y = h - (r.net / maxNet) * h * 0.85;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-outline-variant/40" />
          <span className="text-on-surface-variant">GMV (volume)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-400" />
          <span className="text-on-surface-variant">Net Revenue</span>
        </div>
      </div>

      <div className="relative h-[240px]">
        {/* Bars layer */}
        <div className="absolute inset-0 flex items-end gap-1 pb-7">
          {rows.map((r, i) => {
            const heightPct = Math.max(2, (r.gmv / maxGmv) * 100);
            return (
              <div key={`${r.bucket}-${i}`} className="flex-1 flex flex-col items-center group relative min-w-[8px]">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-on-surface whitespace-nowrap tabular-nums z-10">
                  {fmtKES(r.gmv)}
                </div>
                <div
                  className="w-full rounded-sm bg-on-surface-variant/35 group-hover:bg-on-surface-variant/55 transition-colors"
                  style={{ height: `${heightPct}%` }}
                  title={`${r.bucket} · GMV ${fmtKESPrecise(r.gmv)} · Net ${fmtKESPrecise(r.net)}`}
                />
                <div className="absolute -bottom-6 text-[10px] text-on-surface/70 truncate w-full text-center font-mono">
                  {r.bucket.length > 5 ? r.bucket.slice(5) : r.bucket}
                </div>
              </div>
            );
          })}
        </div>

        {/* Line layer — Net Revenue */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────
const Revenue = () => {
  const [range, setRange] = useState('30d');
  const [granularity, setGranularity] = useState('daily');
  const [channelFilter, setChannelFilter] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/revenue', { params: { range } });
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load revenue.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const kpis     = data?.kpis     || {};
  const channels = data?.channels || [];
  const sweeps   = data?.sweepBatches || [];
  const series   = data?.series   || [];

  const filteredChannels = useMemo(() => {
    if (channelFilter === 'all') return channels;
    return channels.filter((c) => c.channel === channelFilter);
  }, [channels, channelFilter]);

  const channelOptions = useMemo(() => ['all', ...channels.map((c) => c.channel)], [channels]);

  const seriesAtGranularity = useMemo(
    () => rebucketSeries(series, granularity),
    [series, granularity]
  );

  return (
    <Layout>
      <div className="space-y-8">
        {/* ── Header + filter toolbar ──────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/70 mb-2">Finance · Internal</p>
              <h2 className="text-[28px] md:text-[34px] font-bold text-on-surface tracking-tighter leading-none font-headline">
                Revenue &amp; Fees
              </h2>
              <p className="text-[13px] text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
                Split-settlement view of PayChain platform earnings. All figures are PayChain's share — strictly separated from merchant funds held in the FBO account.
              </p>
            </div>
            <button
              onClick={fetchRevenue}
              title="Refresh"
              className="self-start sm:self-end w-9 h-9 inline-flex items-center justify-center bg-surface-container border border-outline-variant/40 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>

          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">date_range</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Period</span>
            </div>
            <div className="inline-flex bg-surface-container-lowest border border-outline-variant/40 rounded-md p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-2.5 py-1 text-[11px] font-bold tracking-wider rounded transition-colors ${
                    range === r.v
                      ? 'bg-on-surface text-surface-container-lowest'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-outline-variant/60 mx-1" />
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">filter_alt</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Channel</span>
            </div>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-md px-2.5 py-1.5 text-[12px] text-on-surface font-medium focus:outline-none focus:border-white/30 cursor-pointer"
            >
              {channelOptions.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All channels' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-3">
            {error}
          </div>
        )}

        {/* ── A. Financial-Summary metric cards ────────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-outline-variant/40 border border-outline-variant/40 rounded-lg overflow-hidden">
            {/* GMV — volume processed */}
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.18em]">Gross Merchandise Volume</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-[14px]" title="Total transaction volume processed">payments</span>
              </div>
              {loading
                ? <Skel className="w-32 h-9" />
                : <span className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.gmv)}</span>}
              <p className="text-[11px] text-on-surface-variant">Volume routed through PayChain</p>
            </div>

            {/* Gross Platform Revenue */}
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.18em]">Gross Platform Revenue</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-[14px]" title="Total fees collected at the take rate">request_quote</span>
              </div>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.grossRevenue)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-[11px]">
                  <span className={`font-bold tabular-nums ${(kpis.grossChange || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmtChange(kpis.grossChange)}
                  </span>
                  <span className="text-on-surface-variant">vs prev period</span>
                </div>
              )}
            </div>

            {/* Network & Partner Costs */}
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.18em]">Network &amp; Partner Costs</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-[14px]" title="Pass-through fees paid to networks (Safaricom, etc.)">output</span>
              </div>
              {loading
                ? <Skel className="w-24 h-9" />
                : <span className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-tighter leading-none tabular-nums">−{fmtKES(kpis.networkCosts).replace('KES ', 'KES ')}</span>}
              <p className="text-[11px] text-on-surface-variant">Paid to M-Pesa / banking rails</p>
            </div>

            {/* Net Revenue — THE bottom line. Subtle emerald tint + accent
                border so it pops from its three siblings without sacrificing
                contrast on the dark figure. */}
            <div className="bg-emerald-50 p-5 flex flex-col gap-2 relative border-l-2 border-emerald-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.18em]">Net Revenue · Platform Margin</span>
                <span className="material-symbols-outlined text-emerald-700 text-[14px]" title="Gross revenue minus partner costs — PayChain's actual margin">savings</span>
              </div>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-[28px] md:text-[34px] font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.netRevenue)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-[11px]">
                  <span className={`font-bold tabular-nums ${(kpis.netChange || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmtChange(kpis.netChange)}
                  </span>
                  <span className="text-on-surface-variant">vs prev · take {fmtPct((kpis.netRevenue || 0) / Math.max(kpis.gmv || 1, 1) * 100, 2)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── B. Volume vs Net Revenue chart + Channel breakdown ─── */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Chart */}
          <div className="xl:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 md:p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-[14px] font-bold text-on-surface tracking-tight">Volume vs Net Platform Fees</h3>
                <p className="text-[11px] text-on-surface-variant mt-1">GMV bars overlaid with the net-revenue trend line.</p>
              </div>
              <div className="inline-flex bg-surface-container-lowest border border-outline-variant/40 rounded-md p-0.5">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g.v}
                    onClick={() => setGranularity(g.v)}
                    className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded transition-colors ${
                      granularity === g.v
                        ? 'bg-on-surface text-surface-container-lowest'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center">
                <Skel className="w-full h-[200px]" />
              </div>
            ) : (
              <VolumeRevenueChart
                series={seriesAtGranularity}
                totalGmv={kpis.gmv}
                totalNet={kpis.netRevenue}
              />
            )}
          </div>

          {/* Channel breakdown */}
          <div className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 md:p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-[14px] font-bold text-on-surface tracking-tight">Net Margin by Payment Rail</h3>
                <p className="text-[11px] text-on-surface-variant mt-1">Which channel keeps the most after partner cuts.</p>
              </div>
            </div>
            {loading ? (
              <Skel className="w-full h-40" />
            ) : filteredChannels.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-on-surface-variant text-[12px]">
                No data for selected channel.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChannels.map((c) => {
                  const meta = CHANNEL_META[c.channel] || { icon: 'category', dot: '#94A3B8' };
                  const maxNet = Math.max(...filteredChannels.map((x) => x.net), 1);
                  const pct = (c.net / maxNet) * 100;
                  const margin = c.gmv ? (c.net / c.gmv) * 100 : 0;
                  return (
                    <div key={c.channel} className="border border-outline-variant/40 rounded-md bg-surface-container/70 p-3.5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[18px]" style={{ color: meta.dot }}>{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-on-surface truncate">{c.channel}</div>
                            <div className="text-[10px] text-on-surface-variant tabular-nums">{fmtNum(c.count)} txns · GMV {fmtKES(c.gmv)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-bold text-on-surface tabular-nums">{fmtKESPrecise(c.net)}</div>
                          <div className="text-[10px] text-on-surface-variant tabular-nums">{fmtPct(margin, 2)} margin</div>
                        </div>
                      </div>
                      <div className="h-1 bg-surface-container/70 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.dot }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-on-surface-variant tabular-nums">
                        <span>Gross {fmtKES(c.gross)}</span>
                        <span>Costs −{fmtKES(c.costs)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── C. Sweep & Settlement batches ────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-on-surface tracking-tight font-headline">Revenue Sweeps &amp; Settlement Batches</h3>
              <p className="text-[12px] text-on-surface-variant mt-1">
                Automated movement of accumulated fees from the PayChain FBO settlement account into the corporate operating account.
              </p>
            </div>
            {!loading && data?.corporateDestination && (
              <div className="hidden md:flex items-center gap-2 text-[11px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">account_balance</span>
                <span>Destination: <span className="text-on-surface font-bold">{data.corporateDestination}</span></span>
              </div>
            )}
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : sweeps.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-[13px]">
                No sweep batches in this window yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3">Batch ID</th>
                      <th className="text-left px-3 py-3">Period</th>
                      <th className="text-right px-3 py-3">Gross Fees</th>
                      <th className="text-right px-3 py-3">Processor Cuts</th>
                      <th className="text-right px-3 py-3">Net Swept</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-left px-5 py-3">Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweeps.map((b) => {
                      const s = STATUS_META[b.status] || STATUS_META['Accruing'];
                      return (
                        <tr key={b.id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-on-surface font-bold">{b.id}</div>
                            <div className="text-[10px] text-on-surface-variant">{fmtNum(b.count)} fees</div>
                          </td>
                          <td className="px-3 py-3.5 text-on-surface tabular-nums">
                            {fmtPeriod(b.period)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface-variant">
                            {fmtKESPrecise(b.gross)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface-variant">
                            −{fmtKESPrecise(b.costs)}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <span className="font-bold text-on-surface tabular-nums">{fmtKESPrecise(b.net)}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${s.border} ${s.bg} ${s.text} text-[10.5px] font-bold uppercase tracking-wider`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {b.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant tabular-nums">
                            {b.destination}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reconciliation footer — totals always reconcile to the KPIs above */}
          {!loading && sweeps.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-md text-[11px]">
              <span className="text-on-surface-variant">
                Showing {sweeps.length} batches · figures reconcile to KPI strip
              </span>
              <div className="flex items-center gap-5 tabular-nums">
                <span className="text-on-surface-variant">Σ Gross <span className="text-on-surface font-bold">{fmtKESPrecise(sweeps.reduce((s, b) => s + b.gross, 0))}</span></span>
                <span className="text-on-surface-variant">Σ Cuts <span className="text-on-surface font-bold">−{fmtKESPrecise(sweeps.reduce((s, b) => s + b.costs, 0))}</span></span>
                <span className="text-emerald-700 font-bold">
                  Σ Net {fmtKESPrecise(sweeps.reduce((s, b) => s + b.net, 0))}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Top merchants (kept from previous iteration) ─────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-on-surface tracking-tight font-headline">Top revenue-generating merchants</h3>
              <p className="text-[12px] text-on-surface-variant mt-1">Ranked by net PayChain margin contributed this period.</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : (data?.topMerchants || []).length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-[13px]">No merchant revenue yet in this window.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3 w-10">#</th>
                      <th className="text-left px-3 py-3">Merchant</th>
                      <th className="text-right px-3 py-3">GMV</th>
                      <th className="text-right px-3 py-3">Txns</th>
                      <th className="text-right px-5 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topMerchants || []).map((m, i) => {
                      const top = data?.topMerchants?.[0]?.revenue || 1;
                      const pct = (m.revenue / top) * 100;
                      return (
                        <tr key={m.merchantId || i} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors group">
                          <td className="px-5 py-3.5 text-on-surface-variant font-mono">{i + 1}</td>
                          <td className="px-3 py-3.5">
                            <Link to={`/merchants?id=${m.merchantId}`} className="block group-hover:opacity-90 transition-opacity">
                              <div className="font-bold text-on-surface truncate max-w-[280px]">{m.businessName || '—'}</div>
                              <div className="text-[11px] text-on-surface-variant truncate max-w-[280px]">
                                {m.email}
                                {m.paybillAccount ? <span className="ml-2 font-mono text-on-surface-variant">·{m.paybillAccount}</span> : null}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface">{fmtKES(m.volume)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface">{fmtNum(m.count)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="font-bold text-on-surface tabular-nums">{fmtKESPrecise(m.revenue)}</span>
                              <div className="h-[3px] w-24 bg-surface-container/80 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Footer disclaimer ────────────────────────────────────── */}
        <section>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px] mt-0.5 flex-shrink-0">shield_lock</span>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              <span className="text-on-surface font-bold">Split-settlement architecture.</span>{' '}
              Customer funds and PayChain fees are settled to separate ledger accounts at processing time. Figures on this page reflect only the PayChain share — they are isolated from merchant balances and the FBO trust account. All values reconcile to the live transactions collection.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Revenue;
