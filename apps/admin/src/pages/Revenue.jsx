import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// ── Constants ─────────────────────────────────────────────────────────
const RANGES = [
  { v: '24h', l: '24H' },
  { v: '7d',  l: '7D' },
  { v: '30d', l: '30D' },
  { v: '90d', l: '90D' },
  { v: 'ytd', l: 'YTD' },
  { v: 'all', l: 'ALL' },
];

// Accent → Tailwind class map. Keep all classes literal so JIT picks them up.
const ACCENTS = {
  emerald: {
    bg:      'bg-emerald-50',
    bgDark:  'bg-emerald-500/10',
    text:    'text-emerald-700',
    textDark:'text-emerald-300',
    border:  'border-emerald-200',
    borderDark:'border-emerald-500/30',
    bar:     'bg-emerald-500',
    barLight:'bg-emerald-100',
    chip:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot:     '#10B981',
    gradient:'from-emerald-500/20 to-emerald-500/0',
  },
  pink: {
    bg:      'bg-pink-50',
    bgDark:  'bg-pink-500/10',
    text:    'text-pink-700',
    textDark:'text-pink-300',
    border:  'border-pink-200',
    borderDark:'border-pink-500/30',
    bar:     'bg-pink-500',
    barLight:'bg-pink-100',
    chip:    'bg-pink-500/15 text-pink-300 border-pink-500/30',
    dot:     '#EC4899',
    gradient:'from-pink-500/20 to-pink-500/0',
  },
  blue: {
    bg:      'bg-blue-50',
    bgDark:  'bg-blue-500/10',
    text:    'text-blue-700',
    textDark:'text-blue-300',
    border:  'border-blue-200',
    borderDark:'border-blue-500/30',
    bar:     'bg-blue-500',
    barLight:'bg-blue-100',
    chip:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dot:     '#3B82F6',
    gradient:'from-blue-500/20 to-blue-500/0',
  },
  amber: {
    bg:      'bg-amber-50',
    bgDark:  'bg-amber-500/10',
    text:    'text-amber-700',
    textDark:'text-amber-300',
    border:  'border-amber-200',
    borderDark:'border-amber-500/30',
    bar:     'bg-amber-500',
    barLight:'bg-amber-100',
    chip:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot:     '#F59E0B',
    gradient:'from-amber-500/20 to-amber-500/0',
  },
  violet: {
    bg:      'bg-violet-50',
    bgDark:  'bg-violet-500/10',
    text:    'text-violet-700',
    textDark:'text-violet-300',
    border:  'border-violet-200',
    borderDark:'border-violet-500/30',
    bar:     'bg-violet-500',
    barLight:'bg-violet-100',
    chip:    'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dot:     '#8B5CF6',
    gradient:'from-violet-500/20 to-violet-500/0',
  },
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
  if (n == null || isNaN(n)) return 'KES 0';
  return `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};
const fmtPct = (n, decimals = 1) => {
  if (n == null || isNaN(n)) return '0%';
  return `${Number(n).toFixed(decimals)}%`;
};
const fmtChange = (n) => {
  if (n == null || isNaN(n)) return '—';
  const v = Number(n);
  if (v > 0) return `+${v.toFixed(1)}%`;
  return `${v.toFixed(1)}%`;
};
const fmtRate = (r) => `${(r * 100).toFixed(2)}%`;

// ── Skeleton ──────────────────────────────────────────────────────────
const Skel = ({ className = 'w-16 h-7' }) => (
  <span className={`inline-block ${className} bg-white/10 rounded animate-pulse align-middle`} aria-hidden="true" />
);

// ── Stacked time series chart ─────────────────────────────────────────
const StackedSeries = ({ series, streams }) => {
  const buckets = series || [];
  if (!buckets.length) {
    return (
      <div className="h-[280px] flex flex-col items-center justify-center text-on-surface-variant/60 text-[13px] gap-2">
        <span className="material-symbols-outlined text-[36px] opacity-50">monitoring</span>
        No revenue activity in this window yet.
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const active = streams.filter((s) => s.revenue > 0);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {active.map((s) => {
          const a = ACCENTS[s.accent] || ACCENTS.blue;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.dot }} />
              <span className="text-on-surface-variant">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1 h-[220px] pb-7 relative">
        {buckets.map((b, idx) => {
          const heightPct = Math.max(2, (b.total / max) * 100);
          return (
            <div key={`${b.bucket}-${idx}`} className="flex-1 flex flex-col items-center group relative min-w-[8px]">
              {b.total > 0 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white/70 whitespace-nowrap tabular-nums">
                  {fmtKES(b.total)}
                </div>
              )}
              <div
                className="w-full flex flex-col-reverse rounded-t overflow-hidden transition-transform group-hover:scale-[1.04]"
                style={{ height: `${heightPct}%` }}
                title={`${b.bucket} — ${fmtKESPrecise(b.total)}`}
              >
                {active.map((s) => {
                  const v = b[s.id] || 0;
                  if (v <= 0) return null;
                  const pct = (v / b.total) * 100;
                  const a = ACCENTS[s.accent] || ACCENTS.blue;
                  return (
                    <div
                      key={s.id}
                      style={{ height: `${pct}%`, background: a.dot }}
                      title={`${s.label}: ${fmtKESPrecise(v)}`}
                    />
                  );
                })}
              </div>
              <div className="absolute -bottom-6 text-[9px] text-on-surface-variant/50 truncate w-full text-center font-mono">
                {b.bucket.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────
const Revenue = () => {
  const [range, setRange] = useState('30d');
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

  const kpis    = data?.kpis    || {};
  const streams = data?.streams || [];
  const series  = data?.series  || [];
  const top     = data?.topMerchants || [];

  const topStream = useMemo(
    () => [...streams].sort((a, b) => b.revenue - a.revenue)[0],
    [streams]
  );

  return (
    <Layout>
      <div className="space-y-8 md:space-y-10">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-emerald-400 text-[24px]">trending_up</span>
              <h2 className="text-[22px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Revenue</h2>
            </div>
            <p className="text-[13px] md:text-[14px] text-on-surface-variant">
              Live earnings across every PayChain revenue stream — fees, FX spread, settlement and stablecoin payments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-wider rounded-md transition-all ${
                    range === r.v
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                  }`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <button
              onClick={fetchRevenue}
              title="Refresh"
              className="w-9 h-9 inline-flex items-center justify-center bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface-variant hover:text-emerald-300 hover:border-emerald-500/40 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-[13px] px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Hero KPI cards ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-label">Snapshot</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Total Revenue — hero */}
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-emerald-900/40 via-[#0F141E] to-[#0A0D14] p-5 md:p-7 rounded-2xl border border-emerald-500/20 overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] md:text-[11px] font-bold text-emerald-300/80 uppercase tracking-widest">Total Revenue</span>
                  <span className="text-[10px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                    {RANGES.find((r) => r.v === range)?.l}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  {loading
                    ? <Skel className="w-40 h-10 bg-white/10" />
                    : <span className="text-[32px] md:text-[44px] font-bold text-white tracking-tighter leading-none">
                        {fmtKES(kpis.totalRevenue)}
                      </span>}
                </div>
                <div className="flex items-baseline gap-2 mt-2 text-[12px]">
                  {!loading && (
                    <>
                      <span className={`font-bold ${
                        (kpis.change || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}>
                        {fmtChange(kpis.change)}
                      </span>
                      <span className="text-on-surface-variant/60">vs previous period</span>
                    </>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-emerald-500/15">
                  <p className="text-[11px] text-on-surface-variant/60 mb-1 uppercase tracking-widest font-bold">Projected ARR</p>
                  <p className="text-[18px] md:text-[22px] font-bold text-emerald-200 tabular-nums tracking-tight">
                    {loading ? <Skel className="w-32 h-7 bg-white/10" /> : fmtKES(kpis.projectedARR)}
                  </p>
                </div>
              </div>
            </div>

            {/* Take Rate */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-4 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1.5 group hover:border-pink-500/30 transition-all">
              <span className="text-[10px] md:text-[11px] font-bold text-pink-300/80 uppercase tracking-widest">Effective Take Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-20 h-8 bg-white/10" />
                  : <span className="text-[24px] md:text-[30px] font-bold text-white tracking-tighter">{fmtPct(kpis.takeRate, 2)}</span>}
              </div>
              <p className="text-[11px] text-on-surface-variant/60 mt-1">
                Revenue / volume across all streams
              </p>
            </div>

            {/* Volume processed */}
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-4 md:p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-1.5 group hover:border-blue-500/30 transition-all">
              <span className="text-[10px] md:text-[11px] font-bold text-blue-300/80 uppercase tracking-widest">Volume Processed</span>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <Skel className="w-24 h-8 bg-white/10" />
                  : <span className="text-[24px] md:text-[30px] font-bold text-white tracking-tighter">{fmtKES(kpis.totalVolume)}</span>}
              </div>
              <p className="text-[11px] text-on-surface-variant/60 mt-1">
                {loading ? <Skel className="w-12 h-3 bg-white/10" /> : `${fmtNum(kpis.totalCount)} fee-bearing transactions`}
              </p>
            </div>
          </div>
        </section>

        {/* ── Revenue Streams ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-label">Revenue Streams</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            {!loading && topStream && (
              <span className="text-[10px] md:text-[11px] text-on-surface-variant/60">
                Top earner: <span className="text-emerald-300 font-bold">{topStream.label}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {streams.map((s) => {
              const a = ACCENTS[s.accent] || ACCENTS.blue;
              return (
                <div
                  key={s.id}
                  className={`relative bg-gradient-to-br from-[#0F141E] to-[#0A0D14] p-5 rounded-xl border ${a.borderDark} flex flex-col gap-3 group hover:scale-[1.01] transition-all overflow-hidden`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-12 -mt-12 blur-2xl bg-gradient-to-br ${a.gradient} pointer-events-none`}></div>

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg ${a.bgDark} flex items-center justify-center ${a.textDark}`}>
                        <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-bold text-white truncate">{s.label}</h3>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/50">
                          {fmtRate(s.rate)}{s.minFee > 0 ? ` · min KES ${s.minFee}` : ''}
                        </p>
                      </div>
                    </div>
                    {s.pilot && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded">
                        Pilot
                      </span>
                    )}
                  </div>

                  <p className="text-[12px] text-on-surface-variant/70 leading-snug relative line-clamp-2">
                    {s.description}
                  </p>

                  <div className="relative pt-2">
                    <div className="flex items-baseline gap-2">
                      {loading
                        ? <Skel className="w-28 h-7 bg-white/10" />
                        : <span className="text-[22px] md:text-[26px] font-bold text-white tracking-tighter tabular-nums">
                            {fmtKES(s.revenue)}
                          </span>}
                      {!loading && s.revenue > 0 && (
                        <span className={`text-[11px] font-bold ${a.textDark}`}>
                          {fmtPct(s.share)} share
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-on-surface-variant/60 tabular-nums">
                        {loading ? <Skel className="w-20 h-3 bg-white/10" /> : `${fmtNum(s.count)} txns · ${fmtKES(s.volume)}`}
                      </span>
                      {!loading && s.prevRevenue > 0 && (
                        <span className={`font-bold ${
                          s.change >= 0 ? 'text-emerald-300' : 'text-red-300'
                        }`}>
                          {fmtChange(s.change)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Share bar */}
                  <div className="relative">
                    <div className={`h-1.5 rounded-full ${a.bgDark} overflow-hidden`}>
                      <div
                        className={`h-full ${a.bar} transition-all duration-500`}
                        style={{ width: `${Math.min(100, s.share || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Time series ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-label">Revenue Trend</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
            <span className="text-[10px] md:text-[11px] text-on-surface-variant/60">
              Stacked by stream
            </span>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-5 md:p-6">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skel className="w-full h-[200px] bg-white/5" />
              </div>
            ) : (
              <StackedSeries series={series} streams={streams} />
            )}
          </div>
        </section>

        {/* ── Top fee-generating merchants ─────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest font-label">Top Revenue-Generating Merchants</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <Skel className="w-full h-32 bg-white/5" />
              </div>
            ) : top.length === 0 ? (
              <div className="p-10 text-center text-on-surface-variant/60 text-[13px]">
                No merchant revenue yet in this window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-white/[0.02] border-b border-outline-variant/20">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                      <th className="text-left px-5 py-3 w-10">#</th>
                      <th className="text-left px-3 py-3">Merchant</th>
                      <th className="text-right px-3 py-3">Volume</th>
                      <th className="text-right px-3 py-3">Txns</th>
                      <th className="text-right px-5 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((m, i) => {
                      const maxRev = top[0]?.revenue || 1;
                      const pct = (m.revenue / maxRev) * 100;
                      return (
                        <tr key={m.merchantId || i} className="border-b border-outline-variant/10 hover:bg-emerald-900/10 transition-colors group">
                          <td className="px-5 py-3 text-on-surface-variant/60 font-mono text-[12px]">{i + 1}</td>
                          <td className="px-3 py-3">
                            <Link
                              to={`/merchants?id=${m.merchantId}`}
                              className="block group-hover:text-emerald-300 transition-colors"
                            >
                              <div className="font-bold text-white truncate max-w-[280px]">
                                {m.businessName || '—'}
                              </div>
                              <div className="text-[11px] text-on-surface-variant/60 truncate max-w-[280px]">
                                {m.email}
                                {m.paybillAccount ? <span className="ml-2 font-mono text-emerald-300/80">·{m.paybillAccount}</span> : null}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-on-surface-variant/80">
                            {fmtKES(m.volume)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-on-surface-variant/80">
                            {fmtNum(m.count)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold text-white tabular-nums">{fmtKESPrecise(m.revenue)}</span>
                              <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                  style={{ width: `${pct}%` }}
                                />
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

        {/* ── Rate card footer ─────────────────────────────────────── */}
        <section>
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-on-surface-variant/60 text-[18px]">policy</span>
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Active Rate Card</h3>
            </div>
            <p className="text-[12px] text-on-surface-variant/70 mb-4">
              These are the live rates PayChain charges across every stream. Revenue on this page is computed from completed transactions at these rates — single source of truth.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px]">
              {streams.map((s) => {
                const a = ACCENTS[s.accent] || ACCENTS.blue;
                return (
                  <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${a.borderDark} bg-white/[0.02]`}>
                    <span className={`w-2 h-2 rounded-full`} style={{ background: a.dot }} />
                    <div className="min-w-0">
                      <div className="text-white font-bold truncate">{s.label}</div>
                      <div className="text-on-surface-variant/60 font-mono">{fmtRate(s.rate)}{s.minFee > 0 ? ` · ≥${s.minFee}` : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Revenue;
