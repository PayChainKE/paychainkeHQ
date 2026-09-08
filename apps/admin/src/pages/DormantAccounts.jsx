import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

function relativeTime(iso) {
  if (!iso) return 'Never active';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return `${days}d ago`;
}

export default function DormantAccounts() {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [audience, setAudience] = useState('all'); // 'all' | 'selected'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [channels, setChannels] = useState({ email: true, sms: false });

  const [pendingSend, setPendingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { message } | null
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); }, []);

  const fetchDormant = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/dormant-accounts');
      setMerchants(res.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load dormant accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDormant(); }, [fetchDormant]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) =>
      (m.businessName || '').toLowerCase().includes(q) ||
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  }, [merchants, search]);

  const recipientCount = audience === 'all' ? merchants.length : selectedIds.size;
  const anyChannel = channels.email || channels.sms;

  const toggleMerchant = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openConfirm = () => {
    if (!anyChannel) { showToast('Pick at least one channel.'); return; }
    if (audience === 'selected' && selectedIds.size === 0) { showToast('Select at least one merchant.'); return; }
    setResult(null);
    setPendingSend(true);
  };

  const confirmSend = async () => {
    setSending(true);
    try {
      const payload = {
        audience,
        merchantIds: audience === 'selected' ? Array.from(selectedIds) : undefined,
        channels: [channels.email && 'email', channels.sms && 'sms'].filter(Boolean),
      };
      const res = await api.post('/api/admin/dormant-accounts/remind', payload);
      if (res.data?.success) {
        setResult({ message: res.data.message });
        setSelectedIds(new Set());
        fetchDormant();
      } else {
        showToast(res.data?.error || 'Send failed.');
      }
    } catch (e) {
      showToast(e?.response?.data?.error || 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Re-engagement</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">Dormant Accounts</h2>
            <p className="text-on-surface-variant/60 mt-1 text-xs md:text-sm font-body">
              Merchants with no sign-in or transaction in 30+ days. Send a personalized reminder to bring them back.
            </p>
          </div>
        </div>

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-primary text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recipients */}
          <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-on-surface">
                {loading ? 'Loading…' : `${merchants.length} dormant merchant${merchants.length === 1 ? '' : 's'}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAudience('all')}
                  className={`px-3 py-1.5 rounded-lg border text-2xs font-bold transition-colors ${
                    audience === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  All ({merchants.length})
                </button>
                <button
                  onClick={() => setAudience('selected')}
                  className={`px-3 py-1.5 rounded-lg border text-2xs font-bold transition-colors ${
                    audience === 'selected' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  Select ({selectedIds.size})
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-outline-variant/10">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by business name, contact, email or phone..."
                  className="w-full pl-9 pr-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-outline-variant/5">
              {loading ? (
                <p className="text-2xs text-on-surface-variant/40 px-5 py-8 text-center">Loading…</p>
              ) : error ? (
                <p className="text-xs text-red-600 px-5 py-8 text-center">{error}</p>
              ) : filtered.length === 0 ? (
                <p className="text-2xs text-on-surface-variant/40 px-5 py-10 text-center">
                  {merchants.length === 0 ? 'No dormant merchants right now — everyone has been active in the last 30 days.' : 'No merchants match your search.'}
                </p>
              ) : (
                filtered.map((m) => (
                  <label key={m._id} className={`flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low cursor-pointer ${audience !== 'selected' ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={audience !== 'selected'}
                      checked={audience === 'selected' ? selectedIds.has(m._id) : true}
                      onChange={() => toggleMerchant(m._id)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-on-surface truncate">{m.businessName || m.name || 'Unnamed merchant'}</p>
                      <p className="text-2xs text-on-surface-variant/50 truncate">
                        {m.email || 'no email'}{m.phone ? ` · ${m.phone}` : ' · no phone'}
                      </p>
                    </div>
                    <span className="text-2xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                      {m.daysDormant == null ? 'Never active' : `${m.daysDormant}d dormant`}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Compose / send */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 md:p-6 space-y-5">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Channels</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setChannels((c) => ({ ...c, email: !c.email }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    channels.email ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">mail</span>
                  Email
                </button>
                <button
                  onClick={() => setChannels((c) => ({ ...c, sms: !c.sms }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                    channels.sms ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">sms</span>
                  SMS
                </button>
              </div>
            </div>

            <div className="bg-surface-container-low/60 border border-outline-variant/10 rounded-xl p-4">
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Message preview</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Each merchant gets a message addressed to <strong>their own business</strong> — e.g. "Hi {'{'}Business Name{'}'}, we miss you at PayChain!" — not one generic blast. The exact copy is fixed (not editable here) so it always stays on-brand; only the audience and channel change.
              </p>
            </div>

            <button
              onClick={openConfirm}
              disabled={!anyChannel || recipientCount === 0 || sending}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-md hover:shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              Remind {recipientCount} Merchant{recipientCount === 1 ? '' : 's'}
            </button>

            {result && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-start gap-2">
                <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
                {result.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send confirmation */}
      {pendingSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">person_alert</span>
              </div>
              <div>
                <p className="font-bold text-on-surface text-sm">Send dormant reminder?</p>
                <p className="text-2xs text-on-surface-variant/60">
                  To {recipientCount} merchant{recipientCount === 1 ? '' : 's'} via {[channels.email && 'email', channels.sms && 'SMS'].filter(Boolean).join(' + ')}
                  {channels.sms ? ' — real SMS cost applies.' : '.'}
                </p>
              </div>
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
                onClick={async () => { await confirmSend(); setPendingSend(false); }}
                disabled={sending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
