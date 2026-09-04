import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';
import { formatKES } from '../utils/formatCurrency';

const PAGE_SIZE = 25;

const STATUS_META = {
  success: { label: 'Success', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500 animate-pulse' },
  failed:  { label: 'Failed',  pill: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
};


// Fixed order and accent per channel — never re-sorted by volume/revenue, so
// a channel's color and position stay stable across every filter/range.
const CHANNEL_META = {
  collect:     { label: 'Collect',      bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  payout:      { label: 'Payout',       bar: 'bg-indigo-500',  chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  bulk_payout: { label: 'Bulk Payout',  bar: 'bg-violet-500',  chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  invoice:     { label: 'Invoice',      bar: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
};
const CHANNEL_ORDER = ['collect', 'payout', 'bulk_payout', 'invoice'];

const RANGE_OPTIONS = [
  { id: '24h', label: '24h' },
  { id: '7d',  label: '7d'  },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
];

const fmtKES = formatKES;
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Every transaction that ran through PayChain's Developer/API integration
 * channel — Direct Collect, Payouts (standalone and bulk-batch rows), and
 * Developer-created Invoices — plus the revenue PayChain actually earned
 * from that channel. Distinct from Transaction Audit (platform-wide,
 * regardless of origin) and from the main Revenue page (which reports
 * PayChain's revenue overall, not broken out by dashboard-vs-API origin).
 *
 * Reuses GET /api/admin/api-transactions (list) and
 * .../api-transactions/summary (KPIs + channel breakdown) —
 * backend/controllers/apiTransactionsController.js.
 */
const ApiTransactions = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [range, setRange] = useState('30d');

  // The whole page is scoped to one mode at a time — Live (real money,
  // real revenue) and Test (simulated, always zero revenue by design) are
  // different enough questions that mixing them in one table/summary was
  // confusing more than it helped.
  const [activeTab, setActiveTab] = useState('live');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [activeTab]);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE, mode: activeTab };
    if (search.trim()) p.q = search.trim();
    if (channel !== 'all') p.channel = channel;
    if (status !== 'all') p.status = status;
    return p;
  }, [page, search, channel, status, activeTab]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/api-transactions', { params });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setTotal(res.data.total || 0);
        setTotalVolume(res.data.totalVolume || 0);
      } else {
        setError(res.data?.error || 'Could not load API transactions.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load API transactions.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/api/admin/api-transactions/summary', { params: { range, mode: activeTab } });
      if (res.data?.success) setSummary(res.data.data);
    } finally {
      setSummaryLoading(false);
    }
  }, [range, activeTab]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const filtersActive = !!search || channel !== 'all' || status !== 'all';
  function resetFilters() {
    setSearchInput(''); setSearch(''); setChannel('all'); setStatus('all');
  }

  const channels = summary?.channels || [];
  const maxChannelVolume = Math.max(1, ...channels.map((c) => c.volume));

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B0F1A] border border-[#1E2536] shadow-[0_30px_80px_-20px_rgba(6,10,20,0.8)] p-6 md:p-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px]"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-indigo-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>api</span>
              <p className="text-2xs font-bold uppercase tracking-[0.3em] text-indigo-300">API Transactions</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-tight">
              Every payment the Developer API moved
            </h2>
            <p className="text-xs md:text-sm text-indigo-100/60 mt-2 max-w-2xl font-body">
              Collect, Payouts, Bulk Payouts, and Invoices created through PayChain's Developer API — and the revenue PayChain actually earned from that channel, separate from dashboard-originated activity.
            </p>
          </div>
        </div>

        {/* Live / Test — the primary split. Different questions (real
            revenue vs. integration activity), so kept as separate views
            rather than one table with a mode filter buried in it. */}
        <div className="inline-flex bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'live' ? 'bg-indigo-600 text-white shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'live' ? 'bg-white' : 'bg-indigo-500'}`}></span>
            Live Transactions
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'test' ? 'bg-on-surface text-surface-container-lowest shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'test' ? 'bg-surface-container-lowest' : 'bg-on-surface-variant/40'}`}></span>
            Test Transactions
          </button>
        </div>

        {/* KPI + channel breakdown */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 md:p-6 shadow-editorial">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
              {activeTab === 'live' ? 'API channel revenue' : 'API channel test activity'}
            </p>
            <div className="inline-flex bg-surface-container-low rounded-lg p-1 gap-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-2.5 py-1 rounded-md text-2xs font-bold transition-colors ${range === r.id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'test' && (
            <div className="flex items-start gap-2.5 bg-surface-container-low/60 border border-outline-variant/10 rounded-lg px-3.5 py-3 mb-6">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-lg shrink-0">info</span>
              <p className="text-2xs text-on-surface-variant/60 leading-relaxed">
                Test-mode keys simulate the full pending → success flow with zero rail calls — no real money moves and no revenue is generated, by design. This view is for confirming a developer's integration actually works before they go live, not for financial reporting.
              </p>
            </div>
          )}

          {activeTab === 'live' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Kpi label="API Revenue" value={summaryLoading ? '—' : fmtKES(summary?.kpis?.totalRevenue)} accent="text-emerald-700" />
              <Kpi label="API Volume" value={summaryLoading ? '—' : fmtKES(summary?.kpis?.totalVolume)} />
              <Kpi label="Live Transactions" value={summaryLoading ? '—' : (summary?.kpis?.totalTransactions ?? 0).toLocaleString()} />
              <Kpi label="Take Rate" value={summaryLoading ? '—' : `${summary?.kpis?.takeRate ?? 0}%`} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Kpi label="Test Transactions" value={summaryLoading ? '—' : (summary?.kpis?.totalTransactions ?? 0).toLocaleString()} />
              {CHANNEL_ORDER.map((id) => (
                <Kpi key={id} label={CHANNEL_META[id].label} value={summaryLoading ? '—' : (channels.find((c) => c.id === id)?.count ?? 0).toLocaleString()} />
              ))}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-2.5">
              {CHANNEL_ORDER.map((id) => {
                const c = channels.find((x) => x.id === id) || { volume: 0, revenue: 0, count: 0 };
                const meta = CHANNEL_META[id];
                const pct = summaryLoading ? 0 : Math.max(2, (c.volume / maxChannelVolume) * 100);
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className={`shrink-0 w-24 text-2xs font-bold px-2 py-1 rounded-full text-center border ${meta.chip}`}>{meta.label}</span>
                    <div className="flex-1 h-2 bg-surface-container-low rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 w-28 text-right text-2xs font-bold text-on-surface tabular-nums">{fmtKES(c.revenue)}</span>
                    <span className="shrink-0 w-16 text-right text-2xs text-on-surface-variant/50 tabular-nums">{c.count}×</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-3 md:p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-lg">search</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Reference, developer, merchant name…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0">
            <option value="all">All channels</option>
            <option value="collect">Collect</option>
            <option value="payout">Payout</option>
            <option value="bulk_payout">Bulk Payout</option>
            <option value="invoice">Invoice</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0">
            <option value="all">All status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          {filtersActive && (
            <button onClick={resetFilters} className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-error px-2">
              Clear
            </button>
          )}
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Reference</Th>
                  <Th>When</Th>
                  <Th>Channel</Th>
                  <Th>Developer</Th>
                  <Th>Merchant</Th>
                  <Th>Counterparty</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">PayChain Fee</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan="9" className="px-3 py-3"><div className="h-5 bg-on-surface/5 rounded animate-pulse" /></td></tr>
                  ))
                ) : error ? (
                  <tr><td colSpan="9" className="py-10 text-center text-error text-sm">{error}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="9" className="py-10 text-center text-on-surface-variant/40 text-sm">No API transactions match this search.</td></tr>
                ) : rows.map((t) => {
                  const sm = STATUS_META[t.status] || STATUS_META.pending;
                  const cm = CHANNEL_META[t.channel] || CHANNEL_META.payout;
                  return (
                    <tr key={t.id} className="hover:bg-secondary-container/5 transition-colors">
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className="font-mono text-2xs font-bold text-on-surface bg-surface-container-low px-2 py-1 rounded">
                          {t.reference?.length > 20 ? `${t.reference.slice(0, 16)}…` : t.reference || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/70 whitespace-nowrap">{fmtTime(t.createdAt)}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold border ${cm.chip}`}>{t.channelLabel}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        {t.developer ? (
                          <p className="font-bold text-on-surface tracking-tight truncate max-w-[150px]">{t.developer.companyName || t.developer.name}</p>
                        ) : <span className="text-on-surface-variant/40 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        {t.merchant ? (
                          <p className="text-on-surface-variant/80 truncate max-w-[150px]">{t.merchant.businessName}</p>
                        ) : <span className="text-on-surface-variant/40 italic">Deleted Merchant</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <p className="text-on-surface-variant/70 font-mono truncate max-w-[150px]">{t.counterparty}</p>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-right font-bold text-on-surface tabular-nums">{fmtKES(t.amount)}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-right font-bold text-emerald-700 tabular-nums">
                        {t.paychainFee > 0 ? fmtKES(t.paychainFee) : <span className="text-on-surface-variant/30 font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {!loading && !error && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-surface-container-low/40">
                    <td colSpan="6" className="px-3 py-2.5 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 text-right">
                      Page total · {total.toLocaleString()} transactions{activeTab === 'live' ? ` · volume ${fmtKES(totalVolume)}` : ''}
                    </td>
                    <td className="px-3 py-2.5"></td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      </div>
    </Layout>
  );
};

const Kpi = ({ label, value, accent }) => (
  <div className="bg-surface-container-low/60 rounded-xl p-3.5">
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">{label}</p>
    <p className={`text-lg font-bold tabular-nums tracking-tight ${accent || 'text-on-surface'}`}>{value}</p>
  </div>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

export default ApiTransactions;
