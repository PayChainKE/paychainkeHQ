import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString() : '—'; }
function relativeTime(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function EmailLog() {
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  const [detail, setDetail] = useState(null); // { loading, error, data } | null

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [clearState, setClearState] = useState(null); // { mode: 'selected'|'all', busy, error } | null
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); }, []);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: p, limit: PAGE_SIZE };
      if (search.trim()) params.q = search.trim();
      if (type !== 'all') params.type = type;
      if (status !== 'all') params.status = status;
      const res = await api.get('/api/admin/email-log', { params });
      setRows(res.data?.data || []);
      setTypes(res.data?.types || {});
      setTotal(res.data?.pagination?.total || 0);
      setPage(p);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load the email log.');
    } finally {
      setLoading(false);
    }
  }, [search, type, status]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);
  useEffect(() => { setSelectedIds(new Set()); }, [rows]);

  const typeOptions = useMemo(() => Object.entries(types), [types]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAllSelected = () => {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r._id))));
  };

  async function confirmClear() {
    if (!clearState) return;
    setClearState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.post('/api/admin/email-log/clear', clearState.mode === 'selected' ? { ids: Array.from(selectedIds) } : {});
      showToast(res.data?.message || 'Removed.');
      setSelectedIds(new Set());
      setClearState(null);
      fetchLogs(1);
    } catch (e) {
      setClearState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Could not clear the email log.' }));
    }
  }

  async function openDetail(row) {
    setDetail({ loading: true, error: '', data: null });
    try {
      const res = await api.get(`/api/admin/email-log/${row._id}`);
      setDetail({ loading: false, error: '', data: res.data?.data });
    } catch (e) {
      setDetail({ loading: false, error: e?.response?.data?.error || 'Could not load this email.', data: null });
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Communications</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">Email Log</h2>
            <p className="text-on-surface-variant/60 mt-1 text-xs md:text-sm font-body">
              Every email PayChain has sent a merchant — KYC outcomes, security alerts, receipts, dormancy nudges. Open any row to see exactly what they were told, for follow-up context.
            </p>
          </div>
        </div>

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-primary text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
            {toast}
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-editorial">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by recipient email or subject..."
                className="w-full pl-9 pr-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              />
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white outline-none focus:border-primary"
            >
              <option value="all">All Types</option>
              {typeOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white outline-none focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <p className="text-2xs text-on-surface-variant/50 mt-2">
            {loading ? 'Loading…' : `${total.toLocaleString()} email${total === 1 ? '' : 's'} logged`}
          </p>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          {!loading && !error && rows.length > 0 && (
            <div className="px-4 py-2.5 border-b border-outline-variant/10 flex items-center justify-between gap-2 bg-surface-container-low/30">
              <label className="flex items-center gap-2 text-2xs font-bold text-on-surface-variant/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === rows.length}
                  onChange={toggleAllSelected}
                  className="w-4 h-4 accent-primary"
                />
                Select all on this page
              </label>
              <div className="flex items-center gap-1.5">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setClearState({ mode: 'selected', busy: false, error: '' })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Delete {selectedIds.size}
                  </button>
                )}
                <button
                  onClick={() => setClearState({ mode: 'all', busy: false, error: '' })}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-bold text-on-surface-variant/60 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Clear log
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-surface-container animate-pulse rounded" />)}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse font-body">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <Th></Th>
                    <Th>Recipient</Th>
                    <Th>Type</Th>
                    <Th>Subject</Th>
                    <Th>Status</Th>
                    <Th>Sent</Th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {rows.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => openDetail(r)}
                      className="hover:bg-secondary-container/5 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 border-b border-outline-variant/5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r._id)}
                          onChange={() => toggleSelected(r._id)}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <p className="font-bold text-on-surface tracking-tight">{r.merchantId?.businessName || r.merchantId?.name || '—'}</p>
                        <p className="text-2xs text-on-surface-variant/50">{r.to}</p>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border bg-primary/5 text-primary border-primary/20">
                          {types[r.type] || r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5 max-w-xs">
                        <p className="text-on-surface truncate">{r.subject}</p>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold border uppercase tracking-widest ${
                          r.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5 text-on-surface-variant/60 text-2xs" title={fmtDate(r.sentAt)}>
                        {relativeTime(r.sentAt)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant/40">
                        No emails match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={fetchLogs} />
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {detail.loading ? (
              <div className="p-10 text-center text-on-surface-variant/40 text-sm">Loading…</div>
            ) : detail.error ? (
              <div className="p-10 text-center text-red-600 text-sm">{detail.error}</div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-outline-variant/10 flex items-start justify-between gap-4 shrink-0">
                  <div className="min-w-0">
                    <p className="text-2xs font-bold uppercase tracking-widest text-primary mb-1">
                      {types[detail.data.type] || detail.data.type}
                    </p>
                    <h3 className="text-base font-bold text-on-surface tracking-tight truncate">{detail.data.subject}</h3>
                    <p className="text-2xs text-on-surface-variant/50 mt-1">
                      To <strong className="text-on-surface-variant">{detail.data.to}</strong>
                      {detail.data.merchantId?.businessName && <> · {detail.data.merchantId.businessName}</>}
                      {' · '}{fmtDate(detail.data.sentAt)}
                    </p>
                  </div>
                  <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/60 shrink-0">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                {detail.data.status === 'failed' && (
                  <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold shrink-0">
                    Send failed{detail.data.error ? `: ${detail.data.error}` : '.'}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="max-w-[560px] mx-auto bg-[#f4f4f4] rounded-2xl p-4">
                    <div
                      className="bg-white rounded-xl shadow-sm overflow-hidden text-sm"
                      dangerouslySetInnerHTML={{ __html: detail.data.bodyHtml }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clear log confirmation */}
      {clearState && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">
              {clearState.mode === 'all' ? 'Clear entire email log?' : `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}?`}
            </h3>
            <p className="text-sm text-on-surface-variant mb-5">
              {clearState.mode === 'all'
                ? 'Permanently removes every logged email record. This does not un-send any email already delivered — only the log record.'
                : 'Permanently removes the selected email log record(s). This does not un-send any email already delivered.'}
            </p>
            {clearState.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{clearState.error}</div>}
            <div className="flex gap-3">
              <button onClick={() => setClearState(null)} disabled={clearState.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
              <button onClick={confirmClear} disabled={clearState.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
                {clearState.busy ? 'Removing…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const Th = ({ children }) => (
  <th className="px-4 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
);
