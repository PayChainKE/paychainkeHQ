import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// ── Constants ─────────────────────────────────────────────────────────
const RANGES = [
  { v: '24h', l: '24H' },
  { v: '7d',  l: '7D' },
  { v: '30d', l: '30D' },
  { v: 'all', l: 'ALL' },
];

const TYPE_META = {
  inbound:    { label: 'Inbound',     short: 'IN',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#10B981' },
  outbound:   { label: 'Outbound',    short: 'OUT', color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  bulk_pay:   { label: 'Bulk Pay',    short: 'BP',  color: 'bg-violet-50 text-violet-700 border-violet-200',     dot: '#8B5CF6' },
  settlement: { label: 'Settlement',  short: 'SET', color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: '#F59E0B' },
  fx_swap:    { label: 'FX Swap',     short: 'FX',  color: 'bg-pink-50 text-pink-700 border-pink-200',           dot: '#EC4899' },
  top_up:     { label: 'Top Up',      short: 'TOP', color: 'bg-teal-50 text-teal-700 border-teal-200',           dot: '#14B8A6' },
  withdrawal: { label: 'Withdrawal',  short: 'WDL', color: 'bg-orange-50 text-orange-700 border-orange-200',     dot: '#F97316' },
  other:      { label: 'Other',       short: '—',   color: 'bg-gray-50 text-gray-700 border-gray-200',           dot: '#6B7280' },
};

const STATUS_META = {
  completed: { label: 'Completed', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  verified:  { label: 'Verified',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending:   { label: 'Pending',   pill: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500 animate-pulse' },
  failed:    { label: 'Failed',    pill: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
};

const QUICK_FILTERS = [
  { id: 'all',       label: 'All',           range: null, type: null,         status: null },
  { id: 'inbound',   label: 'Inbound only',  range: null, type: 'inbound',    status: null },
  { id: 'outbound',  label: 'Outbound only', range: null, type: 'outbound',   status: null },
  { id: 'failed',    label: 'Failed',        range: null, type: null,         status: 'failed' },
  { id: 'pending',   label: 'Pending',       range: null, type: null,         status: 'pending' },
  { id: 'settle',    label: 'Settlements',   range: null, type: 'settlement', status: null },
  { id: 'today',     label: 'Today',         range: '24h', type: null,        status: null },
];

const fmtKES = (n) => {
  if (n == null || isNaN(n)) return 'KES 0';
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(n).toLocaleString()}`;
};
const fmtKESFull = (n) => {
  if (n == null || isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};
const fmtUSDC = (n) => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtNum = (n) => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtFullTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
};

const Ledger = () => {
  const [range, setRange] = useState('7d');
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTxn, setActiveTxn] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [copiedRef, setCopiedRef] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/ledger', {
        params: { range, page, limit: 20, type, status, q: search },
      });
      if (res.data?.success) {
        setData(res.data.data);
        setRefreshedAt(new Date());
      } else setError(res.data?.error || 'Could not load ledger.');
    } catch (e) {
      const code = e?.response?.status;
      setError(
        e?.response?.data?.error
        || (code === 404 ? 'Ledger endpoint not deployed yet. Push backend changes and retry.' : 'Could not load ledger.')
      );
    } finally {
      setLoading(false);
    }
  }, [range, page, type, status, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Global sync listener
  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchData]);

  // Debounce search
  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchInput]);

  // ESC closes the txn drawer
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setActiveTxn(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const EXPORT_LIMIT = 5000;

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get('/api/admin/ledger', {
        params: { range, page: 1, limit: EXPORT_LIMIT, type, status, q: search },
      });
      if (!res.data?.success) { alert(res.data?.error || 'Export failed.'); return; }
      const txns = res.data.data?.transactions || [];
      if (txns.length === 0) { alert('Nothing to export for the current filters.'); return; }
      buildAndDownloadCsv(txns);
      if (res.data.data?.pagination?.total > EXPORT_LIMIT) {
        alert(`This filter matches ${res.data.data.pagination.total} transactions — only the most recent ${EXPORT_LIMIT} were exported. Narrow the range for a complete export.`);
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  function buildAndDownloadCsv(transactions) {
    const rows = transactions.map((t) => ({
      Reference: t.reference,
      Timestamp: new Date(t.createdAt).toISOString(),
      Type: t.type,
      Status: t.status,
      Currency: t.currency,
      Amount: t.amount,
      'KES Amount': t.kesAmount || '',
      'USDC Amount': t.usdcAmount || '',
      Account: t.accountNumber,
      'Merchant Business': t.merchant?.businessName || '',
      'Merchant Account No.': t.merchant?.paybillAccount || '',
      'Sender Name': t.sender?.name || '',
      'Sender ID': t.sender?.id || '',
    }));
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `paychain-ledger-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function applyQuickFilter(qf) {
    if (qf.range !== null) setRange(qf.range);
    setType(qf.type || 'all');
    setStatus(qf.status || 'all');
    setSearchInput(''); setSearch('');
    setPage(1);
  }

  function resetFilters() {
    setType('all'); setStatus('all'); setSearchInput(''); setSearch(''); setPage(1);
  }

  async function copyReference(ref) {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(''), 1500);
    } catch { /* noop */ }
  }

  const filtersActive = type !== 'all' || status !== 'all' || !!search;

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Hero / Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-emerald-400/10 rounded-full blur-2xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Wallet Ledger · Live Chain Settlement</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                On-Chain Treasury
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Cryptographically auditable record of every M-Pesa collection, payout, FX swap, and on-chain USDC settlement across the PayChain network.
              </p>
              {refreshedAt && (
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-300/60 mt-3">
                  Last refresh · {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 bg-emerald-900/40 rounded-xl border border-emerald-800/40 backdrop-blur-sm">
                {RANGES.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => { setRange(r.v); setPage(1); }}
                    className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                      range === r.v ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-200/60 hover:text-white'
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                title="Refresh"
                className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
              <button onClick={exportCsv} disabled={exporting} className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg disabled:opacity-50">
                <span className={`material-symbols-outlined text-base ${exporting ? 'animate-spin' : ''}`}>{exporting ? 'progress_activity' : 'file_download'}</span>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>

        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={fetchData} />
        ) : data ? (
          <>
            {/* Multi-asset balance + KPI strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Treasury balance card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-white to-emerald-50/30 border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3">Settled Volume</p>
                <div className="grid grid-cols-2 gap-4">
                  <AssetTile
                    label="Kenyan Shilling"
                    symbol="KES"
                    amount={fmtKES(data.assets.kes)}
                    rawAmount={data.assets.kes}
                    color="emerald"
                    chain="PayChain Master Paybill"
                  />
                  <AssetTile
                    label="USD Coin"
                    symbol="USDC"
                    amount={fmtUSDC(data.assets.usdc)}
                    rawAmount={data.assets.usdc}
                    color="blue"
                    chain="PayChain Stellar Network"
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between text-2xs">
                  <span className="text-on-surface-variant/60 font-bold uppercase tracking-widest">Total Movement</span>
                  <span className="font-bold text-on-surface">{fmtKESFull(data.kpis.volume.value)}</span>
                </div>
              </div>

              {/* KPIs */}
              <div className="lg:col-span-7 grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard label="KES Volume" value={fmtKES(data.kpis?.volume?.value)} change={data.kpis?.volume?.change} icon="payments" tone="primary" />
                <KpiCard label="USDC Volume" value={fmtUSDC(data.kpis?.usdcVolume?.value)} change={data.kpis?.usdcVolume?.change} icon="currency_exchange" tone="blue" />
                <KpiCard label="Transactions" value={fmtNum(data.kpis.count.value)} change={data.kpis.count.change} icon="receipt_long" tone="emerald" />
                <KpiCard label="Settlement Ratio" value={`${data.kpis.settlementRatio}%`} icon="check_circle" tone="amber" subtitle={`${data.kpis.failed} failed`} noDelta />
                <KpiCard label="Lifetime KES" value={fmtKES(data.kpis?.lifetimeVolume)} icon="account_balance" tone="emerald" subtitle="All time total" noDelta />
                <KpiCard label="Lifetime USDC" value={`${fmtNum(data.kpis?.lifetimeUsdcVolume)} USDC`} icon="public" tone="blue" subtitle="All time total" noDelta />
              </div>
            </div>

            {/* Volume chart + Type mix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Throughput</p>
                    <h3 className="text-lg font-bold text-on-surface tracking-tight">Settlement Volume ({range.toUpperCase()})</h3>
                  </div>
                  <div className="flex items-center gap-3 text-2xs font-bold">
                    <Legend color="bg-primary" label="Volume" />
                    <Legend color="bg-emerald-500" label="Count" />
                  </div>
                </div>
                <AreaChart series={data.series} />
              </div>
              <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Composition</p>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-5">Transaction Mix</h3>
                <TypeMix mix={data.typeMix} />
              </div>
            </div>

            {/* Quick filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_FILTERS.map((qf) => {
                const active = (
                  (qf.id === 'all' && !filtersActive) ||
                  (qf.type && qf.type === type) ||
                  (qf.status && qf.status === status) ||
                  (qf.id === 'today' && range === '24h')
                );
                return (
                  <button
                    key={qf.id}
                    onClick={() => applyQuickFilter(qf)}
                    className={`px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-widest border transition-all ${
                      active
                        ? 'bg-primary text-white border-primary shadow'
                        : 'bg-white text-on-surface-variant/60 border-outline-variant/30 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {qf.label}
                  </button>
                );
              })}
              {filtersActive && (
                <button onClick={resetFilters} className="ml-auto px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-widest border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">close</span>
                  Clear filters
                </button>
              )}
            </div>

            {/* Audit trail table */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
              <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
                <div>
                  <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Cryptographic Audit Trail</p>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">
                    Transaction Ledger
                    <span className="ml-2 text-2xs font-bold text-on-surface-variant/50 tabular-nums">· {data.pagination.total.toLocaleString()} entries</span>
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Reference, account, sender..."
                      className="pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs w-full sm:w-72"
                    />
                    {searchInput && (
                      <button
                        onClick={() => setSearchInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    )}
                  </div>
                  <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white">
                    <option value="all">All types</option>
                    {Object.entries(TYPE_META).filter(([k]) => k !== 'other').map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                  </select>
                  <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white">
                    <option value="all">All status</option>
                    <option value="completed">Completed</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              {data.transactions.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant/40 mb-3">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                  </div>
                  <p className="text-sm text-on-surface-variant/60 font-medium">No transactions match this view.</p>
                  {filtersActive && (
                    <button onClick={resetFilters} className="mt-3 text-xs font-bold uppercase tracking-widest text-primary hover:underline">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop / tablet table */}
                  <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left font-body">
                      <thead>
                        <tr className="bg-surface-container-low/50">
                          <Th>Reference</Th>
                          <Th>When</Th>
                          <Th>Type</Th>
                          <Th>Merchant / Sender</Th>
                          <Th>Amount</Th>
                          <Th>Status</Th>
                          <Th></Th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {data.transactions.map((t) => {
                          const tm = TYPE_META[t.type] || TYPE_META.other;
                          const sm = STATUS_META[t.status] || STATUS_META.pending;
                          return (
                            <tr
                              key={t._id}
                              onClick={() => setActiveTxn(t)}
                              className="hover:bg-secondary-container/5 transition-colors group cursor-pointer"
                            >
                              <td className="px-3 py-2 border-b border-outline-variant/5">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-2xs font-bold text-on-surface bg-surface-container-low px-2 py-1 rounded">
                                    {t.reference?.length > 18 ? `${t.reference.slice(0, 14)}…` : t.reference || '—'}
                                  </span>
                                  {t.reference && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyReference(t.reference); }}
                                      title="Copy reference"
                                      className="opacity-0 group-hover:opacity-100 text-on-surface-variant/40 hover:text-primary transition-all"
                                    >
                                      <span className="material-symbols-outlined text-sm">
                                        {copiedRef === t.reference ? 'check' : 'content_copy'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/70 whitespace-nowrap">{fmtTime(t.createdAt)}</td>
                              <td className="px-3 py-2 border-b border-outline-variant/5">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${tm.color}`}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm.dot }}></span>
                                  {tm.label}
                                </span>
                              </td>
                              <td className="px-3 py-2 border-b border-outline-variant/5">
                                {t.merchant ? (
                                  <div>
                                    <p className="font-bold text-on-surface tracking-tight">{t.merchant.businessName}</p>
                                    <p className="text-2xs text-on-surface-variant/60 font-mono">#{t.merchant.paybillAccount}</p>
                                  </div>
                                ) : t.sender?.name ? (
                                  <div>
                                    <p className="font-medium text-on-surface-variant">{t.sender.name}</p>
                                    <p className="text-2xs text-on-surface-variant/60 font-mono">{t.sender.id || t.accountNumber}</p>
                                  </div>
                                ) : (
                                  <p className="text-on-surface-variant/40 font-mono text-xs">{t.accountNumber || '—'}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 border-b border-outline-variant/5">
                                <p className="font-bold text-on-surface tracking-tight tabular-nums">
                                  {t.currency === 'USDC' ? `${fmtUSDC(t.amount)} USDC` : fmtKES(t.amount)}
                                </p>
                                {t.usdcAmount > 0 && t.kesAmount > 0 && (
                                  <p className="text-2xs text-on-surface-variant/60 font-mono">≈ {fmtUSDC(t.usdcAmount)} USDC</p>
                                )}
                              </td>
                              <td className="px-3 py-2 border-b border-outline-variant/5">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                                  {sm.label}
                                </span>
                              </td>
                              <td className="px-2 py-3 border-b border-outline-variant/5 text-right">
                                <span className="material-symbols-outlined text-on-surface-variant/30 text-lg group-hover:text-primary transition-colors">chevron_right</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-outline-variant/10">
                    {data.transactions.map((t) => {
                      const tm = TYPE_META[t.type] || TYPE_META.other;
                      const sm = STATUS_META[t.status] || STATUS_META.pending;
                      return (
                        <button
                          key={t._id}
                          onClick={() => setActiveTxn(t)}
                          className="w-full text-left p-4 hover:bg-surface-container-low/40 active:bg-surface-container-low transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border mb-1 ${tm.color}`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm.dot }}></span>
                                {tm.label}
                              </span>
                              <p className="font-bold text-on-surface text-sm tracking-tight truncate">
                                {t.merchant?.businessName || t.sender?.name || t.accountNumber || '—'}
                              </p>
                              <p className="text-2xs font-mono text-on-surface-variant/60 truncate">{t.reference || '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-on-surface tabular-nums">
                                {t.currency === 'USDC' ? `${fmtUSDC(t.amount)} USDC` : fmtKES(t.amount)}
                              </p>
                              <span className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                                {sm.label}
                              </span>
                            </div>
                          </div>
                          <p className="text-2xs text-on-surface-variant/50">{fmtTime(t.createdAt)}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Pagination */}
              {data.pagination.total > 0 && (
                <div className="px-6 py-4 bg-surface flex items-center justify-between border-t border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant/60 font-body">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold tracking-tight">{page}</span>
                    <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Transaction detail drawer */}
        {activeTxn && <TxnDrawer txn={activeTxn} onClose={() => setActiveTxn(null)} onCopy={copyReference} copiedRef={copiedRef} />}
      </div>
    </Layout>
  );
};

// ── Transaction detail drawer ───────────────────────────────────────
const TxnDrawer = ({ txn, onClose, onCopy, copiedRef }) => {
  const tm = TYPE_META[txn.type] || TYPE_META.other;
  const sm = STATUS_META[txn.status] || STATUS_META.pending;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#06201B] to-[#0a3029] p-6 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border mb-3 ${tm.color}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm.dot }}></span>
            {tm.label}
          </span>
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">Transaction</p>
          <h3 className="text-2xl font-bold text-white tracking-tight mb-1 tabular-nums">
            {txn.currency === 'USDC' ? `${fmtUSDC(txn.amount)} USDC` : fmtKESFull(txn.amount)}
          </h3>
          <p className="text-xs text-emerald-100/70">{fmtFullTime(txn.createdAt)}</p>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
              {sm.label}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Reference */}
          <Section title="Reference">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-low px-2 py-1.5 rounded flex-1 break-all">
                {txn.reference || '—'}
              </span>
              {txn.reference && (
                <button onClick={() => onCopy(txn.reference)} className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-2xs font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">
                    {copiedRef === txn.reference ? 'check' : 'content_copy'}
                  </span>
                  {copiedRef === txn.reference ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </Section>

          {/* Counterparty */}
          {(txn.merchant || txn.sender) && (
            <Section title="Counterparty">
              {txn.merchant && (
                <div className="bg-emerald-50/40 border border-emerald-200/40 rounded-lg p-3 mb-2">
                  <p className="text-2xs font-bold uppercase tracking-widest text-emerald-700 mb-1">Merchant</p>
                  <p className="font-bold text-on-surface text-sm">{txn.merchant.businessName}</p>
                  {txn.merchant.paybillAccount && (
                    <p className="text-2xs text-on-surface-variant/70 font-mono">Acc #{txn.merchant.paybillAccount}</p>
                  )}
                </div>
              )}
              {txn.sender?.name && (
                <div className="bg-blue-50/40 border border-blue-200/40 rounded-lg p-3">
                  <p className="text-2xs font-bold uppercase tracking-widest text-blue-700 mb-1">Sender</p>
                  <p className="font-bold text-on-surface text-sm">{txn.sender.name}</p>
                  {txn.sender.id && <p className="text-2xs text-on-surface-variant/70 font-mono">{txn.sender.id}</p>}
                </div>
              )}
            </Section>
          )}

          {/* Amounts breakdown */}
          <Section title="Amount breakdown">
            <div className="grid grid-cols-2 gap-3">
              <DetailPill label="Currency" value={txn.currency || 'KES'} />
              <DetailPill label="Amount" value={fmtKESFull(txn.amount)} mono />
              {txn.kesAmount > 0 && <DetailPill label="KES Settled" value={fmtKESFull(txn.kesAmount)} mono />}
              {txn.usdcAmount > 0 && <DetailPill label="USDC Settled" value={`${fmtUSDC(txn.usdcAmount)} USDC`} mono />}
            </div>
          </Section>

          {/* Meta */}
          <Section title="Metadata">
            <DetailPill label="Account" value={txn.accountNumber || '—'} mono />
            {txn.merchant?.status && <DetailPill label="Merchant status" value={txn.merchant.status} />}
            {txn.merchant?.flagged !== undefined && (
              <DetailPill label="Merchant flagged" value={txn.merchant.flagged ? 'Yes' : 'No'} />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">{title}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const DetailPill = ({ label, value, mono }) => (
  <div className="bg-surface-container-low/60 px-3 py-2 rounded-lg">
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{label}</p>
    <p className={`text-xs font-bold text-on-surface tracking-tight break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

// ── Asset tile ───────────────────────────────────────────────────────
const AssetTile = ({ label, symbol, amount, rawAmount, color, chain }) => {
  const colorMap = {
    emerald: { bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-600', ring: 'ring-emerald-500/30' },
    blue:    { bg: 'from-blue-500/10 to-blue-500/5',       text: 'text-blue-600',    ring: 'ring-blue-500/30' },
  };
  const c = colorMap[color] || colorMap.emerald;
  return (
    <div className={`bg-gradient-to-br ${c.bg} border border-outline-variant/20 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-7 h-7 rounded-full ring-2 ${c.ring} bg-white flex items-center justify-center font-bold text-2xs ${c.text}`}>
          {symbol}
        </div>
        <span className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{chain}</span>
      </div>
      <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">{label}</p>
      <p className={`text-xl font-bold tracking-tighter ${rawAmount > 0 ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>{amount}</p>
    </div>
  );
};

// ── KPI ──────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, change, icon, tone, subtitle, noDelta }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
  };
  const positive = (change ?? 0) >= 0;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || toneMap.primary}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <p className="text-xl font-bold text-on-surface tracking-tighter">{value}</p>
      <div className="flex items-center justify-between mt-2 text-2xs">
        {!noDelta ? (
          <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <span className="material-symbols-outlined text-2xs">{positive ? 'arrow_upward' : 'arrow_downward'}</span>
            {positive ? '+' : ''}{change}%
          </span>
        ) : <span></span>}
        {subtitle && <p className="text-on-surface-variant/50">{subtitle}</p>}
      </div>
    </div>
  );
};

// ── Type Mix (donut) ─────────────────────────────────────────────────
const TypeMix = ({ mix }) => {
  const total = mix.reduce((s, r) => s + r.volume, 0);
  if (total === 0) return <p className="py-8 text-center text-on-surface-variant/40 text-sm">No transactions yet.</p>;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
          {mix.map((r, i) => {
            const tm = TYPE_META[r.type] || TYPE_META.other;
            const pct = (r.volume / total) * 100;
            const circ = 2 * Math.PI * 15.5;
            const dash = (pct / 100) * circ;
            const seg = (
              <circle
                key={i} cx="18" cy="18" r="15.5" fill="none"
                stroke={tm.dot} strokeWidth="3"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Total</p>
          <p className="text-sm font-bold text-on-surface tracking-tight">{fmtKES(total)}</p>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {mix.map((r, i) => {
          const tm = TYPE_META[r.type] || TYPE_META.other;
          return (
            <div key={i} className="flex items-center gap-2 text-2xs">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: tm.dot }}></span>
              <span className="font-bold text-on-surface-variant/70 flex-1 truncate">{tm.label}</span>
              <span className="font-bold text-on-surface tabular-nums">{fmtKES(r.volume)}</span>
              <span className="text-on-surface-variant/50 tabular-nums w-10 text-right">{((r.volume / total) * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Area chart (volume series) ───────────────────────────────────────
const AreaChart = ({ series }) => {
  if (!series || series.length === 0) return <div className="h-[200px] flex items-center justify-center text-on-surface-variant/40 text-sm">No volume in this range.</div>;
  const w = 800, h = 200;
  const padL = 40, padR = 16, padT = 10, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const volumes = series.map((d) => d.volume);
  const max = Math.max(...volumes, 1);
  const step = innerW / Math.max(series.length - 1, 1);
  const pts = series.map((d, i) => [padL + i * step, padT + (1 - d.volume / max) * innerH]);
  const path = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const area = `${path} L ${padL + (series.length - 1) * step} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
  const yLabels = [0, 0.5, 1].reverse();
  const xTicks = series.length <= 6 ? series.map((d, i) => ({ x: padL + i * step, label: d.bucket.slice(5) })) : [
    { x: padL, label: series[0].bucket.slice(5) },
    { x: padL + innerW / 2, label: series[Math.floor(series.length / 2)].bucket.slice(5) },
    { x: padL + innerW, label: series[series.length - 1].bucket.slice(5) },
  ];
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[500px]" style={{ height: 200 }}>
        <defs>
          <linearGradient id="ledgerArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06201B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06201B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLabels.map((p, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={padT + p * innerH} y2={padT + p * innerH} stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" />
            <text x={padL - 6} y={padT + p * innerH + 3} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="end" fontWeight="700">{fmtKES(max * (1 - p))}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={h - 8} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="middle" fontWeight="700">{t.label}</text>
        ))}
        <path d={area} fill="url(#ledgerArea)" />
        <path d={path} fill="none" stroke="#06201B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#06201B" stroke="#fff" strokeWidth="2" />)}
      </svg>
    </div>
  );
};

const Th = ({ children }) => (
  <th className="px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
);

const Legend = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
    <span className="text-on-surface-variant/60">{label}</span>
  </span>
);

const LoadingState = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-5 h-44 bg-surface-container-low rounded-2xl animate-pulse"></div>
      <div className="lg:col-span-7 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>)}
      </div>
    </div>
    <div className="h-64 bg-surface-container-low rounded-2xl animate-pulse"></div>
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
      <span className="material-symbols-outlined text-3xl">error</span>
    </div>
    <h3 className="text-lg font-bold text-red-900 mb-1">Ledger unavailable</h3>
    <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{error}</p>
    <button onClick={onRetry} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest rounded-lg">
      Retry
    </button>
  </div>
);

export default Ledger;
