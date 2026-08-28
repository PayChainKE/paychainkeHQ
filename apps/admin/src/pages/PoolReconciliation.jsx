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

  useEffect(() => { fetchExpected(); fetchLive(); fetchHistory(); fetchMerchantBalances(); }, [fetchExpected, fetchLive, fetchHistory, fetchMerchantBalances]);

  // Ledger-derived figures + history refresh instantly on any real-time
  // platform event (see context/AuthContext.jsx's SSE connection), plus a
  // 30s fallback poll — matches Revenue.jsx's live-refresh convention.
  useEffect(() => {
    const id = setInterval(() => { fetchExpected(true); fetchHistory(true); fetchMerchantBalances(true); }, 30_000);
    const onSync = () => { fetchExpected(true); fetchHistory(true); fetchMerchantBalances(true); };
    window.addEventListener('paychain:sync', onSync);
    return () => { clearInterval(id); window.removeEventListener('paychain:sync', onSync); };
  }, [fetchExpected, fetchHistory, fetchMerchantBalances]);

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
                      <th className="text-left px-5 py-3">Checked</th>
                      <th className="text-right px-3 py-3">Reported</th>
                      <th className="text-right px-3 py-3">Expected</th>
                      <th className="text-right px-3 py-3">Difference</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-left px-3 py-3">By</th>
                      <th className="text-left px-5 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r._id} className="border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container/70 transition-colors">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold max-w-sm">{toast}</div>
      )}
    </Layout>
  );
};

export default PoolReconciliation;
