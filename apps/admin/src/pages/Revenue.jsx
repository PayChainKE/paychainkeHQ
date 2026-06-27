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

// Safaricom M-Pesa tariff (pass-through, KES). Displayed for transparency.
const MPESA_TARIFF_DISPLAY = [
  { label: '1 – 100',          fee: 0   },
  { label: '101 – 500',        fee: 7   },
  { label: '501 – 1,000',      fee: 13  },
  { label: '1,001 – 1,500',    fee: 23  },
  { label: '1,501 – 2,500',    fee: 33  },
  { label: '2,501 – 3,500',    fee: 53  },
  { label: '3,501 – 5,000',    fee: 57  },
  { label: '5,001 – 7,500',    fee: 78  },
  { label: '7,501 – 10,000',   fee: 90  },
  { label: '10,001 – 15,000',  fee: 100 },
  { label: '15,001 – 20,000',  fee: 105 },
  { label: '20,001 – 500,000', fee: 108 },
];

// Solid accent colours per revenue stream. Used only for the small dot/bar
// segment — the rest of every card uses the neutral monochrome palette so
// the page reads cleanly without competing colour gradients.
const ACCENT_DOT = {
  emerald: '#10B981',
  pink:    '#EC4899',
  blue:    '#3B82F6',
  amber:   '#F59E0B',
  violet:  '#8B5CF6',
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
  <span className={`inline-block ${className} bg-white/[0.06] rounded align-middle animate-pulse`} aria-hidden="true" />
);

// ── Stacked time series chart ─────────────────────────────────────────
const StackedSeries = ({ series, streams }) => {
  const buckets = series || [];
  if (!buckets.length) {
    return (
      <div className="h-[240px] flex flex-col items-center justify-center text-white/40 text-[13px] gap-2">
        <span className="material-symbols-outlined text-[32px] opacity-40">monitoring</span>
        No revenue activity in this window yet.
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const active = streams.filter((s) => s.revenue > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        {active.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: ACCENT_DOT[s.accent] || ACCENT_DOT.blue }} />
            <span className="text-white/60">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-1 h-[220px] pb-7 relative">
        {buckets.map((b, idx) => {
          const heightPct = Math.max(2, (b.total / max) * 100);
          return (
            <div key={`${b.bucket}-${idx}`} className="flex-1 flex flex-col items-center group relative min-w-[8px]">
              {b.total > 0 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white/70 whitespace-nowrap tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {fmtKES(b.total)}
                </div>
              )}
              <div
                className="w-full flex flex-col-reverse rounded-sm overflow-hidden"
                style={{ height: `${heightPct}%` }}
                title={`${b.bucket} — ${fmtKESPrecise(b.total)}`}
              >
                {active.map((s) => {
                  const v = b[s.id] || 0;
                  if (v <= 0) return null;
                  const pct = (v / b.total) * 100;
                  return (
                    <div
                      key={s.id}
                      style={{ height: `${pct}%`, background: ACCENT_DOT[s.accent] || ACCENT_DOT.blue }}
                      title={`${s.label}: ${fmtKESPrecise(v)}`}
                    />
                  );
                })}
              </div>
              <div className="absolute -bottom-6 text-[9px] text-white/40 truncate w-full text-center font-mono">
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
      <div className="space-y-10">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 mb-2">Finance</p>
            <h2 className="text-[28px] md:text-[36px] font-bold text-white tracking-tighter leading-none">
              Revenue
            </h2>
            <p className="text-[13px] text-white/60 mt-2 max-w-xl">
              Live earnings across every PayChain revenue stream — fees, FX spread, settlement and stablecoin payments. All figures shown are amounts routed to the PayChain settlement account.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-white/[0.03] border border-white/10 rounded-md p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-wider rounded transition-colors ${
                    range === r.v
                      ? 'bg-white text-[#0A0D14]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <button
              onClick={fetchRevenue}
              title="Refresh"
              className="w-9 h-9 inline-flex items-center justify-center bg-white/[0.03] border border-white/10 rounded-md text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] text-red-200 text-[13px] px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Hero KPI strip ──────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-lg overflow-hidden">
            {/* Total Revenue */}
            <div className="bg-[#0A0D14] p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.18em]">Total Revenue</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{RANGES.find((r) => r.v === range)?.l}</span>
              </div>
              {loading
                ? <Skel className="w-32 h-9" />
                : <span className="text-[28px] md:text-[34px] font-bold text-white tracking-tighter leading-none tabular-nums">{fmtKES(kpis.totalRevenue)}</span>}
              {!loading && (
                <div className="flex items-baseline gap-1.5 text-[12px]">
                  <span className={`font-bold tabular-nums ${(kpis.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtChange(kpis.change)}
                  </span>
                  <span className="text-white/40">vs previous</span>
                </div>
              )}
            </div>

            {/* Take Rate */}
            <div className="bg-[#0A0D14] p-6 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.18em]">Take Rate</span>
              {loading
                ? <Skel className="w-24 h-9" />
                : <span className="text-[28px] md:text-[34px] font-bold text-white tracking-tighter leading-none tabular-nums">{fmtPct(kpis.takeRate, 2)}</span>}
              <p className="text-[12px] text-white/40">Revenue ÷ volume</p>
            </div>

            {/* Volume */}
            <div className="bg-[#0A0D14] p-6 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.18em]">Volume Processed</span>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-[28px] md:text-[34px] font-bold text-white tracking-tighter leading-none tabular-nums">{fmtKES(kpis.totalVolume)}</span>}
              <p className="text-[12px] text-white/40">{loading ? <Skel className="w-12 h-3" /> : `${fmtNum(kpis.totalCount)} fee-bearing transactions`}</p>
            </div>

            {/* Projected ARR */}
            <div className="bg-[#0A0D14] p-6 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.18em]">Projected ARR</span>
              {loading
                ? <Skel className="w-28 h-9" />
                : <span className="text-[28px] md:text-[34px] font-bold text-white tracking-tighter leading-none tabular-nums">{fmtKES(kpis.projectedARR)}</span>}
              <p className="text-[12px] text-white/40">Linear run-rate</p>
            </div>
          </div>

          {/* Secondary row — Safaricom passthrough + policy banner */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#0A0D14] border border-white/10 rounded-lg p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.18em]">Safaricom Pass-through</span>
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">Cost</span>
              </div>
              {loading
                ? <Skel className="w-24 h-7" />
                : <span className="text-[22px] font-bold text-white tracking-tight tabular-nums">{fmtKES(kpis.safaricomPassthrough)}</span>}
              <p className="text-[11px] text-white/40">Paid to Safaricom on M-Pesa transactions — not retained by PayChain.</p>
            </div>
            <div className="lg:col-span-2 bg-[#0A0D14] border border-white/10 rounded-lg p-5 flex items-start gap-3">
              <span className="material-symbols-outlined text-white/40 text-[18px] mt-0.5 flex-shrink-0">policy</span>
              <p className="text-[12px] text-white/70 leading-relaxed">
                <span className="text-white font-bold">Universal pricing.</span>{' '}
                PayChain charges <span className="text-white font-bold">+0.50%</span> on every transaction across every merchant account, on top of the standard Safaricom M-Pesa tariff. FX conversions (KES ↔ USDC) carry a <span className="text-white font-bold">2.00%</span> spread — aligned to Kotani Pay and HoneyCoin. All fees route directly to the PayChain settlement account.
              </p>
            </div>
          </div>
        </section>

        {/* ── Revenue Streams ─────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h3 className="text-[16px] font-bold text-white tracking-tight">Revenue streams</h3>
              <p className="text-[12px] text-white/40 mt-1">Per-stream contribution to total revenue this period.</p>
            </div>
            {!loading && topStream && (
              <span className="text-[11px] text-white/50">
                Top: <span className="text-white font-bold">{topStream.label}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-lg overflow-hidden">
            {streams.map((s) => {
              const dot = ACCENT_DOT[s.accent] || ACCENT_DOT.blue;
              return (
                <div key={s.id} className="bg-[#0A0D14] p-5 flex flex-col gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/80">
                        <span className="material-symbols-outlined text-[19px]">{s.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-bold text-white truncate">{s.label}</h4>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                          {fmtRate(s.rate)}{s.minFee > 0 ? ` · min KES ${s.minFee}` : ''}
                        </p>
                      </div>
                    </div>
                    {s.pilot && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded">
                        Pilot
                      </span>
                    )}
                  </div>

                  <p className="text-[12px] text-white/55 leading-snug line-clamp-2">
                    {s.description}
                  </p>

                  <div className="pt-1">
                    <div className="flex items-baseline gap-2">
                      {loading
                        ? <Skel className="w-24 h-7" />
                        : <span className="text-[22px] font-bold text-white tracking-tighter tabular-nums">{fmtKES(s.revenue)}</span>}
                      {!loading && s.revenue > 0 && (
                        <span className="text-[11px] font-bold text-white/50 tabular-nums">{fmtPct(s.share)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-white/40 tabular-nums">
                        {loading ? <Skel className="w-20 h-3" /> : `${fmtNum(s.count)} txns · ${fmtKES(s.volume)}`}
                      </span>
                      {!loading && s.prevRevenue > 0 && (
                        <span className={`font-bold tabular-nums ${s.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtChange(s.change)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, s.share || 0)}%`, background: dot }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Time series ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h3 className="text-[16px] font-bold text-white tracking-tight">Revenue trend</h3>
              <p className="text-[12px] text-white/40 mt-1">Stacked by stream over the selected window.</p>
            </div>
          </div>
          <div className="bg-[#0A0D14] border border-white/10 rounded-lg p-6">
            {loading ? (
              <div className="h-[240px] flex items-center justify-center">
                <Skel className="w-full h-[200px]" />
              </div>
            ) : (
              <StackedSeries series={series} streams={streams} />
            )}
          </div>
        </section>

        {/* ── Top merchants ────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h3 className="text-[16px] font-bold text-white tracking-tight">Top revenue-generating merchants</h3>
              <p className="text-[12px] text-white/40 mt-1">Ranked by total PayChain fees earned this period.</p>
            </div>
          </div>
          <div className="bg-[#0A0D14] border border-white/10 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : top.length === 0 ? (
              <div className="p-12 text-center text-white/40 text-[13px]">
                No merchant revenue yet in this window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-white/[0.02] border-b border-white/10">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
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
                        <tr key={m.merchantId || i} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-3.5 text-white/40 font-mono text-[12px]">{i + 1}</td>
                          <td className="px-3 py-3.5">
                            <Link to={`/merchants?id=${m.merchantId}`} className="block group-hover:opacity-90 transition-opacity">
                              <div className="font-bold text-white truncate max-w-[280px]">
                                {m.businessName || '—'}
                              </div>
                              <div className="text-[11px] text-white/40 truncate max-w-[280px]">
                                {m.email}
                                {m.paybillAccount ? <span className="ml-2 font-mono text-white/60">·{m.paybillAccount}</span> : null}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-white/70">
                            {fmtKES(m.volume)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-white/70">
                            {fmtNum(m.count)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="font-bold text-white tabular-nums">{fmtKESPrecise(m.revenue)}</span>
                              <div className="h-[3px] w-24 bg-white/[0.06] rounded-full overflow-hidden">
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

        {/* ── Rate cards ──────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0A0D14] border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">PayChain Rate Card</h3>
            </div>
            <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
              Live rates PayChain earns per stream. Single source of truth — every transaction across every merchant account is priced from this table.
            </p>
            <div className="space-y-1">
              {streams.map((s) => {
                const dot = ACCENT_DOT[s.accent] || ACCENT_DOT.blue;
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                      <span className="text-[12px] text-white font-bold truncate">{s.label}</span>
                    </div>
                    <span className="text-[11px] text-white/70 font-mono tabular-nums">
                      {fmtRate(s.rate)}{s.minFee > 0 ? ` · ≥${s.minFee}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0A0D14] border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">Safaricom M-Pesa Tariff</h3>
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">Pass-through</span>
            </div>
            <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
              What Safaricom charges the sender per M-Pesa transaction. PayChain does not retain any portion of this — shown for full customer-cost transparency.
            </p>
            <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
              {MPESA_TARIFF_DISPLAY.map((t) => (
                <div key={t.label} className="flex items-center justify-between px-3 py-2 rounded bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-white/60">{t.label}</span>
                  <span className="text-white font-bold tabular-nums">{t.fee === 0 ? 'FREE' : `KES ${t.fee}`}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Revenue;
