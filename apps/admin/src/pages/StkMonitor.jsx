import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';
import { formatKES } from '../utils/formatCurrency';

// Same convention as TransactionAudit.jsx's identical helper — a plain
// date+time reads as a real audit record; "5m ago" reads as a live feed and
// stops being useful the moment the page is more than an hour old.
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const KIND_LABELS = { topup: 'Wallet Top-up', request_money: 'Request Money', pay_account: 'Pay Account', qr: 'QR Scan' };

const PAGE_SIZE = 25;

// Live view of every STK Push / Dynamic QR collection attempt — resolves
// from 'pending' to 'success'/'failed' the moment NCBA's poll or the
// account-notification webhook catches the outcome (see
// pollAndResolveNcbaStkPush in backend/controllers/mpesaController.js).
// 3s poll here matches the merchant dashboard's own refresh cadence, so
// admin sees the same outcome at roughly the same time a merchant would.
const StkMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  // Pushes that never went out (no STK record exists for them), shown when the "Not sent" tile is chosen.
  const [sendFailures, setSendFailures] = useState([]);

  const fetchRequests = useCallback(async () => {
    try {
      const [res, failRes] = await Promise.all([
        api.get('/api/admin/stk-requests'),
        api.get('/api/admin/stk-send-failures').catch(() => null),
      ]);
      if (failRes?.data?.success) setSendFailures(failRes.data.data || []);
      if (res.data?.success) {
        setRows(res.data.data || []);
        setError('');
      } else {
        setError(res.data?.error || 'Could not load STK requests.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load STK requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => {
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, [fetchRequests]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchRequests(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchRequests]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const summary = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'pending').length,
    success: rows.filter((r) => r.status === 'success').length,
    failed: rows.filter((r) => r.status === 'failed').length,
  }), [rows]);

  const showingNotSent = statusFilter === 'notsent';

  const filteredFailures = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sendFailures;
    return sendFailures.filter((r) =>
      [r.merchantId?.businessName, r.phone, r.detail, r.stage].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [sendFailures, search]);

  const filteredRows = useMemo(() => {
    if (showingNotSent) return filteredFailures;
    let list = rows;
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.merchantId?.businessName, r.phone, r.checkoutRequestId].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, search, statusFilter, showingNotSent, filteredFailures]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-[#061121] border border-[#1A2639] shadow-[0_30px_80px_-20px_rgba(6,17,33,0.8)] p-6 md:p-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-400">Live — refreshes every 3s</p>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-tight">
                STK Push Monitor
              </h2>
              <p className="text-xs md:text-sm text-emerald-100/60 mt-2 max-w-2xl font-body">
                Every customer STK Push / Dynamic QR collection attempt, resolving from pending to success or failed the moment the customer enters their PIN.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')} className={`text-left p-5 rounded-2xl border shadow-sm transition-all ${statusFilter === 'pending' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300' : 'bg-surface-container-lowest border-outline-variant/20 hover:-translate-y-1'}`}>
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-amber-600/70 block mb-2">Awaiting PIN</span>
            <span className="text-3xl md:text-4xl font-black text-amber-600 tracking-tighter tabular-nums">{summary.pending}</span>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'success' ? 'all' : 'success')} className={`text-left p-5 rounded-2xl border shadow-sm transition-all ${statusFilter === 'success' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300' : 'bg-surface-container-lowest border-outline-variant/20 hover:-translate-y-1'}`}>
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-emerald-600/70 block mb-2">Successful</span>
            <span className="text-3xl md:text-4xl font-black text-emerald-600 tracking-tighter tabular-nums">{summary.success}</span>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')} className={`text-left p-5 rounded-2xl border shadow-sm transition-all ${statusFilter === 'failed' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-300' : 'bg-surface-container-lowest border-outline-variant/20 hover:-translate-y-1'}`}>
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-rose-600/70 block mb-2">Failed</span>
            <span className="text-3xl md:text-4xl font-black text-rose-600 tracking-tighter tabular-nums">{summary.failed}</span>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'notsent' ? 'all' : 'notsent')} className={`text-left p-5 rounded-2xl border shadow-sm transition-all ${statusFilter === 'notsent' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300' : 'bg-surface-container-lowest border-outline-variant/20 hover:-translate-y-1'}`} title="Pushes that could not be sent to NCBA at all (last 60 days)">
            <span className="text-2xs font-bold uppercase tracking-[0.15em] text-slate-600/70 block mb-2">Not sent</span>
            <span className="text-3xl md:text-4xl font-black text-slate-700 tracking-tighter tabular-nums">{sendFailures.length}</span>
          </button>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-500 text-sm font-bold backdrop-blur-sm">
            {error}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-editorial overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 bg-white/50 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-on-surface tracking-tight">{showingNotSent ? 'Pushes that were not sent' : 'Recent Attempts'}</h3>
                <p className="text-xs text-on-surface-variant/60 font-medium">
                  {showingNotSent
                    ? 'Requests NCBA refused or could not be reached for, so no prompt reached the customer (unless marked unclear). Kept 60 days.'
                    : 'Last 500 STK Push / QR requests, newest first'}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant/40">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant, phone, reference…"
                  className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-0"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-body min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container-low/30 border-b border-outline-variant/10">
                    <Th className="pl-6">Merchant</Th>
                    <Th>Phone</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Type</Th>
                    <Th>{showingNotSent ? 'Failed at' : 'Status'}</Th>
                    <Th>{showingNotSent ? 'What went wrong' : 'Result'}</Th>
                    <Th className="pr-6">When</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {loading ? (
                    <tr><td colSpan="7" className="px-6 py-16 text-center">
                      <div className="inline-flex flex-col items-center gap-4">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Loading…</span>
                      </div>
                    </td></tr>
                  ) : filteredRows.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-on-surface-variant/40 text-sm font-medium">
                      {showingNotSent ? 'No failed sends in the last 60 days.' : rows.length === 0 ? 'No STK Push requests yet.' : 'No requests match this filter.'}
                    </td></tr>
                  ) : pagedRows.map((row) => (showingNotSent ? <SendFailureRow key={row._id} row={row} /> : <StkRow key={row._id} row={row} />))}
                </tbody>
              </table>
            </div>
            {!loading && filteredRows.length > 0 && (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={filteredRows.length} onPage={setPage} />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

const STATUS_STYLES = {
  pending: { label: 'Awaiting PIN', styles: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  success: { label: 'Successful',   styles: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  failed:  { label: 'Failed',       styles: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

const StkRow = ({ row }) => {
  const { label, styles, dot } = STATUS_STYLES[row.status] || STATUS_STYLES.pending;
  return (
    <tr className="hover:bg-surface-container-lowest transition-colors bg-white">
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-on-surface tracking-tight">{row.merchantId?.businessName || 'Unknown merchant'}</p>
        {row.merchantId?.email && <p className="text-2xs text-on-surface-variant/50">{row.merchantId.email}</p>}
      </td>
      <td className="px-3 py-4 text-xs font-mono text-slate-500">{row.phone || '—'}</td>
      <td className="px-3 py-4 text-right text-sm font-bold text-on-surface tabular-nums">{formatKES(row.amount)}</td>
      <td className="px-3 py-4 text-xs font-medium text-slate-500">{KIND_LABELS[row.kind] || row.kind}{row.channel === 'qr' ? ' (QR)' : ''}</td>
      <td className="px-3 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${styles}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>
          {label}
        </span>
      </td>
      <td className="px-3 py-4 text-xs text-slate-500 max-w-[260px]" title={row.ncbaReason ? `${row.resultDesc} — NCBA said: ${row.ncbaReason}` : row.resultDesc}>
        <div className="truncate">{row.resultDesc || '—'}</div>
        {row.ncbaReason && row.status === 'failed' && <div className="truncate text-2xs text-rose-600/80 mt-0.5">NCBA said: {row.ncbaReason}</div>}
      </td>
      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">{fmtTime(row.createdAt)}</td>
    </tr>
  );
};

const STAGE_LABELS = {
  setup: 'Account not ready',
  auth: 'NCBA login',
  request: 'NCBA request',
  rejected: 'NCBA refused',
  other: 'Unexpected',
};

const SendFailureRow = ({ row }) => (
  <tr className="hover:bg-surface-container-lowest transition-colors bg-white">
    <td className="px-6 py-4">
      <p className="text-sm font-bold text-on-surface tracking-tight">{row.merchantId?.businessName || 'Unknown merchant'}</p>
      {row.merchantId?.email && <p className="text-2xs text-on-surface-variant/50">{row.merchantId.email}</p>}
    </td>
    <td className="px-3 py-4 text-xs font-mono text-slate-500">{row.phone || '—'}</td>
    <td className="px-3 py-4 text-right text-sm font-bold text-on-surface tabular-nums">{row.amount != null ? formatKES(row.amount) : '—'}</td>
    <td className="px-3 py-4 text-xs font-medium text-slate-500">{KIND_LABELS[row.kind] || row.kind || '—'}</td>
    <td className="px-3 py-4">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border bg-slate-50 text-slate-700 border-slate-200">
        {STAGE_LABELS[row.stage] || row.stage}
      </span>
      {!row.notSent && <p className="text-2xs text-amber-600 mt-1">Unclear: the prompt may have been sent</p>}
    </td>
    <td className="px-3 py-4 text-xs text-slate-500 max-w-[340px]">
      <div className="break-words line-clamp-3" title={row.detail}>{row.httpStatus ? `HTTP ${row.httpStatus}: ` : ''}{row.detail || '—'}</div>
    </td>
    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">{fmtTime(row.createdAt)}</td>
  </tr>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-4 text-2xs font-black uppercase tracking-[0.15em] text-slate-400 ${className}`}>{children}</th>
);

export default StkMonitor;
