import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import TablePagination from '../components/ui/TablePagination';
import { formatKES } from '../utils/formatCurrency';

const PAGE_SIZE = 25;

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
  'Accruing':               { dot: 'bg-sky-500',                     text: 'text-sky-700',     border: 'border-sky-200',     bg: 'bg-sky-50'     },
  'Failed':                 { dot: 'bg-red-500',                     text: 'text-red-700',     border: 'border-red-200',     bg: 'bg-red-50'     },
  // Real outcome of an actual sweep attempt (services/revenueSweepService.js)
  // that ran but moved nothing — e.g. below NCBA's minimum transfer, or the
  // destination account wasn't configured yet. Distinct from "Accruing"
  // (nothing has been attempted yet) and from the old fake "Pending Bank
  // Clearing" guess this replaced, which implied a transfer was queued when
  // none actually was.
  'Skipped':                { dot: 'bg-amber-500',                   text: 'text-amber-800',   border: 'border-amber-200',   bg: 'bg-amber-50'   },
  // No real RevenueSweep record's periodEnd falls in this week at all —
  // predates the real sweep system, or the automated day simply never ran.
  'No Sweep Attempted':     { dot: 'bg-slate-400',                   text: 'text-slate-600',   border: 'border-slate-200',   bg: 'bg-slate-50'   },
};

// ── Formatters ────────────────────────────────────────────────────────
const fmtKES = formatKES;
const fmtKESPrecise = formatKES;
const fmtUSDC = (n) => {
  if (n == null || isNaN(n)) return '0.00 USDC';
  return `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
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
// Real RevenueSweep periods can start/end within the same day (several
// attempts can happen hours apart) — fmtDate alone would collapse those
// to an identical-looking date, so the sweep history table needs time too.
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Raw RevenueSweep.status values, as recorded — distinct from the derived
// STATUS_META labels below (e.g. "Settled to Corporate"), which describe a
// whole ISO week rather than one attempt.
const RAW_STATUS_META = {
  completed: { dot: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  skipped:   { dot: 'bg-amber-500',   text: 'text-amber-800',   border: 'border-amber-200',   bg: 'bg-amber-50'   },
  failed:    { dot: 'bg-red-500',     text: 'text-red-700',     border: 'border-red-200',     bg: 'bg-red-50'     },
};

// Tailwind classes per REVENUE_STREAMS[].accent (config/revenueRateCard.js)
// — one categorical slot per real revenue stream, stable regardless of
// which streams happen to have nonzero revenue this period.
const STREAM_ACCENT = {
  emerald: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pink:    { dot: 'bg-pink-500',    bar: 'bg-pink-500',    text: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200'    },
  blue:    { dot: 'bg-blue-500',    bar: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  amber:   { dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  teal:    { dot: 'bg-teal-500',    bar: 'bg-teal-500',    text: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200'    },
  rose:    { dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200'    },
  indigo:  { dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200'  },
  sky:     { dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200'     },
  violet:  { dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200'  },
};
const DEFAULT_STREAM_ACCENT = { dot: 'bg-slate-400', bar: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };

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

// ── Revenue trend chart ───────────────────────────────────────────────
// One axis, one metric at a time — GMV, Gross Fees, Network Costs and Net
// Revenue sit at wildly different magnitudes (take rate is well under 1%),
// so overlaying two of them on independently-scaled axes (the previous
// bars+line version did exactly this) invents a correlation that isn't
// really there. A metric switcher + a single real axis is the honest
// version of "see volume and margin together". Colors are the dataviz
// skill's validated categorical slots 1–4 (blue/orange/yellow/aqua),
// assigned once per metric and never reassigned on interaction.
const CHART_METRICS = {
  gmv:   { key: 'gmv',   label: 'GMV',           color: '#2a78d6' },
  gross: { key: 'total', label: 'Gross Fees',    color: '#eb6834' },
  costs: { key: 'cost',  label: 'Network Costs', color: '#eda100' },
  net:   { key: 'net',   label: 'Net Revenue',   color: '#1baf7a' },
};

// "Nice" axis ticks (0, 20k, 40k, ...) rather than raw fractions of the max.
function niceTicks(max, targetCount = 4) {
  if (!max || max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual >= 5 ? 5 : residual >= 2 ? 2 : 1) * magnitude;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const RevenueTrendChart = ({ series, metric }) => {
  const rows = series || [];
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 640, height: 260 });
  const [hoverIndex, setHoverIndex] = useState(null);

  // Real pixel dimensions (not just viewBox units) — needed so a pointer
  // position maps back to the correct bucket index, and so text/gridlines
  // stay crisp instead of stretching under preserveAspectRatio="none".
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Without this, hovering at e.g. index 25 on a 30-bucket series, then
  // switching to a metric/range whose series only has 10 buckets, leaves
  // hoverIndex out of bounds — the tooltip correctly disappears (rows[25]
  // is undefined), but the crosshair/dot below don't check bounds and
  // compute NaN coordinates from it, breaking the SVG paint.
  useEffect(() => { setHoverIndex(null); }, [series, metric]);

  const meta = CHART_METRICS[metric] || CHART_METRICS.gmv;
  const values = rows.map((r) => Number(r[meta.key]) || 0);
  const maxVal = Math.max(...values, 0);
  const ticks = useMemo(() => niceTicks(maxVal), [maxVal]);
  const axisMax = ticks[ticks.length - 1] || 1;

  const padL = 54, padR = 8, padT = 12, padB = 26;
  const plotW = Math.max(dims.width - padL - padR, 1);
  const plotH = Math.max(dims.height - padT - padB, 1);

  const xAt = (i) => padL + (rows.length > 1 ? (i / (rows.length - 1)) * plotW : plotW / 2);
  const yAt = (v) => padT + plotH - (v / axisMax) * plotH;

  const linePath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(values[i]).toFixed(1)}`).join(' ');
  const areaPath = rows.length
    ? `${linePath} L ${xAt(rows.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : '';

  const handleMove = (e) => {
    if (!rows.length || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const d = Math.abs(xAt(i) - x);
      if (d < best) { best = d; nearest = i; }
    }
    setHoverIndex(nearest);
  };

  if (!rows.length) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-on-surface-variant text-xs gap-2">
        <span className="material-symbols-outlined text-4xl opacity-40">monitoring</span>
        No activity in this window yet.
      </div>
    );
  }

  const hovered = hoverIndex != null ? rows[hoverIndex] : null;
  const gradientId = `revtrend-${metric}`;
  const tooltipLeft = hoverIndex != null ? Math.min(Math.max(xAt(hoverIndex), 64), dims.width - 64) : 0;
  const showEvery = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <div
      ref={containerRef}
      className="relative h-[260px] select-none"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg width="100%" height="100%" className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={meta.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines — solid hairlines, never dashed, one step off surface */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL} x2={padL + plotW} y1={yAt(t)} y2={yAt(t)}
              stroke="currentColor" className="text-outline-variant/50" strokeWidth="1"
            />
            <text x={0} y={yAt(t) + 3} fontSize="9" fontWeight="700" className="fill-on-surface-variant/70 font-mono">
              {fmtKES(t)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* X-axis labels — sparse (endpoint + a handful in between), never every bucket */}
        {rows.map((r, i) => {
          if (i % showEvery !== 0 && i !== rows.length - 1) return null;
          return (
            <text
              key={r.bucket}
              x={xAt(i)}
              y={dims.height - 8}
              fontSize="9"
              fontWeight="700"
              textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
              className="fill-on-surface/70 font-mono"
            >
              {r.bucket.length > 7 ? r.bucket.slice(5) : r.bucket}
            </text>
          );
        })}

        {/* Crosshair — finds the X, snaps to the nearest bucket */}
        {hoverIndex != null && (
          <>
            <line
              x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={padT} y2={padT + plotH}
              stroke="currentColor" className="text-outline-variant" strokeWidth="1"
            />
            <circle
              cx={xAt(hoverIndex)} cy={yAt(values[hoverIndex])} r="4.5"
              fill={meta.color} stroke="white" strokeWidth="2"
            />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="absolute z-10 pointer-events-none bg-on-surface text-surface-container-lowest rounded-md px-3 py-2 shadow-lg text-2xs"
          style={{ left: tooltipLeft, top: 4, transform: 'translateX(-50%)' }}
        >
          <div className="font-bold uppercase tracking-widest opacity-70 mb-0.5">{hovered.bucket}</div>
          <div className="flex items-center gap-1.5 font-bold whitespace-nowrap">
            <span className="w-2 h-0.5 inline-block" style={{ backgroundColor: meta.color }} />
            {meta.label}: {fmtKESPrecise(hovered[meta.key])}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────
const Revenue = () => {
  const { admin: currentAdmin } = useAuth();
  const canRunSweep = currentAdmin?.role === 'owner' || currentAdmin?.role === 'admin';

  const [range, setRange] = useState('30d');
  const [granularity, setGranularity] = useState('daily');
  const [channelFilter, setChannelFilter] = useState('all');
  const [chartMetric, setChartMetric] = useState('gmv');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sweepsPage, setSweepsPage] = useState(1);

  // `silent` powers the live auto-refresh below — the dashboard holds its
  // previous render (no skeleton, no layout jump) while a background poll
  // is in flight, and a failed silent poll never clears already-good data
  // off the screen (only a real user-triggered load/range-change shows the
  // loading state and can blank the page on failure).
  const fetchRevenue = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    if (!silent) setError('');
    try {
      const res = await api.get('/api/admin/revenue', { params: { range } });
      setData(res.data?.data || null);
      if (silent) setError('');
    } catch (e) {
      if (!silent) {
        setError(e?.response?.data?.error || 'Could not load revenue.');
        setData(null);
      }
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  // Real sweep history — every actual RevenueSweep attempt (see
  // services/revenueSweepService.js), independent of `range` above since
  // it's a full log, not a windowed revenue figure.
  const [sweepHistory, setSweepHistory] = useState([]);
  const [sweepHistoryLoading, setSweepHistoryLoading] = useState(true);
  const [sweepHistoryPage, setSweepHistoryPage] = useState(1);

  const fetchSweepHistory = useCallback(async () => {
    setSweepHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/sweeps');
      setSweepHistory(res.data?.data || []);
    } catch (e) {
      setSweepHistory([]);
    } finally {
      setSweepHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchSweepHistory(); }, [fetchSweepHistory]);

  // Manual "Run Sweep Now" — POST /api/admin/revenue/sweeps/run. Distinct
  // from the `sweeps`/sweepBatches table below, which is a projected estimate
  // re-derived from transactions on every request; this actually attempts a
  // real PesaLink transfer of PayChain's accrued fee revenue (or a simulated
  // one, if NCBA_OPENBANKING_LIVE_ENABLED is off on the backend — this page
  // has no way to know which, so the confirmation copy covers both).
  const [sweepConfirmOpen, setSweepConfirmOpen] = useState(false);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); }, []);

  // Live — bank-dashboard-style background refresh every 30s, without
  // disturbing whatever the admin is looking at (hover state, scroll
  // position). Paused while the sweep confirmation modal is open, so a
  // refetch can't swap out `data.corporateDestination` out from under the
  // admin mid-confirmation.
  useEffect(() => {
    if (sweepConfirmOpen) return;
    const id = setInterval(() => fetchRevenue(true), 30_000);
    // Instant push on top of the 30s poll — see context/AuthContext.jsx's
    // SSE connection, which fires paychain:sync the moment any transaction
    // completes anywhere in PayChain.
    const onSync = () => fetchRevenue(true);
    window.addEventListener('paychain:sync', onSync);
    return () => { clearInterval(id); window.removeEventListener('paychain:sync', onSync); };
  }, [fetchRevenue, sweepConfirmOpen]);

  const runSweepNow = useCallback(async () => {
    setSweepBusy(true);
    try {
      const res = await api.post('/api/admin/revenue/sweeps/run');
      const sweep = res.data?.data;
      if (!sweep) {
        showToast('Sweep request failed — no response data.');
      } else if (sweep.status === 'completed') {
        showToast(
          `${sweep.simulated ? 'Simulated' : 'Real'} sweep completed: ${formatKES(sweep.amount || 0)} ${sweep.simulated ? '(no funds moved)' : `→ ${sweep.destinationAccountNumber}`}`
        );
      } else if (sweep.status === 'skipped') {
        showToast(`Sweep skipped: ${sweep.failureReason || 'nothing to sweep.'}`);
      } else {
        showToast(`Sweep failed: ${sweep.failureReason || 'unknown error.'}`);
      }
      fetchRevenue();
      fetchSweepHistory();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Sweep request failed.');
    } finally {
      setSweepBusy(false);
      setSweepConfirmOpen(false);
    }
  }, [showToast, fetchRevenue, fetchSweepHistory]);

  const kpis     = data?.kpis     || {};
  const channels = data?.channels || [];
  const sweeps   = data?.sweepBatches || [];
  const series   = data?.series   || [];
  const streams  = useMemo(
    () => [...(data?.streams || [])].sort((a, b) => b.revenue - a.revenue),
    [data]
  );

  // Real cash movement for the selected period — distinct from the fee
  // economics above (Gross/Net/Take Rate). Money In is what was actually
  // collected into the pooled FBO account (kpis.grossRevenue, already
  // period-scoped); Money Out is what real RevenueSweep attempts (not the
  // projected sweepBatches estimate) actually moved out of it into the
  // corporate account within that same window — sourced from the full
  // sweep log already loaded below, filtered to the period.
  const moneyOut = useMemo(() => {
    if (!data?.windowStart) return 0;
    const since = new Date(data.windowStart).getTime();
    return sweepHistory
      .filter((s) => s.status === 'completed' && new Date(s.createdAt).getTime() >= since)
      .reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [sweepHistory, data]);
  const moneyIn = kpis.grossRevenue || 0;
  const heldInFbo = Math.max(0, Math.round((moneyIn - moneyOut) * 100) / 100);

  // The backend's own bucket resolution already varies by range (hourly for
  // 24h, daily for 7d/30d, monthly for 90d/ytd/all — see
  // revenueController.js#bucketFormat) — the Daily/Weekly/Monthly switcher
  // below only makes sense when the source is actually daily. Re-bucketing
  // an already-monthly series into "weekly" buckets (rebucketSeries's
  // groupKey falls back to treating each YYYY-MM as a single fake week)
  // silently produced one misleading data point per month labeled as a
  // week, so the switcher is hidden and reset outside that range.
  useEffect(() => { setGranularity('daily'); setChannelFilter('all'); setSweepsPage(1); }, [range]);
  const pagedSweeps = useMemo(
    () => sweeps.slice((sweepsPage - 1) * PAGE_SIZE, sweepsPage * PAGE_SIZE),
    [sweeps, sweepsPage]
  );

  const pagedSweepHistory = useMemo(
    () => sweepHistory.slice((sweepHistoryPage - 1) * PAGE_SIZE, sweepHistoryPage * PAGE_SIZE),
    [sweepHistory, sweepHistoryPage]
  );

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
              <p className="text-2xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70 mb-2">Finance · Internal</p>
              <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter leading-none font-headline">
                Revenue &amp; Fees
              </h2>
              <p className="text-xs text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
                Split-settlement view of PayChain platform earnings. All figures are PayChain's share — strictly separated from merchant funds held in the FBO account.
              </p>
            </div>
            <button
              onClick={() => fetchRevenue()}
              title="Refresh"
              className="self-start sm:self-end w-9 h-9 inline-flex items-center justify-center bg-surface-container border border-outline-variant/40 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>

          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-on-surface-variant text-base">date_range</span>
              <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Period</span>
            </div>
            <div className="inline-flex bg-surface-container-lowest border border-outline-variant/40 rounded-md p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-2.5 py-1 text-2xs font-bold tracking-wider rounded transition-colors ${
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
              <span className="material-symbols-outlined text-on-surface-variant text-base">filter_alt</span>
              <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Channel</span>
            </div>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-md px-2.5 py-1.5 text-xs text-on-surface font-medium focus:outline-none focus:border-white/30 cursor-pointer"
            >
              {channelOptions.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All channels' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-xs px-4 py-3">
            {error}
          </div>
        )}

        {/* ── A. Financial-Summary metric cards ────────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-outline-variant/40 border border-outline-variant/40 rounded-lg overflow-hidden">
            {/* GMV — volume processed */}
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Gross Merchandise Volume</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-sm" title="Total transaction volume processed">payments</span>
              </div>
              {loading
                ? <Skel className="w-32 h-9" />
                : <span className="text-3xl md:text-3xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.gmv)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-2xs">
                  <span className={`font-bold tabular-nums ${(kpis.gmvChange || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmtChange(kpis.gmvChange)}
                  </span>
                  <span className="text-on-surface-variant">vs prev period</span>
                </div>
              )}
            </div>

            {/* Gross Platform Revenue */}
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Gross Platform Revenue</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-sm" title="Total fees collected at the take rate">request_quote</span>
              </div>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-3xl md:text-3xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.grossRevenue)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-2xs">
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
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Network &amp; Partner Costs</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-sm" title="Pass-through fees paid to networks (Safaricom, etc.)">output</span>
              </div>
              {loading
                ? <Skel className="w-24 h-9" />
                : <span className="text-3xl md:text-3xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">−{fmtKES(kpis.networkCosts)}</span>}
              <p className="text-2xs text-on-surface-variant">Paid to M-Pesa / banking rails</p>
            </div>

            {/* Net Revenue — THE bottom line. Subtle emerald tint + accent
                border so it pops from its three siblings without sacrificing
                contrast on the dark figure. */}
            <div className="bg-emerald-50 p-5 flex flex-col gap-2 relative border-l-2 border-emerald-500">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-emerald-700 uppercase tracking-[0.18em]">Net Revenue · Platform Margin</span>
                <span className="material-symbols-outlined text-emerald-700 text-sm" title="Gross revenue minus partner costs — PayChain's actual margin">savings</span>
              </div>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">{fmtKES(kpis.netRevenue)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-2xs">
                  <span className={`font-bold tabular-nums ${(kpis.netChange || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {fmtChange(kpis.netChange)}
                  </span>
                  <span className="text-on-surface-variant">vs prev · take {fmtPct((kpis.netRevenue || 0) / Math.max(kpis.gmv || 1, 1) * 100, 2)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── A2. Cash Position — real money movement, not fee economics ── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Cash Position — This Period</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                What actually moved. Money In is fees collected into the pooled FBO account; Money Out is what real sweep attempts
                (below) actually transferred to the corporate account in this window — not a projection.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-outline-variant/40 border border-outline-variant/40 rounded-lg overflow-hidden">
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Money In · Collected</span>
                <span className="material-symbols-outlined text-emerald-600 text-sm" title="Fees collected into the pooled FBO account this period">south_west</span>
              </div>
              {loading ? <Skel className="w-28 h-8" /> : <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{fmtKES(moneyIn)}</span>}
            </div>
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Money Out · Swept to Corporate</span>
                <span className="material-symbols-outlined text-blue-600 text-sm" title="Real completed RevenueSweep transfers out of the FBO account this period">north_east</span>
              </div>
              {sweepHistoryLoading ? <Skel className="w-28 h-8" /> : <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{fmtKES(moneyOut)}</span>}
            </div>
            <div className="bg-surface-container-lowest p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-[0.18em]">Held in FBO · Unswept</span>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-sm" title="Collected but not yet swept out — Money In minus Money Out">account_balance</span>
              </div>
              {loading || sweepHistoryLoading ? <Skel className="w-28 h-8" /> : <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{fmtKES(heldInFbo)}</span>}
            </div>
          </div>
        </section>

        {/* ── B. Volume vs Net Revenue chart + Channel breakdown ─── */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Chart */}
          <div className="xl:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-on-surface tracking-tight">Revenue Trend</h3>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-700" title="Refreshes automatically every 30s">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${refreshing ? 'animate-ping' : 'animate-pulse'}`} />
                    Live
                  </span>
                </div>
                <p className="text-2xs text-on-surface-variant mt-1">{CHART_METRICS[chartMetric].label} over time — every figure reconciles to the KPI strip above.</p>
              </div>
              {(range === '7d' || range === '30d') && (
                <div className="inline-flex bg-surface-container-lowest border border-outline-variant/40 rounded-md p-0.5">
                  {GRANULARITIES.map((g) => (
                    <button
                      key={g.v}
                      onClick={() => setGranularity(g.v)}
                      className={`px-2.5 py-1 text-2xs font-bold tracking-wider rounded transition-colors ${
                        granularity === g.v
                          ? 'bg-on-surface text-surface-container-lowest'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {g.l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Metric switcher — one series on screen at a time (never a
                dual-axis overlay), each metric permanently mapped to its
                own validated categorical color so the identity never shifts
                as the admin switches between them. */}
            {/* Same neutral "selected" treatment as the Period/Granularity
                switchers above — not a per-metric colored fill. Two of the
                four categorical hues (aqua, yellow) fall under 3:1 white-text
                contrast when used as a solid button fill (checked directly,
                since the dataviz palette validator only checks color-vs-
                surface, not color-vs-white-text); a neutral fill sidesteps
                that entirely and keeps identity on the dot, never the text,
                per the "text never wears the data color" rule. */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              {Object.entries(CHART_METRICS).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() => setChartMetric(key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-2xs font-bold tracking-wide transition-colors ${
                    chartMetric === key
                      ? 'bg-on-surface text-surface-container-lowest'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/70'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="h-[260px] flex items-center justify-center">
                <Skel className="w-full h-[200px]" />
              </div>
            ) : (
              <RevenueTrendChart series={seriesAtGranularity} metric={chartMetric} />
            )}
          </div>

          {/* Channel breakdown */}
          <div className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 md:p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-on-surface tracking-tight">Net Margin by Payment Rail</h3>
                <p className="text-2xs text-on-surface-variant mt-1">Which channel keeps the most after partner cuts.</p>
              </div>
            </div>
            {loading ? (
              <Skel className="w-full h-40" />
            ) : filteredChannels.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-on-surface-variant text-xs">
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
                          <span className="material-symbols-outlined text-lg" style={{ color: meta.dot }}>{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-on-surface truncate">{c.channel}</div>
                            <div className="text-2xs text-on-surface-variant tabular-nums">{fmtNum(c.count)} txns · GMV {fmtKES(c.gmv)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-on-surface tabular-nums">{fmtKESPrecise(c.net)}</div>
                          <div className="text-2xs text-on-surface-variant tabular-nums">{fmtPct(margin, 2)} margin</div>
                        </div>
                      </div>
                      <div className="h-1 bg-surface-container/70 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.dot }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-2xs text-on-surface-variant tabular-nums">
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

        {/* ── B2. Revenue Streams — every real channel PayChain earns on ── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Revenue Streams</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Every fee PayChain earns, by source — computed from the same persisted per-transaction fee this KPI strip reconciles to
                (config/revenueRateCard.js is the single rate-card source of truth). "Pilot" streams are priced but not yet wired to a real charge.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-40" /></div>
            ) : streams.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">No revenue streams configured.</div>
            ) : (
              <div className="divide-y divide-outline-variant/40">
                {streams.map((s) => {
                  const accent = STREAM_ACCENT[s.accent] || DEFAULT_STREAM_ACCENT;
                  const maxRevenue = Math.max(...streams.map((x) => x.revenue), 1);
                  const pct = (s.revenue / maxRevenue) * 100;
                  return (
                    <div key={s.id} className="p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent.bg}`}>
                            <span className={`material-symbols-outlined text-lg ${accent.text}`}>{s.icon || 'category'}</span>
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-on-surface">{s.label}</span>
                              {s.pilot && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-outline-variant/40 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Pilot</span>
                              )}
                              {s.tiered && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-outline-variant/40 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Tiered</span>
                              )}
                            </div>
                            <p className="text-2xs text-on-surface-variant mt-1 leading-relaxed max-w-2xl">{s.description}</p>
                            <p className="text-2xs text-on-surface-variant/70 mt-1 tabular-nums">{fmtNum(s.count)} txns · Volume {fmtKES(s.volume)}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-on-surface tabular-nums">{fmtKESPrecise(s.revenue)}</div>
                          <div className="flex items-center justify-end gap-1.5 text-2xs tabular-nums mt-0.5">
                            <span className={`font-bold ${(s.change || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtChange(s.change)}</span>
                            <span className="text-on-surface-variant">· {fmtPct(s.share, 1)} of total</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-1 bg-surface-container/70 rounded-full overflow-hidden ml-12">
                        <div className={`h-full transition-all duration-500 ${accent.bar}`} style={{ width: `${pct}%` }} />
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
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Revenue Sweeps &amp; Settlement Batches</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Automated movement of accumulated fees from the PayChain FBO settlement account into the corporate operating account.
                Only <strong>Gross Fees</strong> is the amount actually swept — <strong>Net Margin</strong> is after absorbing Safaricom's
                pass-through cost (Processor Cuts) and can go negative on weeks dominated by free-tier transactions PayChain doesn't
                mark up but still pays Safaricom's real cost on; that's a margin figure, not money leaving the account.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && data?.corporateDestination && (
                <div className="hidden md:flex items-center gap-2 text-2xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">account_balance</span>
                  <span>Destination: <span className="text-on-surface font-bold">{data.corporateDestination}</span></span>
                </div>
              )}
              {canRunSweep && (
                <button
                  onClick={() => setSweepConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-on-surface text-surface-container-lowest text-2xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Run Sweep Now
                </button>
              )}
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : sweeps.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">
                No sweep batches in this window yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3">Batch ID</th>
                      <th className="text-left px-3 py-3">Period</th>
                      <th className="text-right px-3 py-3">Gross Fees</th>
                      <th className="text-right px-3 py-3">Processor Cuts</th>
                      <th className="text-right px-3 py-3" title="Gross Fees minus the absorbed Safaricom pass-through cost — PayChain's retained margin, not the amount physically swept (that's Gross Fees).">Net Margin</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-left px-5 py-3">Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSweeps.map((b) => {
                      const s = STATUS_META[b.status] || STATUS_META['Accruing'];
                      return (
                        <tr key={b.id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-on-surface font-bold">{b.id}</div>
                            <div className="text-2xs text-on-surface-variant">{fmtNum(b.count)} fees</div>
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
                            <span className={`font-bold tabular-nums ${b.net < 0 ? 'text-red-600' : 'text-on-surface'}`}>{fmtKESPrecise(b.net)}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <span
                              title={b.note || undefined}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${s.border} ${s.bg} ${s.text} text-2xs font-bold uppercase tracking-wider ${b.note ? 'cursor-help' : ''}`}
                            >
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
            {!loading && sweeps.length > 0 && (
              <TablePagination page={sweepsPage} pageSize={PAGE_SIZE} total={sweeps.length} onPage={setSweepsPage} />
            )}
          </div>

          {/* Reconciliation footer — totals always reconcile to the KPIs above, not just the current page */}
          {!loading && sweeps.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-md text-2xs">
              <span className="text-on-surface-variant">
                Showing {sweeps.length} batches · figures reconcile to KPI strip
              </span>
              <div className="flex items-center gap-5 tabular-nums">
                <span className="text-on-surface-variant">Σ Gross <span className="text-on-surface font-bold">{fmtKESPrecise(sweeps.reduce((s, b) => s + b.gross, 0))}</span></span>
                <span className="text-on-surface-variant">Σ Cuts <span className="text-on-surface font-bold">−{fmtKESPrecise(sweeps.reduce((s, b) => s + b.costs, 0))}</span></span>
                {(() => {
                  const totalNet = sweeps.reduce((s, b) => s + b.net, 0);
                  return (
                    <span className={`font-bold ${totalNet < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      Σ Net Margin {fmtKESPrecise(totalNet)}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </section>

        {/* ── C2. Sweep History — the real RevenueSweep log ─────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Sweep History</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Every real sweep attempt on record — what actually ran, not a projection. Independent of the date range above.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {sweepHistoryLoading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : sweepHistory.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">
                No sweep attempts recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3">Ran At</th>
                      <th className="text-left px-3 py-3">Period Covered</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-right px-3 py-3">Amount</th>
                      <th className="text-right px-3 py-3">Txns</th>
                      <th className="text-left px-3 py-3">Destination</th>
                      <th className="text-left px-5 py-3">Reference / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSweepHistory.map((s) => {
                      const meta = RAW_STATUS_META[s.status] || RAW_STATUS_META.skipped;
                      const amount = s.status === 'completed' ? s.amount : s.attemptedAmount;
                      const destination = s.destinationBankCode && s.destinationAccountNumber
                        ? `${s.destinationBankCode} · ${s.destinationAccountNumber}`
                        : '— not configured';
                      return (
                        <tr key={s._id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                          <td className="px-5 py-3.5 text-on-surface tabular-nums">
                            {fmtDateTime(s.createdAt)}
                          </td>
                          <td className="px-3 py-3.5 text-on-surface-variant tabular-nums">
                            {fmtDateTime(s.periodStart)} – {fmtDateTime(s.periodEnd)}
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${meta.border} ${meta.bg} ${meta.text} text-2xs font-bold uppercase tracking-wider`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {s.status}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            <span className="font-bold text-on-surface">{fmtKESPrecise(amount)}</span>
                            {s.status !== 'completed' && <span className="block text-2xs text-on-surface-variant normal-case">attempted</span>}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface-variant">
                            {fmtNum(s.transactionCount)}
                          </td>
                          <td className="px-3 py-3.5 text-on-surface-variant tabular-nums">
                            {destination}
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant">
                            {s.status === 'completed' ? (
                              <span className="font-mono text-on-surface">
                                {s.ncbaReference || '—'}
                                {s.simulated && <span className="ml-1.5 text-2xs font-sans text-amber-700">(simulated)</span>}
                              </span>
                            ) : (
                              <span>{s.failureReason || '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!sweepHistoryLoading && sweepHistory.length > 0 && (
              <TablePagination page={sweepHistoryPage} pageSize={PAGE_SIZE} total={sweepHistory.length} onPage={setSweepHistoryPage} />
            )}
          </div>
        </section>

        {/* ── Top merchants (kept from previous iteration) ─────────── */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Top revenue-generating merchants</h3>
              <p className="text-xs text-on-surface-variant mt-1">Ranked by net PayChain margin contributed this period.</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : (data?.topMerchants || []).length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">No merchant revenue yet in this window.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3 w-10">#</th>
                      <th className="text-left px-3 py-3">Merchant</th>
                      <th className="text-right px-3 py-3">GMV</th>
                      <th className="text-right px-3 py-3">Txns</th>
                      <th className="text-right px-3 py-3">Lifetime KES</th>
                      <th className="text-right px-3 py-3">Lifetime USDC</th>
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
                              <div className="text-2xs text-on-surface-variant truncate max-w-[280px]">
                                {m.email}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface">{fmtKES(m.volume)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-on-surface">{fmtNum(m.count)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-emerald-600 font-bold">{fmtKES(m.lifetimeKesVolume)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-blue-600 font-bold">{fmtUSDC(m.lifetimeUsdcVolume)}</td>
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
            <span className="material-symbols-outlined text-on-surface-variant text-lg mt-0.5 flex-shrink-0">shield_lock</span>
            <p className="text-2xs text-on-surface-variant leading-relaxed">
              <span className="text-on-surface font-bold">Split-settlement architecture.</span>{' '}
              Customer funds and PayChain fees are settled to separate ledger accounts at processing time. Figures on this page reflect only the PayChain share — they are isolated from merchant balances and the FBO trust account. All values reconcile to the live transactions collection.
            </p>
          </div>
        </section>
      </div>

      {/* Run Sweep Now — confirmation */}
      {sweepConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !sweepBusy && setSweepConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-7">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">bolt</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-1">Run revenue sweep now?</h3>
              <p className="text-sm text-on-surface-variant mb-5">
                This attempts an immediate transfer of PayChain's entire accrued-but-unswept fee revenue to{' '}
                <strong>{data?.corporateDestination || 'the configured destination account'}</strong> — the full real amount, not a test figure.
                If live NCBA transfers are enabled on the backend, this moves real money and cannot be undone. If they're not enabled, it simulates the transfer and moves nothing.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setSweepConfirmOpen(false)} disabled={sweepBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                <button onClick={runSweepNow} disabled={sweepBusy} className="flex-1 py-2.5 rounded-lg bg-on-surface text-surface-container-lowest text-sm font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50">
                  {sweepBusy ? 'Running…' : 'Run Sweep'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold max-w-sm">{toast}</div>
      )}
    </Layout>
  );
};

export default Revenue;
