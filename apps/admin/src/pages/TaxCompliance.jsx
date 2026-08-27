import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { formatKES } from '../utils/formatCurrency';
import TaxDeadlineCalendar from '../components/ui/TaxDeadlineCalendar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Constants ─────────────────────────────────────────────────────────────
const PERIODS = [
  { v: 'this_month',   l: 'This Month' },
  { v: 'last_month',   l: 'Last Month' },
  { v: 'this_quarter', l: 'This Quarter' },
  { v: 'ytd',          l: 'YTD' },
  { v: 'all',          l: 'All Time' },
];

// Every payout-shaped Transaction type — mirrors CREDIT_TYPES' complement
// in apps/merchant-dashboard/src/utils/transactionDirection.js (kept as an
// explicit list here rather than importing across apps, since these are
// separate Vite apps with no shared package).
const PAYOUT_TYPES = [
  'outbound', 'bulk_pay', 'withdrawal', 'settlement', 'mpesa_b2c', 'mpesa_b2b',
  'ncba_outbound', 'ncba_mobile_b2w', 'ncba_lipa_na_mpesa', 'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc',
];

const TAX_TYPES = ['VAT', 'PAYE', 'Corporate Income Tax', 'Withholding Tax', 'Other'];
const RECURRENCES = [
  { v: 'monthly', l: 'Monthly' },
  { v: 'annual', l: 'Annual' },
  { v: 'one_off', l: 'One-off' },
];

const fmtKES = formatKES;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

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

// ── P&L KPI card (same visual language as Bookkeeping.jsx's PnlCard) ────────
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

// ── Deadline countdown ring — days-remaining adaptation of
// SessionTimeoutModal.jsx's seconds-remaining SVG progress ring ───────────
const CountdownCard = ({ deadline }) => {
  const days = deadline.daysRemaining ?? 0;
  const urgent = days <= 3;
  const pct = Math.max(0, Math.min(100, (days / Math.max(deadline.reminderLeadDays, 1)) * 100));
  const r = 32;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-3.5 shadow-sm">
      <svg className="w-16 h-16 -rotate-90 shrink-0" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#F1F5F9" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={urgent ? '#DC2626' : '#F59E0B'} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">{deadline.taxType}</p>
        <p className="text-sm font-bold text-on-surface tracking-tight">{deadline.label}</p>
        <p className={`text-2xs font-bold mt-0.5 ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
          {days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`} · {fmtDate(deadline.nextDueDate)}
        </p>
      </div>
    </div>
  );
};

const ErrorState = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
      <span className="material-symbols-outlined text-3xl">error</span>
    </div>
    <h3 className="text-lg font-bold text-red-900 mb-1">Data unavailable</h3>
    <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{error}</p>
    <button onClick={onRetry} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest rounded-lg">Retry</button>
  </div>
);

const Th = ({ children }) => (
  <th className="px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
);

const TaxCompliance = () => {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('this_month');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [kraExporting, setKraExporting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const [deadlines, setDeadlines] = useState([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);
  const [deadlinesError, setDeadlinesError] = useState('');
  const [deadlineForm, setDeadlineForm] = useState(null); // null | 'create' | deadline object
  const [deleteState, setDeleteState] = useState(null);

  const [payoutQuery, setPayoutQuery] = useState('');
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutRows, setPayoutRows] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutExporting, setPayoutExporting] = useState(false);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await api.get('/api/admin/bookkeeping/summary', { params: { preset: period } });
      if (res.data?.success) setSummary(res.data.data);
      else setSummaryError(res.data?.error || 'Could not load the tax summary.');
    } catch (e) {
      setSummaryError(e?.response?.data?.error || 'Could not load the tax summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, [period]);

  const fetchDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    setDeadlinesError('');
    try {
      const res = await api.get('/api/admin/tax-deadlines');
      if (res.data?.success) setDeadlines(res.data.data);
      else setDeadlinesError(res.data?.error || 'Could not load the filing calendar.');
    } catch (e) {
      setDeadlinesError(e?.response?.data?.error || 'Could not load the filing calendar.');
    } finally {
      setDeadlinesLoading(false);
    }
  }, []);

  const fetchPayouts = useCallback(async () => {
    setPayoutLoading(true);
    setPayoutError('');
    try {
      const res = await api.get('/api/admin/transaction-audit', {
        params: { type: PAYOUT_TYPES.join(','), q: payoutSearch, limit: 100, preset: period },
      });
      if (res.data?.success) setPayoutRows(res.data.data);
      else setPayoutError(res.data?.error || 'Could not load the payout audit trail.');
    } catch (e) {
      setPayoutError(e?.response?.data?.error || 'Could not load the payout audit trail.');
    } finally {
      setPayoutLoading(false);
    }
  }, [payoutSearch, period]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);
  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPayoutSearch(payoutQuery), 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [payoutQuery]);

  async function downloadKraExport() {
    setKraExporting(true);
    try {
      const res = await api.get('/api/admin/bookkeeping/kra-export', { params: { preset: period }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `paychain-kra-revenue-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Could not download the KRA revenue export.', 'error');
    } finally {
      setKraExporting(false);
    }
  }

  // Built purely from `summary` — the exact same response the KPI strip
  // above already renders, not a second server round trip or a separate
  // calculation. That's deliberate: a persisted server-side PDF would be a
  // fourth copy of these numbers that could silently go stale the moment
  // an expense is edited after generation; regenerating on demand from
  // whatever's already on screen means it's always current.
  function downloadMonthlySummaryPdf() {
    if (!summary?.pnl) { showToast('Nothing to summarize yet — wait for the period to load.', 'error'); return; }
    setPdfGenerating(true);
    try {
      const { pnl, period: p, categories } = summary;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const L = 14, R = W - 14;
      const now = new Date();

      // Header band
      doc.setFillColor(6, 32, 27);
      doc.rect(0, 0, W, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('PayChain Kenya', L, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(94, 254, 179);
      doc.text('MONTHLY TAX & REVENUE SUMMARY', L, 22);
      doc.setTextColor(200, 220, 210);
      doc.setFontSize(8);
      doc.text(`Period: ${p.label}`, L, 28);
      doc.text(`Generated: ${now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`, R, 28, { align: 'right' });

      // KPI block
      let y = 46;
      doc.setTextColor(6, 32, 27);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Profit & Loss Summary', L, y);
      doc.setDrawColor(220, 230, 225);
      doc.line(L, y + 2, R, y + 2);
      y += 9;

      const rows = [
        ['Income (Fee Revenue)', fmtKES(pnl.income)],
        ['Total Expenses', fmtKES(pnl.totalExpenses)],
        ['Deductible Expenses', fmtKES(pnl.deductibleExpenses)],
        ['Net Profit', fmtKES(pnl.netProfit)],
        ['Taxable Profit', fmtKES(pnl.taxableProfit)],
        ['Input VAT (on expenses)', fmtKES(pnl.vatTotal)],
        [`Estimated Tax Liability (${(pnl.taxRate * 100).toFixed(0)}% corporate rate)`, fmtKES(pnl.estimatedTaxLiability)],
      ];
      rows.forEach(([label, value], i) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 100, 95);
        doc.text(label, L, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 32, 27);
        doc.text(value, R, y, { align: 'right' });
        y += 7;
        if (i === rows.length - 1) {
          doc.setDrawColor(6, 32, 27);
          doc.setLineWidth(0.5);
          doc.line(L, y - 4.5, R, y - 4.5);
        }
      });

      // Category breakdown table
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(6, 32, 27);
      doc.text('Expense by Category', L, y);
      y += 4;

      if (categories?.length) {
        autoTable(doc, {
          startY: y,
          margin: { left: L, right: L },
          head: [['Category', 'Entries', 'Total (KES)']],
          body: categories.map((c) => [c.category, String(c.count), fmtKES(c.total)]),
          styles: { font: 'helvetica', fontSize: 8.5, textColor: [60, 70, 65] },
          headStyles: { fillColor: [6, 32, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [244, 247, 245] },
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(120, 130, 125);
        doc.text('No expenses recorded for this period.', L, y + 6);
        y += 16;
      }

      // Footer disclaimer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 150, 145);
      doc.text(
        'Generated by PayChain Admin for accountant use in KRA filing — not an official KRA document.',
        L, pageH - 12
      );
      doc.text(`© ${now.getFullYear()} PayChainKE · Nairobi, Kenya`, L, pageH - 8);

      doc.save(`paychain-monthly-tax-summary-${p.preset}-${now.toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      showToast('Could not generate the summary PDF.', 'error');
    } finally {
      setPdfGenerating(false);
    }
  }

  async function downloadPayoutAuditCsv() {
    setPayoutExporting(true);
    try {
      const res = await api.get('/api/admin/transaction-audit/export', {
        params: { type: PAYOUT_TYPES.join(','), q: payoutSearch, preset: period },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `paychain-payout-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Could not download the payout audit CSV.', 'error');
    } finally {
      setPayoutExporting(false);
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }
  const sortedPayoutRows = [...payoutRows].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'merchant') { av = a.merchant?.businessName || ''; bv = b.merchant?.businessName || ''; }
    if (typeof av === 'string') { av = av || ''; bv = bv || ''; return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
    av = av || 0; bv = bv || 0;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  async function handleSaveDeadline(payload, existing) {
    if (existing) {
      const res = await api.put(`/api/admin/tax-deadlines/${existing._id}`, payload);
      return res.data;
    }
    const res = await api.post('/api/admin/tax-deadlines', payload);
    return res.data;
  }

  async function confirmDeleteDeadline() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.delete(`/api/admin/tax-deadlines/${deleteState.deadline._id}`);
      if (res.data?.success) {
        showToast('Deadline removed from the calendar.');
        setDeleteState(null);
        fetchDeadlines();
      } else {
        setDeleteState((s) => ({ ...s, busy: false, error: res.data?.error || 'Could not remove this deadline.' }));
      }
    } catch (e) {
      setDeleteState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Could not remove this deadline.' }));
    }
  }

  const pnl = summary?.pnl;
  const upcoming = [...deadlines].filter((d) => (d.daysRemaining ?? 999) <= d.reminderLeadDays).slice(0, 4);

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
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Filing Readiness</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                Tax &amp; Compliance
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                One place for month-end filing prep — estimated tax liability, the KRA-ready revenue export, filing deadlines, and the payout audit trail for bank reconciliation.
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
              <button onClick={downloadKraExport} disabled={kraExporting} className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-50">
                <span className={`material-symbols-outlined text-base ${kraExporting ? 'animate-spin' : ''}`}>{kraExporting ? 'progress_activity' : 'file_download'}</span>
                {kraExporting ? 'Preparing…' : 'KRA Export'}
              </button>
              <button onClick={downloadMonthlySummaryPdf} disabled={pdfGenerating || !summary} className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg disabled:opacity-50">
                <span className={`material-symbols-outlined text-base ${pdfGenerating ? 'animate-spin' : ''}`}>{pdfGenerating ? 'progress_activity' : 'picture_as_pdf'}</span>
                {pdfGenerating ? 'Generating…' : 'Monthly Summary PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        {summaryError ? (
          <ErrorState error={summaryError} onRetry={fetchSummary} />
        ) : summaryLoading && !summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-surface-container-low rounded-2xl animate-pulse"></div>)}
          </div>
        ) : pnl ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <PnlCard label="Income (Fee Revenue)" value={fmtKES(pnl.income)} icon="trending_up" tone="emerald" />
            <PnlCard label="Total Expenses" value={fmtKES(pnl.totalExpenses)} icon="receipt_long" tone="amber" />
            <PnlCard label="Deductible Expenses" value={fmtKES(pnl.deductibleExpenses)} icon="fact_check" tone="blue" />
            <PnlCard label="Taxable Profit" value={fmtKES(pnl.taxableProfit)} icon="calculate" tone="violet" subtitle="Income − deductible" />
            <PnlCard
              label="Est. Tax Liability"
              value={fmtKES(pnl.estimatedTaxLiability)}
              icon="gavel"
              tone={pnl.estimatedTaxLiability > 0 ? 'red' : 'emerald'}
              subtitle={`${(pnl.taxRate * 100).toFixed(0)}% corporate rate — estimate, not a filed figure`}
            />
          </div>
        ) : null}

        {/* Deadlines: countdowns + calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Filing Calendar</p>
                <h3 className="text-lg font-bold text-on-surface tracking-tight">Upcoming Deadlines</h3>
              </div>
              <button onClick={() => setDeadlineForm('create')} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-2xs font-bold rounded-xl uppercase tracking-widest hover:bg-primary/15 transition-all">
                <span className="material-symbols-outlined text-base">add</span>
                New Deadline
              </button>
            </div>

            {deadlinesError ? (
              <ErrorState error={deadlinesError} onRetry={fetchDeadlines} />
            ) : deadlinesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-surface-container-low rounded-2xl animate-pulse"></div>)}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 text-center text-sm text-on-surface-variant/50">
                Nothing due within its reminder window right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcoming.map((d) => <CountdownCard key={d._id} deadline={d} />)}
              </div>
            )}

            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-editorial">
              <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">All configured deadlines</p>
              </div>
              {deadlines.length === 0 ? (
                <p className="p-6 text-center text-sm text-on-surface-variant/40">No deadlines configured yet.</p>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {deadlines.map((d) => (
                    <div key={d._id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{d.label}</p>
                        <p className="text-2xs text-on-surface-variant/50">{d.taxType} · {d.recurrence} · next {fmtDate(d.nextDueDate)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setDeadlineForm(d)} className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-colors">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button onClick={() => setDeleteState({ deadline: d, busy: false, error: '' })} className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Calendar</p>
            <h3 className="text-lg font-bold text-on-surface tracking-tight mb-3">This Month at a Glance</h3>
            <TaxDeadlineCalendar deadlines={deadlines} />
          </div>
        </div>

        {/* Payout audit trail */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Reconciliation</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Payout Audit Trail
                <span className="ml-2 text-2xs font-bold text-on-surface-variant/50 tabular-nums">· {payoutRows.length} shown</span>
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                <input
                  value={payoutQuery}
                  onChange={(e) => setPayoutQuery(e.target.value)}
                  placeholder="Merchant name, email, or reference..."
                  className="pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs w-full sm:w-72"
                />
              </div>
              <button onClick={downloadPayoutAuditCsv} disabled={payoutExporting} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-container border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">{payoutExporting ? 'progress_activity' : 'download'}</span>
                {payoutExporting ? 'Preparing…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {payoutError ? (
            <div className="p-8"><ErrorState error={payoutError} onRetry={fetchPayouts} /></div>
          ) : payoutLoading && payoutRows.length === 0 ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-surface-container-low rounded-lg animate-pulse"></div>)}
            </div>
          ) : payoutRows.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm text-on-surface-variant/60 font-medium">No payouts found for this period/search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-body">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    {[['createdAt', 'Date'], ['reference', 'Reference'], ['merchant', 'Merchant'], ['type', 'Type'], ['status', 'Status'], ['kesAmount', 'Amount'], ['paychainFee', 'Fee'], ['balanceAfter', 'Balance After']].map(([key, label]) => (
                      <th key={key} className="px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 cursor-pointer select-none hover:text-primary" onClick={() => toggleSort(key)}>
                        {label} {sortKey === key && <span className="material-symbols-outlined text-xs align-middle">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {sortedPayoutRows.map((t) => (
                    <tr key={t._id} className="hover:bg-secondary-container/5 transition-colors">
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 whitespace-nowrap text-on-surface-variant/70">{fmtDateTime(t.createdAt)}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 font-mono text-on-surface-variant/70 truncate max-w-40">{t.reference}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 font-bold text-on-surface truncate max-w-40">{t.merchant?.businessName || 'Deleted Merchant'}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70">{t.type}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${
                          t.status === 'completed' || t.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : t.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 font-bold text-on-surface tabular-nums">{fmtKES(t.kesAmount ?? t.amount)}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70 tabular-nums">{fmtKES(t.paychainFee || 0)}</td>
                      <td className="px-3 py-2.5 border-b border-outline-variant/5 text-on-surface-variant/70 tabular-nums">{t.balanceAfter != null ? fmtKES(t.balanceAfter) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {deadlineForm && (
          <DeadlineForm
            existing={deadlineForm === 'create' ? null : deadlineForm}
            onClose={() => setDeadlineForm(null)}
            onSave={handleSaveDeadline}
            onDone={() => { setDeadlineForm(null); fetchDeadlines(); }}
          />
        )}

        {deleteState && (
          <DeleteDeadlineModal state={deleteState} onClose={() => !deleteState.busy && setDeleteState(null)} onConfirm={confirmDeleteDeadline} />
        )}
      </div>
    </Layout>
  );
};

// ── Add / Edit deadline modal ────────────────────────────────────────────
const DeadlineForm = ({ existing, onClose, onSave, onDone }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    label: existing?.label || '',
    taxType: existing?.taxType || TAX_TYPES[0],
    recurrence: existing?.recurrence || 'monthly',
    dayOfMonth: existing?.dayOfMonth || 20,
    annualMonth: existing?.annualMonth || 6,
    annualDay: existing?.annualDay || 30,
    oneOffDate: existing?.oneOffDate ? new Date(existing.oneOffDate).toISOString().slice(0, 10) : '',
    reminderLeadDays: existing?.reminderLeadDays ?? 7,
    notes: existing?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.label.trim()) { setErr('Enter a label.'); return; }
    setBusy(true);
    try {
      const payload = {
        label: form.label.trim(),
        taxType: form.taxType,
        recurrence: form.recurrence,
        dayOfMonth: form.recurrence === 'monthly' ? Number(form.dayOfMonth) : undefined,
        annualMonth: form.recurrence === 'annual' ? Number(form.annualMonth) : undefined,
        annualDay: form.recurrence === 'annual' ? Number(form.annualDay) : undefined,
        oneOffDate: form.recurrence === 'one_off' ? form.oneOffDate : undefined,
        reminderLeadDays: Number(form.reminderLeadDays),
        notes: form.notes.trim(),
      };
      const res = await onSave(payload, existing);
      if (res?.success) {
        showToast(existing ? 'Deadline updated.' : 'Deadline added.');
        onDone();
      } else {
        setErr(res?.error || 'Could not save this deadline.');
      }
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not save this deadline.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white shrink-0">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">{existing ? 'Edit deadline' : 'New deadline'}</p>
          <h3 className="text-xl font-bold tracking-tight">{existing ? 'Edit filing deadline' : 'Add a filing deadline'}</h3>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto" autoComplete="off">
          <Field label="Label" required>
            <input type="text" required value={form.label} onChange={set('label')} placeholder="e.g. VAT Return (VAT3)" className={inputClass} maxLength={150} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tax Type" required>
              <select value={form.taxType} onChange={set('taxType')} className={inputClass}>
                {TAX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Recurrence" required>
              <select value={form.recurrence} onChange={set('recurrence')} className={inputClass}>
                {RECURRENCES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </Field>
          </div>

          {form.recurrence === 'monthly' && (
            <Field label="Day of Month" required hint="1-28, to avoid a 31st deadline skipping short months.">
              <input type="number" min="1" max="28" required value={form.dayOfMonth} onChange={set('dayOfMonth')} className={inputClass} />
            </Field>
          )}
          {form.recurrence === 'annual' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month" required>
                <input type="number" min="1" max="12" required value={form.annualMonth} onChange={set('annualMonth')} className={inputClass} />
              </Field>
              <Field label="Day" required>
                <input type="number" min="1" max="28" required value={form.annualDay} onChange={set('annualDay')} className={inputClass} />
              </Field>
            </div>
          )}
          {form.recurrence === 'one_off' && (
            <Field label="Date" required>
              <input type="date" required value={form.oneOffDate} onChange={set('oneOffDate')} className={inputClass} />
            </Field>
          )}

          <Field label="Reminder Lead Time (days)" required hint="How many days before it's due to start emailing owners.">
            <input type="number" min="1" max="60" required value={form.reminderLeadDays} onChange={set('reminderLeadDays')} className={inputClass} />
          </Field>

          <Field label="Notes" hint="Optional — included in the reminder email.">
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={inputClass} maxLength={500} />
          </Field>

          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">{existing ? 'save' : 'add'}</span>
              {busy ? 'Saving…' : existing ? 'Save changes' : 'Add deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteDeadlineModal = ({ state, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">delete</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-1">Remove deadline</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        Remove <strong>{state.deadline.label}</strong> from the filing calendar? Reminder history is kept, and you can re-add it later.
      </p>
      {state.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{state.error}</div>}
      <div className="flex gap-3">
        <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button onClick={onConfirm} disabled={state.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
          {state.busy ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
  </div>
);

export default TaxCompliance;
