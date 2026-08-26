import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';
import { formatKES } from '../utils/formatCurrency';

const PAGE_SIZE = 25;

const TYPE_META = {
  inbound:            { label: 'Inbound',          color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#10B981' },
  outbound:           { label: 'Outbound',         color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  bulk_pay:           { label: 'Bulk Pay',         color: 'bg-violet-50 text-violet-700 border-violet-200',     dot: '#8B5CF6' },
  settlement:         { label: 'Settlement',       color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: '#F59E0B' },
  fx_swap:            { label: 'FX Swap',          color: 'bg-pink-50 text-pink-700 border-pink-200',           dot: '#EC4899' },
  top_up:             { label: 'Top Up',           color: 'bg-teal-50 text-teal-700 border-teal-200',           dot: '#14B8A6' },
  withdrawal:         { label: 'Withdrawal',       color: 'bg-orange-50 text-orange-700 border-orange-200',     dot: '#F97316' },
  ncba_inbound:       { label: 'NCBA Inbound',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#10B981' },
  ncba_outbound:      { label: 'NCBA Outbound',    color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  mpesa_b2c:          { label: 'M-Pesa B2C',       color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  mpesa_b2b:          { label: 'M-Pesa B2B',       color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  ncba_mobile_b2w:    { label: 'Mobile B2W',       color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  ncba_lipa_na_mpesa: { label: 'Lipa na M-Pesa',   color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: '#3B82F6' },
  ncba_kplc:          { label: 'KPLC',             color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: '#F59E0B' },
  ncba_kplc_prepaid:  { label: 'KPLC Prepaid',     color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: '#F59E0B' },
  ncba_ncwsc:         { label: 'Nairobi Water',    color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: '#F59E0B' },
  other:              { label: 'Other',            color: 'bg-gray-50 text-gray-700 border-gray-200',           dot: '#6B7280' },
};

const STATUS_META = {
  completed: { label: 'Completed', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  verified:  { label: 'Verified',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending:   { label: 'Pending',   pill: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500 animate-pulse' },
  failed:    { label: 'Failed',    pill: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
};

const fmtKES = formatKES;
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtFullTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

// Bank cash-management-team style transaction search & forensic audit trail
// — distinct from Ledger (treasury overview/charts) and Audit Log (account
// security events): this is the tool for "a merchant/customer disputes a
// specific transaction" — find it across every merchant, then see every
// timestamped fact PayChain has around it in one place.
const TransactionAudit = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [activeId, setActiveId] = useState(null);

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchInput]);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (search.trim()) p.q = search.trim();
    if (type !== 'all') p.type = type;
    if (status !== 'all') p.status = status;
    if (from) p.from = new Date(`${from}T00:00:00`).toISOString();
    if (to) p.to = new Date(`${to}T23:59:59.999`).toISOString();
    return p;
  }, [page, search, type, status, from, to]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/transaction-audit', { params });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
      } else {
        setError(res.data?.error || 'Could not load transactions.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtersActive = !!search || type !== 'all' || status !== 'all' || !!from || !!to;
  function resetFilters() {
    setSearchInput(''); setSearch(''); setType('all'); setStatus('all'); setFrom(''); setTo('');
  }

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B0F1A] border border-[#1E2536] shadow-[0_30px_80px_-20px_rgba(6,10,20,0.8)] p-6 md:p-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px]"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-indigo-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
              <p className="text-2xs font-bold uppercase tracking-[0.3em] text-indigo-300">Transaction Audit · Dispute Resolution</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-tight">
              Every transaction, fully traceable
            </h2>
            <p className="text-xs md:text-sm text-indigo-100/60 mt-2 max-w-2xl font-body">
              Search any transaction across every PayChain merchant by reference, phone, account, or merchant name — then drill into the full audit trail: the STK Push attempt, SMS receipts, and status history behind it.
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-3 md:p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-lg">search</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Reference, phone, account, merchant name/email…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0">
            <option value="all">All types</option>
            {Object.entries(TYPE_META).filter(([k]) => k !== 'other').map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0">
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} max={to || undefined} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-2.5 py-2 text-on-surface focus:border-primary focus:ring-0" />
            <span className="text-2xs text-on-surface-variant/40 font-bold">to</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} min={from || undefined} className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-2.5 py-2 text-on-surface focus:border-primary focus:ring-0" />
          </div>
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
                  <Th>Type</Th>
                  <Th>Merchant</Th>
                  <Th>Counterparty</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan="8" className="px-3 py-3"><div className="h-5 bg-on-surface/5 rounded animate-pulse" /></td></tr>
                  ))
                ) : error ? (
                  <tr><td colSpan="8" className="py-10 text-center text-error text-sm">{error}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="8" className="py-10 text-center text-on-surface-variant/40 text-sm">No transactions match this search.</td></tr>
                ) : rows.map((t) => {
                  const tm = TYPE_META[t.type] || TYPE_META.other;
                  const sm = STATUS_META[t.status] || STATUS_META.pending;
                  return (
                    <tr key={t._id} onClick={() => setActiveId(t._id)} className="hover:bg-secondary-container/5 transition-colors cursor-pointer">
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className="font-mono text-2xs font-bold text-on-surface bg-surface-container-low px-2 py-1 rounded">
                          {t.reference?.length > 20 ? `${t.reference.slice(0, 16)}…` : t.reference || '—'}
                        </span>
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
                          <p className="font-bold text-on-surface tracking-tight truncate max-w-[160px]">{t.merchant.businessName}</p>
                        ) : <span className="text-on-surface-variant/40 italic">Deleted Merchant</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <p className="text-on-surface-variant/80 font-mono truncate max-w-[140px]">{t.sender?.id || t.recipient?.id || t.accountNumber || '—'}</p>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-right font-bold text-on-surface tabular-nums">
                        {t.currency === 'USDC' ? `${t.amount} USDC` : fmtKES(t.amount)}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 border-b border-outline-variant/5 text-right">
                        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      </div>

      {activeId && <AuditDrawer id={activeId} onClose={() => setActiveId(null)} />}
    </Layout>
  );
};

// ── Forensic detail drawer ──────────────────────────────────────────────
const AuditDrawer = ({ id, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/api/admin/transaction-audit/${id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) setData(res.data.data);
        else setError(res.data?.error || 'Could not load this transaction.');
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Could not load this transaction.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const txn = data?.transaction;
  const tm = txn ? (TYPE_META[txn.type] || TYPE_META.other) : null;
  const sm = txn ? (STATUS_META[txn.status] || STATUS_META.pending) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative ml-auto w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="bg-gradient-to-br from-[#0B0F1A] to-[#161B2C] p-6 text-white relative sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-indigo-300 mb-1">Transaction Audit</p>
          {txn ? (
            <>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border mb-3 ${tm.color}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm.dot }}></span>
                {tm.label}
              </span>
              <h3 className="text-2xl font-bold text-white tracking-tight mb-1 tabular-nums">
                {txn.currency === 'USDC' ? `${txn.amount} USDC` : fmtKES(txn.amount)}
              </h3>
              <p className="text-xs text-indigo-100/70 font-mono break-all">{txn.reference}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${sm.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                  {sm.label}
                </span>
              </div>
            </>
          ) : <div className="h-16" />}
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="text-error text-sm">{error}</p>
          ) : (
            <>
              <Section title="Transaction detail">
                <div className="grid grid-cols-2 gap-2">
                  <DetailPill label="Created" value={fmtFullTime(txn.createdAt)} />
                  <DetailPill label="Last updated" value={fmtFullTime(txn.updatedAt)} />
                  <DetailPill label="Currency" value={txn.currency || 'KES'} />
                  <DetailPill label="Account" value={txn.accountNumber || '—'} mono />
                  {txn.kesAmount > 0 && <DetailPill label="KES amount" value={fmtKES(txn.kesAmount)} mono />}
                  {txn.usdcAmount > 0 && <DetailPill label="USDC amount" value={`${txn.usdcAmount} USDC`} mono />}
                  {txn.settlementRail && <DetailPill label="Settlement rail" value={txn.settlementRail.toUpperCase()} />}
                  {txn.mobileNetwork && <DetailPill label="Mobile network" value={txn.mobileNetwork} />}
                  <DetailPill label="PayChain fee" value={fmtKES(txn.paychainFee)} mono />
                  <DetailPill label="Balance after" value={txn.balanceAfter != null ? fmtKES(txn.balanceAfter) : '—'} mono />
                </div>
              </Section>

              <Section title="Merchant">
                {data.merchant ? (
                  <div className="bg-indigo-50/40 border border-indigo-200/40 rounded-lg p-3">
                    <p className="font-bold text-on-surface text-sm">{data.merchant.businessName}</p>
                    <p className="text-2xs text-on-surface-variant/70">{data.merchant.email}</p>
                    {data.merchant.ncbaMerchantCode && <p className="text-2xs text-on-surface-variant/60 font-mono mt-0.5">Code: {data.merchant.ncbaMerchantCode}</p>}
                    {data.merchant.flagged && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-red-100 text-red-700">Flagged</span>}
                  </div>
                ) : (
                  // The merchant account was permanently deleted — this
                  // transaction record itself is intentionally kept
                  // forever (real settled money, still counted in every
                  // revenue/GMV figure), so this is expected, not a bug.
                  <div className="bg-surface-container-low/60 border border-outline-variant/10 rounded-lg p-3">
                    <p className="font-bold text-on-surface-variant/60 text-sm">Deleted Merchant</p>
                    <p className="text-2xs text-on-surface-variant/50">Account no longer exists — this transaction record is preserved.</p>
                  </div>
                )}
              </Section>

              {(txn.sender?.name || txn.sender?.id || txn.recipient?.name || txn.recipient?.id) && (
                <Section title="Counterparty">
                  {(txn.sender?.name || txn.sender?.id) && (
                    <div className="bg-surface-container-low/60 rounded-lg p-3 mb-2">
                      <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Sender</p>
                      <p className="text-xs font-bold text-on-surface">{txn.sender.name || '—'}</p>
                      {txn.sender.id && <p className="text-2xs text-on-surface-variant/60 font-mono">{txn.sender.id}</p>}
                    </div>
                  )}
                  {(txn.recipient?.name || txn.recipient?.id) && (
                    <div className="bg-surface-container-low/60 rounded-lg p-3">
                      <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Recipient</p>
                      <p className="text-xs font-bold text-on-surface">{txn.recipient.name || '—'}</p>
                      {txn.recipient.id && <p className="text-2xs text-on-surface-variant/60 font-mono">{txn.recipient.id}</p>}
                    </div>
                  )}
                </Section>
              )}

              {data.relatedStkRequests?.length > 0 && (
                <Section title="Related STK Push attempt (correlated by merchant + amount + time)">
                  {data.relatedStkRequests.map((s) => {
                    const ssm = STATUS_META[s.status === 'success' ? 'completed' : s.status] || STATUS_META.pending;
                    return (
                      <div key={s._id} className="bg-surface-container-low/60 rounded-lg p-3 mb-2 last:mb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-on-surface font-mono">{s.checkoutRequestId}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-bold uppercase border ${ssm.pill}`}>{s.status}</span>
                        </div>
                        <p className="text-2xs text-on-surface-variant/70">{s.phone || 'unknown phone'} · {formatKES(s.amount)} · {s.kind}{s.channel === 'qr' ? ' (QR)' : ''}</p>
                        {s.resultDesc && <p className="text-2xs text-on-surface-variant/50 mt-1 italic">{s.resultDesc}</p>}
                      </div>
                    );
                  })}
                </Section>
              )}

              {data.relatedSms?.length > 0 && (
                <Section title="Related SMS delivery (correlated by phone + time)">
                  {data.relatedSms.map((s) => (
                    <div key={s._id} className="flex items-center justify-between bg-surface-container-low/60 rounded-lg p-3 mb-2 last:mb-0">
                      <div>
                        <p className="text-xs font-bold text-on-surface font-mono">{s.to}</p>
                        {s.failureReason && <p className="text-2xs text-error mt-0.5">{s.failureReason}</p>}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${
                        s.deliveryStatus === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                        s.deliveryStatus === 'failed' || s.deliveryStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{s.deliveryStatus}</span>
                    </div>
                  ))}
                </Section>
              )}

              {data.timeline?.length > 0 && (
                <Section title="Timeline">
                  <div className="space-y-0">
                    {data.timeline.map((ev, i) => (
                      <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                        {i < data.timeline.length - 1 && <div className="absolute left-[5px] top-3 bottom-0 w-px bg-outline-variant/20" />}
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 shrink-0 relative z-10" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface">{ev.label}</p>
                          <p className="text-2xs text-on-surface-variant/60">{ev.detail}</p>
                          <p className="text-2xs text-on-surface-variant/40 mt-0.5">{fmtFullTime(ev.at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">{title}</p>
    <div>{children}</div>
  </div>
);

const DetailPill = ({ label, value, mono }) => (
  <div className="bg-surface-container-low/60 px-3 py-2 rounded-lg">
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{label}</p>
    <p className={`text-xs font-bold text-on-surface tracking-tight break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

export default TransactionAudit;
