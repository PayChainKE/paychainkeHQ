import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { formatKES } from '../utils/formatCurrency';

// Rounding noise across many independently-rounded transaction amounts can
// add up to a few cents; anything past this is a real gap, not float drift.
// Mirrors services/reconciliationService.js's own TOLERANCE exactly, so the
// live-balance discrepancy card and the manual-check history agree on what
// counts as "matched".
const TOLERANCE = 1;

const Skel = ({ className = 'w-24 h-7' }) => (
  <span className={`inline-block ${className} bg-surface-container/80 rounded align-middle animate-pulse`} aria-hidden="true" />
);

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

/**
 * Pool Reconciliation — is the money actually sitting in PayChain's pooled
 * NCBA account what the ledger says should be there?
 *
 * Three independent figures, deliberately never blended into one number:
 *  - Live balance: a real-time pull from NCBA's own AccountDetails endpoint
 *    (services/ncbaOpenBankingService.js#getNcbaAccountBalance). This had
 *    never been called from this codebase before this page — its response
 *    shape isn't fully confirmed, so it can report "unavailable" rather
 *    than guess.
 *  - Expected balance: purely computed from PayChain's own ledger — every
 *    merchant's real balance (money PayChain owes back to them) plus
 *    PayChain's own accrued-but-not-yet-swept fee revenue. Always available,
 *    no NCBA dependency.
 *  - Manual checks: an admin pastes in the real balance from NCBA's own
 *    statement/portal — the original, proven reconciliation flow, kept as
 *    a cross-check independent of whether the live pull above is trusted.
 */
const PoolReconciliation = () => {
  const { admin: currentAdmin } = useAuth();
  const canSubmitCheck = currentAdmin?.role === 'owner' || currentAdmin?.role === 'admin';

  const [expected, setExpected] = useState(null);
  const [expectedLoading, setExpectedLoading] = useState(true);

  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [showRawLive, setShowRawLive] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [merchantBalances, setMerchantBalances] = useState([]);
  const [merchantBalancesTotal, setMerchantBalancesTotal] = useState(0);
  const [merchantBalancesLoading, setMerchantBalancesLoading] = useState(true);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [exportingBalances, setExportingBalances] = useState(false);

  // Real NCBA account statement — the line-by-line ground truth for what
  // actually moved on the pooled account. Deliberately NOT auto-fetched on
  // mount or polled (unlike the balance card above) — it's a real NCBA API
  // call per date range, only pulled when an admin actually wants to dig
  // into a discrepancy, same restraint fetchLive's own doc comment already
  // applies to avoid hitting NCBA more than needed.
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const daysAgoIso = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [stmtFrom, setStmtFrom] = useState(daysAgoIso(7));
  const [stmtTo, setStmtTo] = useState(todayIso());
  const [statement, setStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementFetched, setStatementFetched] = useState(false);

  const fetchStatement = useCallback(async () => {
    setStatementLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/pool-account/statement', { params: { fromDate: stmtFrom, toDate: stmtTo } });
      setStatement(res.data?.data || null);
    } catch (e) {
      setStatement({ available: false, reason: e?.response?.data?.error || 'Request failed.' });
    } finally {
      setStatementLoading(false);
      setStatementFetched(true);
    }
  }, [stmtFrom, stmtTo]);

  const [stuckPayouts, setStuckPayouts] = useState([]);
  const [stuckLoading, setStuckLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState(null); // { transaction, succeeded }
  const [resolveBusy, setResolveBusy] = useState(false);

  const [reportedBalance, setReportedBalance] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); }, []);

  // `silent` — background refreshes (sync events, polling) hold the previous
  // render instead of flashing the skeleton back in. Only a real initial
  // load shows loading state. Same pattern Revenue.jsx uses for the same
  // reason (bank-dashboard-style refresh without disturbing what the admin
  // is looking at).
  const fetchExpected = useCallback(async (silent = false) => {
    if (!silent) setExpectedLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/pool-balance/expected');
      setExpected(res.data?.data || null);
    } catch (e) {
      if (!silent) setExpected(null);
    } finally {
      if (!silent) setExpectedLoading(false);
    }
  }, []);

  // Live NCBA balance is a real external API call (auth token + request to
  // NCBA) — deliberately NOT tied to paychain:sync, which fires on every
  // transaction platform-wide. Polling NCBA that often risks rate limits
  // for no real benefit, since the pool balance doesn't need to be that
  // fresh. Its own gentle fixed-interval poll instead, plus the manual
  // refresh button already on the card.
  const fetchLive = useCallback(async (silent = false) => {
    if (!silent) setLiveLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/pool-balance/live');
      setLive(res.data?.data || null);
    } catch (e) {
      if (!silent) setLive({ available: false, reason: 'Request failed.' });
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/revenue/reconciliations');
      setHistory(res.data?.data || []);
    } catch (e) {
      if (!silent) setHistory([]);
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, []);

  const fetchMerchantBalances = useCallback(async (silent = false) => {
    if (!silent) setMerchantBalancesLoading(true);
    try {
      const res = await api.get('/api/admin/merchants/balances');
      setMerchantBalances(res.data?.data || []);
      setMerchantBalancesTotal(res.data?.total ?? 0);
    } catch (e) {
      if (!silent) { setMerchantBalances([]); setMerchantBalancesTotal(0); }
    } finally {
      if (!silent) setMerchantBalancesLoading(false);
    }
  }, []);

  // Async-rail (Mobile B2W / Lipa na M-Pesa / KPLC / NCWSC) payouts NCBA
  // never sent a callback for — flagged by
  // services/ncbaOpenBankingReconciliationService.js's timeout sweep rather
  // than auto-refunded (NCBA's own status-check endpoint is broken, so a
  // bare timeout can't be trusted as proof of failure — see that file's doc
  // comment). Each one sits here until an admin checks NCBA's portal
  // directly and resolves it by hand. Real, uncredited-either-way money is
  // exactly what drives the Discrepancy card above away from zero, so this
  // lives right next to it.
  const fetchStuckPayouts = useCallback(async (silent = false) => {
    if (!silent) setStuckLoading(true);
    try {
      const res = await api.get('/api/admin/ncba-payouts/stuck-review');
      setStuckPayouts(res.data?.transactions || []);
    } catch (e) {
      if (!silent) setStuckPayouts([]);
    } finally {
      if (!silent) setStuckLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpected(); fetchLive(); fetchHistory(); fetchMerchantBalances(); fetchStuckPayouts(); }, [fetchExpected, fetchLive, fetchHistory, fetchMerchantBalances, fetchStuckPayouts]);

  // Ledger-derived figures + history refresh instantly on any real-time
  // platform event (see context/AuthContext.jsx's SSE connection), plus a
  // 30s fallback poll — matches Revenue.jsx's live-refresh convention.
  useEffect(() => {
    const id = setInterval(() => { fetchExpected(true); fetchHistory(true); fetchMerchantBalances(true); fetchStuckPayouts(true); }, 30_000);
    const onSync = () => { fetchExpected(true); fetchHistory(true); fetchMerchantBalances(true); fetchStuckPayouts(true); };
    window.addEventListener('paychain:sync', onSync);
    return () => { clearInterval(id); window.removeEventListener('paychain:sync', onSync); };
  }, [fetchExpected, fetchHistory, fetchMerchantBalances, fetchStuckPayouts]);

  // Live NCBA balance — its own slower, independent cadence (see fetchLive's
  // doc comment above for why this isn't tied to paychain:sync).
  useEffect(() => {
    const id = setInterval(() => fetchLive(true), 2 * 60_000);
    return () => clearInterval(id);
  }, [fetchLive]);

  const submitCheck = useCallback(async (e) => {
    e.preventDefault();
    const numeric = Number(reportedBalance);
    if (!Number.isFinite(numeric) || numeric < 0) {
      setSubmitError('Enter a valid, non-negative balance.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post('/api/admin/revenue/reconciliations', { reportedBalance: numeric, note: note || undefined });
      const record = res.data?.data;
      setHistory((prev) => [record, ...prev]);
      setReportedBalance('');
      setNote('');
      showToast(record?.status === 'matched' ? 'Recorded — balance matches the ledger.' : `Recorded — discrepancy of ${formatKES(Math.abs(record?.difference || 0))}.`);
    } catch (err) {
      setSubmitError(err?.response?.data?.error || 'Could not submit this check.');
    } finally {
      setSubmitting(false);
    }
  }, [reportedBalance, note, showToast]);

  // "Clear" one or many reconciliation checks from this list — archives
  // them (see archiveReconciliation/bulkArchiveReconciliations,
  // controllers/revenueController.js) rather than deleting the real
  // record, same reversible pattern Revenue.jsx already uses for sweep
  // history rows.
  const [selectedIds, setSelectedIds] = useState([]);
  const [clearTarget, setClearTarget] = useState(null); // single row pending confirmation, or 'bulk'
  const [clearBusy, setClearBusy] = useState(false);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === history.length ? [] : history.map((r) => r._id)));
  }, [history]);

  const confirmClear = useCallback(async () => {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      if (clearTarget === 'bulk') {
        const res = await api.post('/api/admin/revenue/reconciliations/bulk-archive', { ids: selectedIds });
        const clearedCount = res.data?.clearedCount ?? selectedIds.length;
        setHistory((prev) => prev.filter((r) => !selectedIds.includes(r._id)));
        setSelectedIds([]);
        showToast(`${clearedCount} reconciliation check${clearedCount === 1 ? '' : 's'} cleared from this list.`);
      } else {
        await api.patch(`/api/admin/revenue/reconciliations/${clearTarget._id}/archive`);
        setHistory((prev) => prev.filter((r) => r._id !== clearTarget._id));
        setSelectedIds((prev) => prev.filter((id) => id !== clearTarget._id));
        showToast('Reconciliation check cleared from this list.');
      }
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not clear that record.');
    } finally {
      setClearBusy(false);
      setClearTarget(null);
    }
  }, [clearTarget, selectedIds, showToast]);

  const confirmResolveStuckPayout = useCallback(async () => {
    if (!resolveTarget) return;
    setResolveBusy(true);
    try {
      const { transaction, succeeded } = resolveTarget;
      await api.post(`/api/admin/ncba-payouts/${encodeURIComponent(transaction.reference)}/resolve`, { succeeded });
      setStuckPayouts((prev) => prev.filter((t) => t.reference !== transaction.reference));
      showToast(succeeded
        ? `Marked ${transaction.reference} as succeeded — no refund issued.`
        : `Marked ${transaction.reference} as failed — KES ${transaction.kesAmount || transaction.amount} refunded to the merchant.`);
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not resolve this payout.');
    } finally {
      setResolveBusy(false);
      setResolveTarget(null);
    }
  }, [resolveTarget, showToast]);

  const exportMerchantBalancesCsv = useCallback(async () => {
    setExportingBalances(true);
    try {
      const res = await api.get('/api/admin/merchants/balances/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `paychain-merchant-balances-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Could not download merchant balances.');
    } finally {
      setExportingBalances(false);
    }
  }, [showToast]);

  const filteredMerchantBalances = useMemo(() => {
    const q = merchantSearch.trim().toLowerCase();
    if (!q) return merchantBalances;
    return merchantBalances.filter((m) =>
      (m.businessName || '').toLowerCase().includes(q) ||
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  }, [merchantBalances, merchantSearch]);

  const liveDiscrepancy = (live?.available && expected)
    ? Math.round((live.balance - expected.expectedPoolBalance) * 100) / 100
    : null;
  const liveMatches = liveDiscrepancy !== null && Math.abs(liveDiscrepancy) <= TOLERANCE;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <p className="text-2xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70">Finance · Internal</p>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter leading-none font-headline">
            Pool Reconciliation
          </h2>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            What's actually sitting in PayChain's pooled NCBA account, right now, versus what PayChain's own ledger says should
            be there. The pool holds two things: real money PayChain owes back to merchants, and PayChain's own fee revenue not
            yet swept to the corporate account.
          </p>
        </div>

        {/* ── Live vs Expected ─────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live NCBA balance — headline card */}
          <div className="bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] p-5 md:p-6 rounded-xl border border-emerald-900/40 relative overflow-hidden flex flex-col gap-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-emerald-200/70 uppercase tracking-widest">Live NCBA Balance</span>
              <button
                onClick={() => fetchLive()}
                title="Refresh live balance"
                className="text-emerald-200/60 hover:text-white transition-colors"
              >
                <span className={`material-symbols-outlined text-base ${liveLoading ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>
            {liveLoading ? (
              <Skel className="w-36 h-9 bg-white/10" />
            ) : live?.available ? (
              <span className="text-2xl md:text-4xl font-bold text-white tracking-tighter tabular-nums">{formatKES(live.balance)}</span>
            ) : (
              <span className="text-lg font-bold text-amber-300">Unavailable</span>
            )}
            {!liveLoading && live?.available && (
              <p className="text-2xs text-emerald-200/50">
                As of {fmtDateTime(live.fetchedAt)} · pulled directly from NCBA
                {live.totalBalance != null && live.totalBalance !== live.balance && (
                  <> · Ledger balance {formatKES(live.totalBalance)} (incl. uncleared)</>
                )}
              </p>
            )}
            {!liveLoading && !live?.available && (
              <div className="text-2xs text-emerald-200/50 space-y-1">
                <p>{live?.reason || 'NCBA did not return a usable balance.'} Use the manual check below instead.</p>
                {live?.raw && (
                  <button onClick={() => setShowRawLive((v) => !v)} className="underline hover:text-white transition-colors">
                    {showRawLive ? 'Hide' : 'View'} raw NCBA response
                  </button>
                )}
                {showRawLive && live?.raw && (
                  <pre className="mt-1 p-2 rounded bg-black/30 text-[10px] text-emerald-100/80 overflow-x-auto max-h-40">
                    {JSON.stringify(live.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Expected balance — computed from ledger */}
          <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl border border-outline-variant/20 flex flex-col gap-2">
            <span className="text-xs font-medium text-on-surface-variant/60">Expected Balance · Ledger</span>
            {expectedLoading ? (
              <Skel className="w-36 h-8" />
            ) : (
              <span className="text-2xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">
                {formatKES(expected?.expectedPoolBalance ?? 0)}
              </span>
            )}
            {!expectedLoading && expected && (
              <p className="text-2xs text-on-surface-variant/70 leading-relaxed">
                {formatKES(expected.merchantBalanceTotal)} merchant money + {formatKES(expected.unsweptRevenue)} PayChain unswept revenue
              </p>
            )}
          </div>

          {/* Discrepancy — only meaningful once a live balance is available */}
          <div className={`p-5 md:p-6 rounded-xl border flex flex-col gap-2 ${
            liveDiscrepancy === null ? 'bg-surface-container-lowest border-outline-variant/20'
            : liveMatches ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
          }`}>
            <span className={`text-xs font-medium ${liveDiscrepancy === null ? 'text-on-surface-variant/60' : liveMatches ? 'text-emerald-700' : 'text-red-700'}`}>
              Discrepancy · Live vs Expected
            </span>
            {liveLoading || expectedLoading ? (
              <Skel className="w-28 h-8" />
            ) : liveDiscrepancy === null ? (
              <span className="text-lg font-bold text-on-surface-variant/60">— No live balance to compare</span>
            ) : (
              <span className={`text-2xl md:text-3xl font-semibold tracking-tighter tabular-nums ${liveMatches ? 'text-emerald-700' : 'text-red-700'}`}>
                {liveMatches ? 'Matches' : `${liveDiscrepancy > 0 ? '+' : ''}${formatKES(liveDiscrepancy)}`}
              </span>
            )}
            {!liveLoading && !expectedLoading && liveDiscrepancy !== null && (
              <p className={`text-2xs ${liveMatches ? 'text-emerald-700/70' : 'text-red-700/70'}`}>
                {liveMatches
                  ? 'Within rounding tolerance — the pool holds what the ledger expects.'
                  : liveDiscrepancy > 0
                    ? 'NCBA reports more than the ledger expects — investigate before assuming it\'s a surplus.'
                    : 'NCBA reports less than the ledger expects — investigate immediately.'}
              </p>
            )}
          </div>
        </section>

        {/* ── Account Movement — the real NCBA statement ───────────────
            Line-by-line ground truth for what's actually posted on the
            pooled account, so a discrepancy above can be traced to a real
            entry instead of only ever comparing two totals. ──────────── */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 overflow-hidden">
          <div className="p-5 md:p-6 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Account Movement</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-xl">
                Every real debit and credit NCBA has posted on the pooled account (NCBA 1010837186), straight from NCBA's own
                statement — the ground truth to check against when the Discrepancy card above isn't zero.
              </p>
            </div>
            <div className="flex items-end gap-2 shrink-0">
              <div className="flex flex-col gap-1">
                <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">From</label>
                <input type="date" value={stmtFrom} max={stmtTo} onChange={(e) => setStmtFrom(e.target.value)}
                  className="bg-surface-container border border-outline-variant/40 rounded-md px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">To</label>
                <input type="date" value={stmtTo} min={stmtFrom} max={todayIso()} onChange={(e) => setStmtTo(e.target.value)}
                  className="bg-surface-container border border-outline-variant/40 rounded-md px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary" />
              </div>
              <button
                onClick={fetchStatement}
                disabled={statementLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-on-surface text-surface-container-lowest text-2xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${statementLoading ? 'animate-spin' : ''}`}>{statementLoading ? 'progress_activity' : 'receipt_long'}</span>
                {statementLoading ? 'Loading…' : 'Load Statement'}
              </button>
            </div>
          </div>

          {!statementFetched ? (
            <div className="px-5 md:px-6 pb-6 text-xs text-on-surface-variant/70">Pick a date range and load the statement — this calls NCBA directly, so it's on demand rather than automatic.</div>
          ) : statementLoading ? (
            <div className="p-8"><Skel className="w-full h-32" /></div>
          ) : !statement?.available ? (
            <div className="px-5 md:px-6 pb-6">
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                {statement?.reason || 'NCBA did not return a usable statement.'}
              </div>
            </div>
          ) : (
            <>
              {statement.summary && (
                <div className="px-5 md:px-6 pb-4 flex flex-wrap gap-x-6 gap-y-2 text-2xs text-on-surface-variant">
                  <span>Opening <span className="font-bold text-on-surface">{formatKES(statement.summary.openingBalance ?? 0)}</span></span>
                  <span>Closing <span className="font-bold text-on-surface">{formatKES(statement.summary.closingBalance ?? 0)}</span></span>
                  <span>Total Debit <span className="font-bold text-red-600">{formatKES(statement.summary.totalDebit ?? 0)}</span></span>
                  <span>Total Credit <span className="font-bold text-emerald-700">{formatKES(statement.summary.totalCredit ?? 0)}</span></span>
                  <span>{statement.summary.totalTxn ?? statement.entries.length} transactions</span>
                </div>
              )}
              {statement.entries.length === 0 ? (
                <div className="px-5 md:px-6 pb-6 text-xs text-on-surface-variant/70">No entries posted on this account in the selected range.</div>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-container/70 border-b border-outline-variant/40 sticky top-0">
                      <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                        <th className="text-left px-5 py-3">Date</th>
                        <th className="text-left px-3 py-3">Description</th>
                        <th className="text-left px-3 py-3">Reference</th>
                        <th className="text-right px-3 py-3">Debit</th>
                        <th className="text-right px-3 py-3">Credit</th>
                        <th className="text-right px-5 py-3">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.entries.map((e, i) => (
                        <tr key={i} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                          <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">{e.valueDate || '—'}</td>
                          <td className="px-3 py-3 text-on-surface">{e.description}</td>
                          <td className="px-3 py-3 font-mono text-2xs text-on-surface-variant">{e.reference || '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-red-600">{e.debit ? formatKES(e.debit) : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{e.credit ? formatKES(e.credit) : '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums font-bold text-on-surface">{e.runningBalance != null ? formatKES(e.runningBalance) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Stuck payouts needing manual review ──────────────────── */}
        {(stuckLoading || stuckPayouts.length > 0) && (
          <section className="bg-surface-container-lowest rounded-xl border border-amber-200 overflow-hidden">
            <div className="p-5 md:p-6 pb-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">report</span>
                  Stuck Payouts · Needs Manual Review
                </span>
                <p className="text-2xs text-on-surface-variant/60 mt-1 max-w-xl">
                  These NCBA async-rail payouts (Mobile B2W / Lipa na M-Pesa / KPLC / NCWSC) never received a confirmation callback. The merchant's balance was already debited, but NCBA's own status-check API is broken, so this can't be auto-refunded safely — check NCBA's portal for each reference, then mark it resolved.
                </p>
              </div>
              {!stuckLoading && stuckPayouts.length > 0 && (
                <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">{stuckPayouts.length}</span>
              )}
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-body">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <Th>Reference</Th>
                    <Th>Type</Th>
                    <Th>Merchant</Th>
                    <Th>Recipient</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Since</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {stuckLoading ? (
                    [...Array(2)].map((_, i) => (
                      <tr key={i}><td colSpan="7" className="px-3 py-3"><div className="h-5 bg-on-surface/5 rounded animate-pulse" /></td></tr>
                    ))
                  ) : stuckPayouts.map((t) => (
                    <tr key={t._id}>
                      <td className="px-3 py-2 border-b border-outline-variant/5 font-mono text-2xs font-bold text-on-surface">{t.reference}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/70">{t.type}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 font-bold text-on-surface truncate max-w-[160px]">{t.merchantId?.businessName || '—'}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 font-mono text-on-surface-variant/70">{t.recipient?.id || t.recipient?.name || '—'}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-right font-bold text-on-surface tabular-nums">{formatKES(t.kesAmount || t.amount)}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/70 whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-right whitespace-nowrap">
                        <button onClick={() => setResolveTarget({ transaction: t, succeeded: true })} className="text-2xs font-bold uppercase tracking-widest text-emerald-700 hover:text-emerald-900 px-2">Succeeded</button>
                        <button onClick={() => setResolveTarget({ transaction: t, succeeded: false })} className="text-2xs font-bold uppercase tracking-widest text-red-700 hover:text-red-900 px-2">Failed</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Merchant money vs PayChain money ─────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl border border-outline-variant/20 flex flex-col gap-2">
            <span className="text-xs font-medium text-on-surface-variant/60">Total Merchant Real Money</span>
            {expectedLoading ? (
              <Skel className="w-32 h-8" />
            ) : (
              <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">
                {formatKES(expected?.merchantBalanceTotal ?? 0)}
              </span>
            )}
            <p className="text-2xs text-on-surface-variant/60">
              Across {expectedLoading ? '…' : (expected?.merchantCount ?? 0).toLocaleString()} merchants — this is money PayChain owes back, not PayChain's own.
            </p>
          </div>
          <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl border border-outline-variant/20 flex flex-col gap-2">
            <span className="text-xs font-medium text-on-surface-variant/60">PayChain Unswept Revenue</span>
            {expectedLoading ? (
              <Skel className="w-32 h-8" />
            ) : (
              <span className="text-xl md:text-3xl font-semibold text-on-surface tracking-tighter tabular-nums">
                {formatKES(expected?.unsweptRevenue ?? 0)}
              </span>
            )}
            <p className="text-2xs text-on-surface-variant/60">PayChain's own fee revenue, collected but not yet swept to the corporate account.</p>
          </div>
        </section>

        {/* ── Merchant Balances — what's owed to each merchant, individually,
            never mixed with PayChain's own revenue. A record an admin can
            pull up and export during a dispute. ─────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Merchant Balances</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
                Every merchant's current KES balance — real money PayChain holds on their behalf, not PayChain's own revenue.
                This is the record to check first if a merchant disputes what they're owed.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                placeholder="Search merchant, email, phone…"
                className="w-56 bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                onClick={exportMerchantBalancesCsv}
                disabled={exportingBalances}
                title="Download every merchant's balance as a timestamped CSV record"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface-container border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">{exportingBalances ? 'progress_activity' : 'download'}</span>
                {exportingBalances ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {merchantBalancesLoading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : filteredMerchantBalances.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">
                {merchantSearch ? 'No merchants match that search.' : 'No merchants yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40 sticky top-0">
                    <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <th className="text-left px-5 py-3">Business</th>
                      <th className="text-left px-3 py-3">Contact</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-right px-5 py-3">KES Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMerchantBalances.map((m) => (
                      <tr key={m._id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-on-surface">{m.businessName || '—'}</div>
                          <div className="text-2xs text-on-surface-variant">{m.name || ''}</div>
                        </td>
                        <td className="px-3 py-3.5 text-on-surface-variant">
                          <div>{m.email || '—'}</div>
                          <div className="text-2xs">{m.phone || ''}</div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-2xs font-bold uppercase tracking-wider ${
                            m.status === 'locked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}>
                            {m.status || 'active'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-on-surface tabular-nums">{formatKES(m.kesBalance || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!merchantBalancesLoading && merchantBalances.length > 0 && (
            <div className="mt-3 flex items-center justify-between px-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-md text-2xs">
              <span className="text-on-surface-variant">
                {merchantSearch ? `${filteredMerchantBalances.length} of ${merchantBalances.length} merchants shown` : `${merchantBalances.length} merchants`}
              </span>
              <span className="text-on-surface-variant">Σ Total <span className="text-on-surface font-bold">{formatKES(merchantBalancesTotal)}</span></span>
            </div>
          )}
        </section>

        {/* ── Manual check ──────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h3 className="text-base font-bold text-on-surface tracking-tight font-headline">Manual Reconciliation Check</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
              Paste in the real balance from NCBA's own statement or online banking as an independent cross-check — useful
              regardless of whether the live pull above is available, and this is what gets logged to history below.
            </p>
          </div>
          {canSubmitCheck && (
            <form onSubmit={submitCheck} className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-6 p-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
              <div className="flex flex-col gap-1">
                <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Reported Balance (KES)</label>
                <input
                  type="number" step="0.01" min="0" required
                  value={reportedBalance}
                  onChange={(e) => setReportedBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-48 bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. checked via NCBA online banking"
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-on-surface text-surface-container-lowest text-2xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Recording…' : 'Record Check'}
              </button>
              {submitError && <p className="text-2xs text-red-600 mt-1 sm:ml-2">{submitError}</p>}
            </form>
          )}

          {canSubmitCheck && selectedIds.length > 0 && (
            <div className="flex items-center justify-between mb-3 px-4 py-2.5 rounded-lg bg-on-surface text-surface-container-lowest">
              <span className="text-2xs font-bold uppercase tracking-widest">{selectedIds.length} selected</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedIds([])} className="text-2xs font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity">
                  Deselect All
                </button>
                <button
                  onClick={() => setClearTarget('bulk')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-2xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">clear</span>
                  Clear Selected
                </button>
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg overflow-hidden">
            {historyLoading ? (
              <div className="p-8"><Skel className="w-full h-32" /></div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">No reconciliation checks recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-container/70 border-b border-outline-variant/40">
                    <tr className="text-2xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {canSubmitCheck && (
                        <th className="text-left pl-5 pr-2 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === history.length}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-outline-variant/60 accent-on-surface cursor-pointer"
                            aria-label="Select all"
                          />
                        </th>
                      )}
                      <th className="text-left px-5 py-3">Checked</th>
                      <th className="text-right px-3 py-3">Reported</th>
                      <th className="text-right px-3 py-3">Expected</th>
                      <th className="text-right px-3 py-3">Difference</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-left px-3 py-3">By</th>
                      <th className="text-left px-5 py-3">Note</th>
                      {canSubmitCheck && <th className="text-right px-5 py-3">Clear</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r._id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
                        {canSubmitCheck && (
                          <td className="pl-5 pr-2 py-3.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(r._id)}
                              onChange={() => toggleSelected(r._id)}
                              className="w-3.5 h-3.5 rounded border-outline-variant/60 accent-on-surface cursor-pointer"
                              aria-label={`Select check from ${fmtDateTime(r.createdAt)}`}
                            />
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-on-surface tabular-nums">{fmtDateTime(r.createdAt)}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-on-surface">{formatKES(r.reportedBalance)}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-on-surface-variant">{formatKES(r.expectedPoolBalance)}</td>
                        <td className={`px-3 py-3.5 text-right tabular-nums font-bold ${r.status === 'matched' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {r.difference > 0 ? '+' : ''}{formatKES(r.difference)}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-2xs font-bold uppercase tracking-wider ${
                            r.status === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'matched' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {r.status === 'matched' ? 'Matched' : 'Discrepancy'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-on-surface-variant">{r.checkedBy?.name || r.checkedBy?.email || '—'}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant">{r.note || '—'}</td>
                        {canSubmitCheck && (
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setClearTarget(r)}
                              title="Clear from this list — the real record is kept"
                              className="text-on-surface-variant/50 hover:text-red-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg">clear</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Clear reconciliation check(s) — confirmation */}
      {clearTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !clearBusy && setClearTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-7">
              <div className="w-14 h-14 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">clear</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-1">
                {clearTarget === 'bulk' ? `Clear ${selectedIds.length} reconciliation check${selectedIds.length === 1 ? '' : 's'}?` : 'Clear this reconciliation check?'}
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                {clearTarget === 'bulk'
                  ? 'Removes them from this list only — the real records are kept, and any discrepancy alerts already sent are unaffected. Nothing is deleted.'
                  : `Removes it from this list only — the real record (${fmtDateTime(clearTarget.createdAt)}, ${formatKES(clearTarget.reportedBalance)} reported) is kept, and any discrepancy alert already sent is unaffected. Nothing is deleted.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setClearTarget(null)} disabled={clearBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                <button onClick={confirmClear} disabled={clearBusy} className="flex-1 py-2.5 rounded-lg bg-on-surface text-surface-container-lowest text-sm font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50">
                  {clearBusy ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve a stuck payout — confirmation, since this can trigger a real refund */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !resolveBusy && setResolveTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-7">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${resolveTarget.succeeded ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                <span className="material-symbols-outlined text-3xl">{resolveTarget.succeeded ? 'check_circle' : 'cancel'}</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-1">
                Mark {resolveTarget.transaction.reference} as {resolveTarget.succeeded ? 'succeeded' : 'failed'}?
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                {resolveTarget.succeeded
                  ? `Confirms this ${formatKES(resolveTarget.transaction.kesAmount || resolveTarget.transaction.amount)} payout actually landed with the recipient — no refund is issued, the transaction closes as completed.`
                  : `Confirms this payout never landed — ${formatKES(resolveTarget.transaction.kesAmount || resolveTarget.transaction.amount)} (plus its fee) is refunded back to the merchant's balance immediately.`}
                {' '}Only do this after checking NCBA's own portal for this reference — this cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setResolveTarget(null)} disabled={resolveBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
                <button onClick={confirmResolveStuckPayout} disabled={resolveBusy} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-widest text-white disabled:opacity-50 ${resolveTarget.succeeded ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {resolveBusy ? 'Resolving…' : `Confirm ${resolveTarget.succeeded ? 'succeeded' : 'failed'}`}
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

export default PoolReconciliation;
