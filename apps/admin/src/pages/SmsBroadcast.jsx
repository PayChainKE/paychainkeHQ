import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 20;
const PAYCHAIN_PHONE = '+254 743 283 782';
const MAX_LEN = 918;

const CATEGORY_META = {
  maintenance: { label: 'Maintenance', icon: 'build', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  holiday:     { label: 'Holiday',     icon: 'celebration', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  security:    { label: 'Security',    icon: 'shield', color: 'bg-red-50 text-red-700 border-red-200' },
  general:     { label: 'General',     icon: 'campaign', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const TEMPLATES = [
  {
    category: 'maintenance',
    label: 'System Maintenance',
    body: `Dear Merchant, PayChain is currently undergoing scheduled maintenance and some services may be temporarily unavailable. We apologise for the inconvenience and are working to restore full service shortly. For urgent help, call ${PAYCHAIN_PHONE}. – Team PayChain`,
  },
  {
    category: 'holiday',
    label: 'Public Holiday Greeting',
    body: `Wishing you and your business a joyful holiday! Thank you for trusting PayChain to collect, pay, protect and grow with you all year round. Season's greetings from all of us at PayChain Kenya.`,
  },
  {
    category: 'security',
    label: 'Security Reminder',
    body: `Dear Merchant, protect your PayChain PIN and OTP — never share them with anyone, even someone claiming to call from PayChain. We will never ask for your PIN over a call or SMS. Noticed suspicious activity on your account? Call ${PAYCHAIN_PHONE} immediately. – Team PayChain`,
  },
  {
    category: 'general',
    label: 'Blank / Custom',
    body: '',
  },
];

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
function fmtDate(iso) { return iso ? new Date(iso).toLocaleString() : '—'; }

// SMS segment estimate: 160 chars for a single GSM-7 message, 153/segment
// once concatenated across multiple parts — the same math carriers use to
// decide how many parts (and how much) a long SMS actually costs.
function smsSegments(len) {
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

export default function SmsBroadcast() {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');

  const [audience, setAudience] = useState('all'); // 'all' | 'selected'
  const [merchants, setMerchants] = useState([]);
  const [merchantsLoading, setMerchantsLoading] = useState(true);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
  const [clearState, setClearState] = useState(null); // { mode: 'selected'|'all', busy, error } | null

  const [pendingSend, setPendingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); }, []);

  const fetchMerchants = useCallback(async () => {
    setMerchantsLoading(true);
    try {
      const res = await api.get('/api/admin/merchants');
      setMerchants(res.data?.data || []);
    } catch (e) {
      // Non-fatal — "All Merchants" audience still works without this list.
    } finally {
      setMerchantsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (p = 1) => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/sms-broadcasts', { params: { page: p, limit: PAGE_SIZE } });
      setHistory(res.data?.data || []);
      setTotal(res.data?.pagination?.total || 0);
      setPage(p);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load broadcast history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchMerchants(); fetchHistory(1); }, [fetchMerchants, fetchHistory]);

  const toggleHistorySelected = (id) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAllHistorySelected = () => {
    setSelectedHistoryIds((prev) => (prev.size === history.length ? new Set() : new Set(history.map((h) => h._id))));
  };

  async function confirmClearHistory() {
    if (!clearState) return;
    setClearState((s) => ({ ...s, busy: true, error: '' }));
    try {
      if (clearState.mode === 'selected') {
        const res = await api.post('/api/admin/sms-broadcasts/clear', { ids: Array.from(selectedHistoryIds) });
        showToast(res.data?.message || 'Removed.');
      } else {
        const res = await api.post('/api/admin/sms-broadcasts/clear', {});
        showToast(res.data?.message || 'History cleared.');
      }
      setSelectedHistoryIds(new Set());
      setClearState(null);
      fetchHistory(1);
    } catch (e) {
      setClearState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Could not clear history.' }));
    }
  }

  const merchantsWithPhone = useMemo(() => merchants.filter((m) => !!m.phone), [merchants]);
  const filteredMerchants = useMemo(() => {
    const q = merchantSearch.trim().toLowerCase();
    if (!q) return merchantsWithPhone;
    return merchantsWithPhone.filter((m) =>
      (m.businessName || '').toLowerCase().includes(q) ||
      (m.name || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  }, [merchantsWithPhone, merchantSearch]);

  const recipientCount = audience === 'all' ? merchantsWithPhone.length : selectedIds.size;

  const toggleMerchant = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyTemplate = (tpl) => {
    setCategory(tpl.category);
    setMessage(tpl.body);
  };

  const openConfirm = () => {
    setError('');
    if (message.trim().length < 5) { setError('Message is too short.'); return; }
    if (audience === 'selected' && selectedIds.size === 0) { setError('Select at least one merchant.'); return; }
    setPendingSend(true);
  };

  const confirmSend = async () => {
    setSending(true);
    setError('');
    try {
      const payload = {
        message: message.trim(),
        category,
        audience,
        merchantIds: audience === 'selected' ? Array.from(selectedIds) : undefined,
      };
      const res = await api.post('/api/admin/sms-broadcasts', payload);
      if (res.data?.success) {
        showToast(res.data.message || 'SMS sent.');
        setMessage('');
        setSelectedIds(new Set());
        fetchHistory(1);
      } else {
        setError(res.data?.error || 'Send failed.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Send failed.');
    } finally {
      setSending(false);
      setPendingSend(false);
    }
  };

  const segments = smsSegments(message.trim().length);

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Merchant Notifications</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">SMS Broadcast</h2>
            <p className="text-on-surface-variant/60 mt-1 text-xs md:text-sm font-body">Send a short SMS notice to merchants — maintenance notices, holiday wishes, security reminders.</p>
          </div>
        </div>

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-primary text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Compose */}
          <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 md:p-6 space-y-5">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-2xs font-bold transition-colors ${CATEGORY_META[tpl.category].color} hover:opacity-80`}
                  >
                    <span className="material-symbols-outlined text-sm">{CATEGORY_META[tpl.category].icon}</span>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">Message</p>
                <p className={`text-2xs font-bold tabular-nums ${message.length > MAX_LEN ? 'text-red-600' : 'text-on-surface-variant/40'}`}>
                  {message.length} / {MAX_LEN} · {segments} SMS
                </p>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                maxLength={MAX_LEN}
                placeholder="Write the notification merchants will receive..."
                className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none resize-none"
              />
            </div>

            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Audience</p>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setAudience('all')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    audience === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">groups</span>
                  All Merchants ({merchantsLoading ? '…' : merchantsWithPhone.length})
                </button>
                <button
                  onClick={() => setAudience('selected')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    audience === 'selected' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">person_check</span>
                  Select Specific ({selectedIds.size})
                </button>
              </div>

              {audience === 'selected' && (
                <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
                  <input
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    placeholder="Search merchants by name or phone..."
                    className="w-full px-4 py-2.5 text-xs font-medium border-b border-outline-variant/10 outline-none"
                  />
                  <div className="max-h-56 overflow-y-auto">
                    {merchantsLoading ? (
                      <p className="text-2xs text-on-surface-variant/40 px-4 py-6 text-center">Loading merchants…</p>
                    ) : filteredMerchants.length === 0 ? (
                      <p className="text-2xs text-on-surface-variant/40 px-4 py-6 text-center">No merchants match.</p>
                    ) : (
                      filteredMerchants.map((m) => (
                        <label key={m._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant/5 last:border-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(m._id)}
                            onChange={() => toggleMerchant(m._id)}
                            className="w-4 h-4 accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{m.businessName || m.name}</p>
                            <p className="text-2xs text-on-surface-variant/50">{m.phone}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">{error}</div>
            )}

            <button
              onClick={openConfirm}
              disabled={message.trim().length < 5 || sending}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-md hover:shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              Send to {recipientCount} Merchant{recipientCount === 1 ? '' : 's'}
            </button>
          </div>

          {/* History */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.size > 0 && selectedHistoryIds.size === history.length}
                    onChange={toggleAllHistorySelected}
                    className="w-4 h-4 accent-primary"
                    title="Select all on this page"
                  />
                )}
                <p className="text-sm font-bold text-on-surface">Broadcast History</p>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedHistoryIds.size > 0 && (
                  <button
                    onClick={() => setClearState({ mode: 'selected', busy: false, error: '' })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Delete {selectedHistoryIds.size}
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    onClick={() => setClearState({ mode: 'all', busy: false, error: '' })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-bold text-on-surface-variant/60 hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Clear history
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/5 max-h-[600px]">
              {historyLoading ? (
                <p className="text-2xs text-on-surface-variant/40 px-5 py-8 text-center">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-2xs text-on-surface-variant/40 px-5 py-8 text-center">No broadcasts sent yet.</p>
              ) : (
                history.map((h) => {
                  const meta = CATEGORY_META[h.category] || CATEGORY_META.general;
                  return (
                    <div key={h._id} className="px-5 py-3.5 flex gap-3 group">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.has(h._id)}
                        onChange={() => toggleHistorySelected(h._id)}
                        className="w-4 h-4 accent-primary mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>
                            <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                            {meta.label}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-on-surface-variant/40 font-bold" title={fmtDate(h.sentAt)}>{relativeTime(h.sentAt)}</span>
                            <button
                              onClick={() => { setSelectedHistoryIds(new Set([h._id])); setClearState({ mode: 'selected', busy: false, error: '' }); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Delete this entry"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-on-surface/80 line-clamp-2 mb-2">{h.message}</p>
                        <div className="flex items-center justify-between text-[10px] text-on-surface-variant/50 font-bold">
                          <span>{h.audience === 'all' ? 'All merchants' : `${h.merchantIds?.length || 0} selected`} · {h.recipientCount} recipient{h.recipientCount === 1 ? '' : 's'}</span>
                          <span className={h.status === 'sending' ? 'text-primary' : h.failureCount ? 'text-amber-600' : 'text-emerald-600'}>
                            {h.status === 'sending'
                              ? 'Sending…'
                              : `${h.successCount} sent${h.failureCount ? `, ${h.failureCount} failed` : ''}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={fetchHistory} />
          </div>
        </div>
      </div>

      {/* Send confirmation */}
      {pendingSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">sms</span>
              </div>
              <div>
                <p className="font-bold text-on-surface text-sm">Send this SMS?</p>
                <p className="text-2xs text-on-surface-variant/60">To {recipientCount} merchant{recipientCount === 1 ? '' : 's'} — real SMS cost applies.</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-3 mb-5 max-h-40 overflow-y-auto">
              <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{message}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingSend(false)}
                disabled={sending}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-bold hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={sending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear history confirmation */}
      {clearState && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">
              {clearState.mode === 'all' ? 'Clear entire history?' : `Delete ${selectedHistoryIds.size} ${selectedHistoryIds.size === 1 ? 'entry' : 'entries'}?`}
            </h3>
            <p className="text-sm text-on-surface-variant mb-5">
              {clearState.mode === 'all'
                ? 'Permanently removes every SMS broadcast history record. This does not un-send any SMS already delivered — only the history record.'
                : 'Permanently removes the selected broadcast history record(s). This does not un-send any SMS already delivered.'}
            </p>
            {clearState.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{clearState.error}</div>}
            <div className="flex gap-3">
              <button onClick={() => setClearState(null)} disabled={clearState.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
              <button onClick={confirmClearHistory} disabled={clearState.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
                {clearState.busy ? 'Removing…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
