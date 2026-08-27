import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { formatKES } from '../utils/formatCurrency';
import UploadableDocRow from '../components/modals/UploadableDocRow';

// ── Constants ─────────────────────────────────────────────────────────────
// Mirrors backend/models/Expense.js EXPENSE_CATEGORIES / PAYMENT_METHODS —
// used as the form's default option list before the first API response
// arrives (then overridden by whatever the server actually returns).
const FALLBACK_CATEGORIES = [
  'Salaries & Wages', 'Rent & Utilities', 'Software & Subscriptions', 'Professional & Legal Fees',
  'Marketing & Advertising', 'Travel & Transport', 'Office Supplies & Equipment', 'Bank & Transaction Charges',
  'Licenses & Permits', 'Insurance', 'Repairs & Maintenance', 'Telephone & Internet',
  'Training & Development', 'Depreciation', 'Other',
];
const FALLBACK_METHODS = ['M-Pesa', 'Bank Transfer', 'Cash', 'Card', 'Cheque', 'Other'];

const CATEGORY_META = {
  'Salaries & Wages':            { color: 'bg-violet-50 text-violet-700 border-violet-200',   dot: '#8B5CF6' },
  'Rent & Utilities':            { color: 'bg-amber-50 text-amber-700 border-amber-200',       dot: '#F59E0B' },
  'Software & Subscriptions':    { color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  'Professional & Legal Fees':   { color: 'bg-indigo-50 text-indigo-700 border-indigo-200',     dot: '#6366F1' },
  'Marketing & Advertising':     { color: 'bg-pink-50 text-pink-700 border-pink-200',           dot: '#EC4899' },
  'Travel & Transport':          { color: 'bg-teal-50 text-teal-700 border-teal-200',           dot: '#14B8A6' },
  'Office Supplies & Equipment': { color: 'bg-cyan-50 text-cyan-700 border-cyan-200',           dot: '#06B6D4' },
  'Bank & Transaction Charges':  { color: 'bg-orange-50 text-orange-700 border-orange-200',     dot: '#F97316' },
  'Licenses & Permits':          { color: 'bg-lime-50 text-lime-700 border-lime-200',           dot: '#84CC16' },
  'Insurance':                   { color: 'bg-sky-50 text-sky-700 border-sky-200',               dot: '#0EA5E9' },
  'Repairs & Maintenance':       { color: 'bg-rose-50 text-rose-700 border-rose-200',           dot: '#F43F5E' },
  'Telephone & Internet':        { color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: '#10B981' },
  'Training & Development':      { color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',  dot: '#D946EF' },
  'Depreciation':                { color: 'bg-stone-50 text-stone-700 border-stone-200',         dot: '#78716C' },
  'Other':                       { color: 'bg-gray-50 text-gray-700 border-gray-200',           dot: '#6B7280' },
};
const catMeta = (c) => CATEGORY_META[c] || CATEGORY_META['Other'];

const PERIODS = [
  { v: 'this_month',   l: 'This Month' },
  { v: 'last_month',   l: 'Last Month' },
  { v: 'this_quarter', l: 'This Quarter' },
  { v: 'ytd',          l: 'YTD' },
  { v: 'all',          l: 'All Time' },
];

const fmtKES = formatKES;
const fmtKESFull = formatKES;
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-KE', { month: 'short' });
};

const inputClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-white';
const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-2xs text-on-surface-variant/50 mt-1">{hint}</p>}
  </div>
);

const Bookkeeping = () => {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('this_month');

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(null); // null | 'create' | expense object
  const [deleteState, setDeleteState] = useState(null); // { expense, busy, error }

  const categories = data?.categories?.length ? data.categories : FALLBACK_CATEGORIES;
  const paymentMethods = data?.paymentMethods?.length ? data.paymentMethods : FALLBACK_METHODS;

  // silent=true is used by the 30s poll and the live paychain:sync push
  // (see effects below) — refreshes the numbers/chart without flashing the
  // loading skeleton over whatever the admin is currently looking at.
  const fetchSummary = useCallback(async (silent = false) => {
    if (silent) setSummaryRefreshing(true);
    else setSummaryLoading(true);
    if (!silent) setSummaryError('');
    try {
      const res = await api.get('/api/admin/bookkeeping/summary', { params: { preset: period } });
      if (res.data?.success) { setSummary(res.data.data); if (silent) setSummaryError(''); }
      else if (!silent) setSummaryError(res.data?.error || 'Could not load the P&L summary.');
    } catch (e) {
      if (!silent) setSummaryError(e?.response?.data?.error || 'Could not load the P&L summary.');
    } finally {
      if (silent) setSummaryRefreshing(false);
      else setSummaryLoading(false);
    }
  }, [period]);

  // Live — background refresh every 30s, plus instantly whenever any
  // transaction completes anywhere in PayChain (pushed via SSE -> the
  // existing paychain:sync bus, see context/AuthContext.jsx). Keeps this
  // page's numbers matching Revenue's without the admin ever hitting
  // manual "Sync".
  useEffect(() => {
    const id = setInterval(() => fetchSummary(true), 30_000);
    const onSync = () => fetchSummary(true);
    window.addEventListener('paychain:sync', onSync);
    return () => { clearInterval(id); window.removeEventListener('paychain:sync', onSync); };
  }, [fetchSummary]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/bookkeeping/expenses', {
        params: { preset: period, page, limit: 25, category, search },
      });
      if (res.data?.success) setData(res.data.data);
      else setError(res.data?.error || 'Could not load expenses.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, [period, page, category, search]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => { setPage(1); }, [period, category, search]);

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(searchInput), 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchInput]);

  function refreshAll() { fetchSummary(); fetchExpenses(); }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get('/api/admin/bookkeeping/expenses', {
        params: { preset: period, page: 1, limit: 5000, category, search },
      });
      if (!res.data?.success) { showToast(res.data?.error || 'Export failed.', 'error'); return; }
      const rows = res.data.data?.expenses || [];
      if (rows.length === 0) { showToast('Nothing to export for the current filters.', 'info'); return; }
      buildAndDownloadCsv(rows);
    } catch (e) {
      showToast(e?.response?.data?.error || 'Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  }

  function buildAndDownloadCsv(expenses) {
    const rows = expenses.map((x) => ({
      Date: new Date(x.date).toISOString().slice(0, 10),
      Category: x.category,
      Description: x.description,
      Payee: x.payee || '',
      'Amount (KES)': x.amount,
      'Payment Method': x.paymentMethod,
      Reference: x.reference || '',
      'VAT Applicable': x.vatApplicable ? 'Yes' : 'No',
      'VAT Amount (KES)': x.vatAmount || 0,
      'Tax Deductible': x.deductible ? 'Yes' : 'No',
      Notes: x.notes || '',
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
    a.download = `paychain-expenses-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function handleSave(payload, existing) {
    if (existing) {
      const res = await api.put(`/api/admin/bookkeeping/expenses/${existing._id}`, payload);
      return res.data;
    }
    // A receipt attached at creation time means the request must be
    // multipart/form-data (the file can't ride inside a JSON body) — the
    // backend route already accepts both shapes (uploadReceipt.single
    // no-ops on a non-multipart request), so JSON stays the path for the
    // common case of no receipt yet.
    const { receiptFile, ...fields } = payload;
    if (receiptFile) {
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      form.append('receipt', receiptFile);
      const res = await api.post('/api/admin/bookkeeping/expenses', form);
      return res.data;
    }
    const res = await api.post('/api/admin/bookkeeping/expenses', fields);
    return res.data;
  }

  async function confirmDelete() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.delete(`/api/admin/bookkeeping/expenses/${deleteState.expense._id}`);
      if (res.data?.success) {
        showToast('Expense deleted.');
        setDeleteState(null);
        refreshAll();
      } else {
        setDeleteState((s) => ({ ...s, busy: false, error: res.data?.error || 'Could not delete expense.' }));
      }
    } catch (e) {
      setDeleteState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Could not delete expense.' }));
    }
  }

  const pnl = summary?.pnl;
  const filtersActive = category !== 'all' || !!search;

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-emerald-400/10 rounded-full blur-2xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Books · KRA-Ready Records</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                Bookkeeping
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Track business expenses against fee revenue, monitor profit &amp; loss, and export a categorized statement ready for iTax filing.
              </p>
              {summary?.period?.label && (
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-300/60 mt-3">
                  Period · {summary.period.label}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 bg-emerald-900/40 rounded-xl border border-emerald-800/40 backdrop-blur-sm">
                {PERIODS.map((p) => (
                  <button
                    key={p.v}
                    onClick={() => setPeriod(p.v)}
                    className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                      period === p.v ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-200/60 hover:text-white'
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
              <button
                onClick={refreshAll}
                disabled={loading || summaryLoading}
                title="Refresh"
                className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${(loading || summaryLoading) ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
              <button onClick={exportCsv} disabled={exporting} className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-50">
                <span className={`material-symbols-outlined text-base ${exporting ? 'animate-spin' : ''}`}>{exporting ? 'progress_activity' : 'file_download'}</span>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
              <button onClick={() => setFormOpen('create')} className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg">
                <span className="material-symbols-outlined text-base">add</span>
                New Expense
              </button>
            </div>
          </div>
        </div>

        {/* P&L KPI strip */}
        {summaryError ? (
          <ErrorState error={summaryError} onRetry={fetchSummary} />
        ) : summaryLoading && !summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>)}
          </div>
        ) : pnl ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <PnlCard label="Income (Fee Revenue)" value={fmtKES(pnl.income)} icon="trending_up" tone="emerald" subtitle="Matches Revenue's Gross figure" />
            <PnlCard label="Total Expenses" value={fmtKES(pnl.totalExpenses)} icon="receipt_long" tone="amber" subtitle={`${pnl.expenseCount} entries`} />
            <PnlCard label="Net Profit" value={fmtKES(pnl.netProfit)} icon="account_balance" tone={pnl.netProfit >= 0 ? 'emerald' : 'red'} />
            <PnlCard label="Taxable Profit" value={fmtKES(pnl.taxableProfit)} icon="calculate" tone="blue" subtitle="Income − deductible" />
            <PnlCard label="Input VAT" value={fmtKES(pnl.vatTotal)} icon="request_quote" tone="violet" subtitle="Claimable on expenses" />
          </div>
        ) : null}

        {/* Trend + category mix */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Trend</p>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-on-surface tracking-tight">Income vs Expenses (12mo)</h3>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-700" title="Refreshes automatically every 30s and instantly on new transactions">
                      <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${summaryRefreshing ? 'animate-ping' : 'animate-pulse'}`} />
                      Live
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-2xs font-bold">
                  <Legend color="bg-emerald-500" label="Income" />
                  <Legend color="bg-amber-500" label="Expenses" />
                </div>
              </div>
              <TrendChart monthly={summary.monthly} />
            </div>
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Composition</p>
              <h3 className="text-lg font-bold text-on-surface tracking-tight mb-5">Expense by Category</h3>
              <CategoryMix categories={summary.categories} />
            </div>
          </div>
        )}

        {/* Filter chips + table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Expense Ledger</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Recorded Expenses
                {data?.pagination && <span className="ml-2 text-2xs font-bold text-on-surface-variant/50 tabular-nums">· {data.pagination.total.toLocaleString()} entries</span>}
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Description, payee, reference..."
                  className="pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs w-full sm:w-72"
                />
                {searchInput && (
                  <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {filtersActive && (
                <button onClick={() => { setCategory('all'); setSearchInput(''); setSearch(''); }} className="px-3 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">close</span>
                  Clear
                </button>
              )}
            </div>
          </div>

          {loading && !data ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-surface-container-low rounded-lg animate-pulse"></div>)}
            </div>
          ) : error ? (
            <div className="p-8"><ErrorState error={error} onRetry={fetchExpenses} /></div>
          ) : data?.expenses.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant/40 mb-3">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <p className="text-sm text-on-surface-variant/60 font-medium">No expenses recorded for this view.</p>
              <button onClick={() => setFormOpen('create')} className="mt-3 text-xs font-bold uppercase tracking-widest text-primary hover:underline">
                Record the first expense
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left font-body">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <Th>Date</Th>
                      <Th>Category</Th>
                      <Th>Description</Th>
                      <Th>Payment</Th>
                      <Th>Amount</Th>
                      <Th>VAT</Th>
                      <Th>Deductible</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {data.expenses.map((x) => {
                      const cm = catMeta(x.category);
                      return (
                        <tr key={x._id} className="hover:bg-secondary-container/5 transition-colors group">
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 whitespace-nowrap text-on-surface-variant/70">{fmtDate(x.date)}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${cm.color}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cm.dot }}></span>
                              {x.category}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5">
                            <p className="font-bold text-on-surface tracking-tight">{x.description}</p>
                            {(x.payee || x.reference) && (
                              <p className="text-2xs text-on-surface-variant/60">{[x.payee, x.reference].filter(Boolean).join(' · ')}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70">{x.paymentMethod}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 font-bold text-on-surface tabular-nums">{fmtKESFull(x.amount)}</td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70 tabular-nums">
                            {x.vatApplicable ? fmtKESFull(x.vatAmount) : '—'}
                          </td>
                          <td className="px-3 py-2.5 border-b border-outline-variant/5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${x.deductible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                              {x.deductible ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 border-b border-outline-variant/5 text-right whitespace-nowrap">
                            <button onClick={() => setFormOpen(x)} title="Edit" className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-colors">
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button onClick={() => setDeleteState({ expense: x, busy: false, error: '' })} title="Delete" className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-outline-variant/10">
                {data.expenses.map((x) => {
                  const cm = catMeta(x.category);
                  return (
                    <div key={x._id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border mb-1 ${cm.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cm.dot }}></span>
                            {x.category}
                          </span>
                          <p className="font-bold text-on-surface text-sm tracking-tight truncate">{x.description}</p>
                          <p className="text-2xs text-on-surface-variant/50">{fmtDate(x.date)} · {x.paymentMethod}</p>
                        </div>
                        <p className="font-bold text-on-surface tabular-nums shrink-0">{fmtKESFull(x.amount)}</p>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button onClick={() => setFormOpen(x)} className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-colors">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button onClick={() => setDeleteState({ expense: x, busy: false, error: '' })} className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {data.pagination.total > 0 && (
                <div className="px-6 py-4 bg-surface flex items-center justify-between border-t border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant/60 font-body">Page {data.pagination.page} of {data.pagination.totalPages}</p>
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
            </>
          )}
        </div>

        {formOpen && (
          <ExpenseForm
            existing={formOpen === 'create' ? null : formOpen}
            categories={categories}
            paymentMethods={paymentMethods}
            onClose={() => setFormOpen(null)}
            onSave={handleSave}
            onDone={() => { setFormOpen(null); refreshAll(); }}
          />
        )}

        {deleteState && (
          <DeleteModal state={deleteState} onClose={() => !deleteState.busy && setDeleteState(null)} onConfirm={confirmDelete} />
        )}
      </div>
    </Layout>
  );
};

// ── P&L KPI card ─────────────────────────────────────────────────────────
const PnlCard = ({ label, value, icon, tone, subtitle }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    violet:  'bg-violet-50 text-violet-600',
    red:     'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || toneMap.primary}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <p className="text-lg font-bold text-on-surface tracking-tighter">{value}</p>
      {subtitle && <p className="text-2xs text-on-surface-variant/50 mt-1">{subtitle}</p>}
    </div>
  );
};

// ── Category donut ───────────────────────────────────────────────────────
const CategoryMix = ({ categories }) => {
  const total = categories.reduce((s, r) => s + r.total, 0);
  if (total === 0) return <p className="py-8 text-center text-on-surface-variant/40 text-sm">No expenses in this period.</p>;
  let offset = 0;
  const top = categories.slice(0, 8);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
          {top.map((r, i) => {
            const meta = catMeta(r.category);
            const pct = (r.total / total) * 100;
            const circ = 2 * Math.PI * 15.5;
            const dash = (pct / 100) * circ;
            const seg = (
              <circle key={i} cx="18" cy="18" r="15.5" fill="none" stroke={meta.dot} strokeWidth="3"
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} />
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
        {top.map((r, i) => {
          const meta = catMeta(r.category);
          return (
            <div key={i} className="flex items-center gap-2 text-2xs">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: meta.dot }}></span>
              <span className="font-bold text-on-surface-variant/70 flex-1 truncate">{r.category}</span>
              <span className="font-bold text-on-surface tabular-nums">{fmtKES(r.total)}</span>
              <span className="text-on-surface-variant/50 tabular-nums w-10 text-right">{((r.total / total) * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Income vs Expenses trend (grouped bars) ─────────────────────────────
const TrendChart = ({ monthly }) => {
  if (!monthly || monthly.length === 0) return <div className="h-[200px] flex items-center justify-center text-on-surface-variant/40 text-sm">No data yet.</div>;
  const w = 800, h = 220;
  const padL = 44, padR = 16, padT = 10, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...monthly.flatMap((m) => [m.income, m.expenses]), 1);
  const groupW = innerW / monthly.length;
  const barW = Math.min(16, groupW * 0.28);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[600px]" style={{ height: 220 }}>
        {[0, 0.5, 1].map((p, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={padT + p * innerH} y2={padT + p * innerH} stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" />
            <text x={padL - 6} y={padT + p * innerH + 3} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="end" fontWeight="700">{fmtKES(max * (1 - p))}</text>
          </g>
        ))}
        {monthly.map((m, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const incomeH = (m.income / max) * innerH;
          const expH = (m.expenses / max) * innerH;
          return (
            <g key={m.month}>
              <rect x={cx - barW - 2} y={padT + innerH - incomeH} width={barW} height={incomeH} fill="#10B981" rx="2" />
              <rect x={cx + 2} y={padT + innerH - expH} width={barW} height={expH} fill="#F59E0B" rx="2" />
              <text x={cx} y={h - 8} fontSize="9" fill="rgba(0,0,0,0.4)" textAnchor="middle" fontWeight="700">{monthLabel(m.month)}</text>
            </g>
          );
        })}
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

const ErrorState = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
      <span className="material-symbols-outlined text-3xl">error</span>
    </div>
    <h3 className="text-lg font-bold text-red-900 mb-1">Bookkeeping data unavailable</h3>
    <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{error}</p>
    <button onClick={onRetry} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest rounded-lg">Retry</button>
  </div>
);

// ── Add / Edit expense modal ─────────────────────────────────────────────
const toDateInput = (d) => new Date(d || Date.now()).toISOString().slice(0, 10);

const ExpenseForm = ({ existing, categories, paymentMethods, onClose, onSave, onDone }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    date: toDateInput(existing?.date),
    category: existing?.category || categories[0],
    description: existing?.description || '',
    payee: existing?.payee || '',
    amount: existing?.amount ?? '',
    paymentMethod: existing?.paymentMethod || paymentMethods[0],
    reference: existing?.reference || '',
    vatApplicable: existing?.vatApplicable || false,
    vatAmount: existing?.vatAmount || '',
    deductible: existing?.deductible !== false,
    notes: existing?.notes || '',
    receiptFile: null,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [receiptUrl, setReceiptUrl] = useState(existing?.receiptUrl || null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));

  function autoVat() {
    const amt = Number(form.amount) || 0;
    setForm((f) => ({ ...f, vatAmount: (amt * 0.16).toFixed(2) }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const amt = Number(form.amount);
    if (!form.description.trim()) { setErr('Enter a description.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid amount greater than zero.'); return; }

    setBusy(true);
    try {
      const payload = {
        date: form.date,
        category: form.category,
        description: form.description.trim(),
        payee: form.payee.trim(),
        amount: amt,
        paymentMethod: form.paymentMethod,
        reference: form.reference.trim(),
        vatApplicable: form.vatApplicable,
        vatAmount: form.vatApplicable ? Number(form.vatAmount) || 0 : 0,
        deductible: form.deductible,
        notes: form.notes.trim(),
        receiptFile: form.receiptFile,
      };
      const res = await onSave(payload, existing);
      if (res?.success) {
        showToast(existing ? 'Expense updated.' : 'Expense recorded.');
        onDone();
      } else {
        setErr(res?.error || 'Could not save this expense.');
      }
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not save this expense.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white shrink-0">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">{existing ? 'Edit entry' : 'New entry'}</p>
          <h3 className="text-xl font-bold tracking-tight">{existing ? 'Edit expense' : 'Record an expense'}</h3>
          <p className="text-xs text-emerald-100/60 mt-1">Kept in the KRA-ready category set — export anytime for filing.</p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required>
              <input type="date" required value={form.date} onChange={set('date')} className={inputClass} />
            </Field>
            <Field label="Category" required>
              <select value={form.category} onChange={set('category')} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Description" required>
            <input type="text" required value={form.description} onChange={set('description')} placeholder="e.g. Office rent — Westlands, July" className={inputClass} maxLength={300} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Payee / Vendor">
              <input type="text" value={form.payee} onChange={set('payee')} placeholder="e.g. Acme Landlords Ltd" className={inputClass} maxLength={150} />
            </Field>
            <Field label="Amount (KES)" required>
              <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={set('amount')} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Method">
              <select value={form.paymentMethod} onChange={set('paymentMethod')} className={inputClass}>
                {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Receipt / Invoice No." hint="Optional — keeps a paper trail for the audit.">
              <input type="text" value={form.reference} onChange={set('reference')} className={inputClass} maxLength={100} />
            </Field>
          </div>

          <Field label="Receipt / Invoice file" hint="Optional scanned copy — the actual document backing this expense.">
            {existing ? (
              <UploadableDocRow
                url={receiptUrl}
                label="Receipt"
                onUpload={async (file) => {
                  const form2 = new FormData();
                  form2.append('receipt', file);
                  const res = await api.patch(`/api/admin/bookkeeping/expenses/${existing._id}/receipt`, form2);
                  setReceiptUrl(res.data.receiptUrl);
                  return res.data.receiptUrl;
                }}
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all bg-primary/10 text-primary hover:bg-primary/15">
                  <span className="material-symbols-outlined text-[13px]">upload</span>
                  {form.receiptFile ? 'Change file' : 'Attach file'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0] || null; setForm((f2) => ({ ...f2, receiptFile: f })); }}
                  />
                </label>
                {form.receiptFile && <span className="text-2xs text-on-surface-variant/60 truncate max-w-50">{form.receiptFile.name}</span>}
              </div>
            )}
          </Field>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/40">
            <input type="checkbox" id="vatApplicable" checked={form.vatApplicable} onChange={set('vatApplicable')} className="w-4 h-4 accent-primary" />
            <label htmlFor="vatApplicable" className="text-xs font-bold text-on-surface flex-1">VAT applicable on this expense</label>
            {form.vatApplicable && (
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.01" value={form.vatAmount} onChange={set('vatAmount')} placeholder="VAT amount" className="w-28 px-2 py-1.5 border border-outline-variant/40 rounded-lg text-xs outline-none focus:border-primary" />
                <button type="button" onClick={autoVat} className="px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest hover:bg-primary/15">16%</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/40">
            <input type="checkbox" id="deductible" checked={form.deductible} onChange={set('deductible')} className="w-4 h-4 accent-primary" />
            <label htmlFor="deductible" className="text-xs font-bold text-on-surface flex-1">Tax-deductible (KRA allowable business expense)</label>
          </div>

          <Field label="Notes" hint="Optional internal note — not included on the KRA export.">
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={inputClass} maxLength={500} />
          </Field>

          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">{existing ? 'save' : 'add'}</span>
              {busy ? 'Saving…' : existing ? 'Save changes' : 'Record expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteModal = ({ state, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">delete</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-1">Delete expense</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        Permanently remove <strong>{state.expense.description}</strong> ({fmtKESFull(state.expense.amount)})? This cannot be undone.
      </p>
      {state.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{state.error}</div>}
      <div className="flex gap-3">
        <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button onClick={onConfirm} disabled={state.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
          {state.busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

export default Bookkeeping;
