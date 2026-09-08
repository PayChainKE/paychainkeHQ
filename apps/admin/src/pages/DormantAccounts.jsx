import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const MIN_LEN = 5;
const MAX_LEN = 918;
// Mirrors dormantAccountsController.js's own DEFAULT_SUBJECT/DEFAULT_MESSAGE
// exactly — this is just the pre-filled starting point in the editor, the
// backend applies its own defaults independently if a request ever omits
// them, so the two never need to be kept in sync at runtime, only in intent.
const DEFAULT_SUBJECT = 'We miss you at PayChain!';
const DEFAULT_MESSAGE = "Hi {{business}}, we miss you at PayChain! It's been {{days}} since we last saw you — sign in or take a payment anytime to keep your account active and earning. We're here if you need anything.";

// SMS segment estimate — same math as SmsBroadcast.jsx's own smsSegments.
function smsSegments(len) {
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

// Client-side mirror of dormantAccountsController.js's personalizeText —
// used only to render the Preview panel before sending; the real,
// authoritative substitution happens server-side per recipient at send time.
function personalizeText(text, businessName, daysDormant) {
  const biz = (businessName || '').trim() || 'there';
  const days = Number.isFinite(daysDormant) ? `${daysDormant} day${daysDormant === 1 ? '' : 's'}` : 'a while';
  return String(text).replace(/\{\{\s*business\s*\}\}/gi, biz).replace(/\{\{\s*days\s*\}\}/gi, days);
}

const SAMPLE_MERCHANT = { businessName: "Jane's Duka", daysDormant: 12 };

export default function DormantAccounts() {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'idle' | 'dormant'

  // 'all' here means "everyone currently visible after the tier/search
  // filters below" (not literally every idle+dormant merchant in the DB) —
  // so narrowing the list with tierFilter always narrows who gets messaged
  // too. confirmSend always resolves this to an explicit id list before
  // sending, which the backend re-verifies as still idle/dormant anyway.
  const [audience, setAudience] = useState('all'); // 'all' | 'selected'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [channels, setChannels] = useState({ email: true, sms: false });

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [showPreview, setShowPreview] = useState(false);
  const messageRef = useRef(null);

  const [pendingSend, setPendingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
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

  const tierCounts = useMemo(() => ({
    idle: merchants.filter((m) => m.tier === 'idle').length,
    dormant: merchants.filter((m) => m.tier === 'dormant').length,
  }), [merchants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merchants.filter((m) => {
      if (tierFilter !== 'all' && m.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        (m.businessName || '').toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q)
      );
    });
  }, [merchants, search, tierFilter]);

  const recipientCount = audience === 'all' ? filtered.length : selectedIds.size;
  const anyChannel = channels.email || channels.sms;
  const trimmedMessage = message.trim();

  // Whoever would actually receive this first — used purely so the Preview
  // panel shows a real target's business name/days-dormant instead of a
  // placeholder, whenever one is available. Falls back to a made-up sample
  // when the current filter/selection is empty so Preview never blanks out.
  const sampleTarget = useMemo(() => {
    if (audience === 'all') return filtered[0] || SAMPLE_MERCHANT;
    const firstSelected = merchants.find((m) => selectedIds.has(m._id));
    return firstSelected || SAMPLE_MERCHANT;
  }, [audience, filtered, merchants, selectedIds]);

  const previewSubject = personalizeText(subject.trim() || DEFAULT_SUBJECT, sampleTarget.businessName, sampleTarget.daysDormant);
  const previewMessage = personalizeText(trimmedMessage || DEFAULT_MESSAGE, sampleTarget.businessName, sampleTarget.daysDormant);

  const toggleMerchant = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const insertTag = (tag) => {
    const el = messageRef.current;
    if (!el) { setMessage((m) => `${m}${tag}`); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}${tag}${message.slice(end)}`;
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const openConfirm = () => {
    if (!anyChannel) { showToast('Pick at least one channel.'); return; }
    if (trimmedMessage.length < MIN_LEN) { showToast(`Message is too short (min ${MIN_LEN} characters).`); return; }
    if (audience === 'all' && filtered.length === 0) { showToast('No merchants match the current filter.'); return; }
    if (audience === 'selected' && selectedIds.size === 0) { showToast('Select at least one merchant.'); return; }
    setResult(null);
    setPendingSend(true);
  };

  const confirmSend = async () => {
    // Synchronous ref guard, not just the `sending` state — a state update
    // isn't guaranteed to have committed to the DOM (disabling the button)
    // before a near-simultaneous second click/Enter-key fires this again.
    // The backend's own atomic per-merchant claim is the real fix for a
    // duplicate send; this just avoids firing a redundant request at all.
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      // Always resolved to an explicit id list — "All" means "everyone
      // currently visible after the tier/search filters", not literally
      // every idle+dormant merchant on file, so narrowing the list on
      // screen always narrows who actually gets messaged.
      const targetIds = audience === 'all' ? filtered.map((m) => m._id) : Array.from(selectedIds);
      const payload = {
        audience: 'selected',
        merchantIds: targetIds,
        channels: [channels.email && 'email', channels.sms && 'sms'].filter(Boolean),
        subject: subject.trim() || DEFAULT_SUBJECT,
        message: trimmedMessage || DEFAULT_MESSAGE,
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
      sendingRef.current = false;
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
              Merchants who've gone quiet — idle (8–30 days) and dormant (30+ days, or never active) both included. Send a personalized reminder to bring them back.
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
                {loading ? 'Loading…' : `${merchants.length} merchant${merchants.length === 1 ? '' : 's'} (${tierCounts.idle} idle · ${tierCounts.dormant} dormant)`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAudience('all')}
                  className={`px-3 py-1.5 rounded-lg border text-2xs font-bold transition-colors ${
                    audience === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  All ({filtered.length})
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

            <div className="px-5 py-3 border-b border-outline-variant/10 flex items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 shrink-0">Show:</span>
              {[
                { key: 'all', label: `All (${merchants.length})` },
                { key: 'idle', label: `Idle (${tierCounts.idle})` },
                { key: 'dormant', label: `Dormant (${tierCounts.dormant})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTierFilter(t.key)}
                  className={`px-2.5 py-1 rounded-full border text-2xs font-bold transition-colors ${
                    tierFilter === t.key ? 'bg-on-surface text-white border-on-surface' : 'bg-white text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  {t.label}
                </button>
              ))}
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
                  {merchants.length === 0 ? 'No idle or dormant merchants right now — everyone has been active in the last 7 days.' : 'No merchants match this filter.'}
                </p>
              ) : (
                filtered.map((m) => {
                  const isDormant = m.tier === 'dormant';
                  const badgeCls = isDormant ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                  const badgeLabel = m.daysDormant == null ? 'Never active' : `${m.daysDormant}d ${isDormant ? 'dormant' : 'idle'}`;
                  return (
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
                      <span className={`text-2xs font-bold rounded-full px-2 py-0.5 shrink-0 border ${badgeCls}`}>
                        {badgeLabel}
                      </span>
                    </label>
                  );
                })
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

            {channels.email && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Email Subject</p>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder={DEFAULT_SUBJECT}
                  className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">Message</p>
                <p className={`text-2xs font-bold tabular-nums ${message.length > MAX_LEN ? 'text-red-600' : 'text-on-surface-variant/40'}`}>
                  {message.length} / {MAX_LEN}{channels.sms ? ` · ${smsSegments(trimmedMessage.length)} SMS` : ''}
                </p>
              </div>
              <textarea
                ref={messageRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={MAX_LEN}
                placeholder={DEFAULT_MESSAGE}
                className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none resize-none"
              />
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className="text-2xs text-on-surface-variant/40 font-bold">Insert:</span>
                <button type="button" onClick={() => insertTag('{{business}}')} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-2xs font-bold font-mono hover:bg-primary/20 transition-colors">{'{{business}}'}</button>
                <button type="button" onClick={() => insertTag('{{days}}')} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-2xs font-bold font-mono hover:bg-primary/20 transition-colors">{'{{days}}'}</button>
                <span className="text-2xs text-on-surface-variant/40">— resolved per merchant at send time.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-outline-variant/20 text-on-surface-variant text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-sm">{showPreview ? 'visibility_off' : 'visibility'}</span>
              {showPreview ? 'Hide preview' : 'Preview before sending'}
            </button>

            {showPreview && (
              <div className="space-y-3">
                <p className="text-2xs text-on-surface-variant/50">
                  Previewing as <strong className="text-on-surface">{sampleTarget.businessName || 'this merchant'}</strong>{sampleTarget === SAMPLE_MERCHANT ? ' (sample — no merchant selected yet)' : ''}.
                </p>
                {channels.email && (
                  <div className="border border-outline-variant/15 rounded-xl overflow-hidden">
                    <div className="bg-[#06201B] px-4 py-3">
                      <p className="text-2xs font-bold uppercase tracking-widest text-emerald-300/80 mb-0.5">Email preview</p>
                      <p className="text-white font-bold text-sm">{previewSubject}</p>
                    </div>
                    <div className="bg-white p-4 text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{previewMessage}</div>
                  </div>
                )}
                {channels.sms && (
                  <div className="border border-outline-variant/15 rounded-xl p-4">
                    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">SMS preview</p>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-900 whitespace-pre-wrap">{previewMessage}</div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={openConfirm}
              disabled={!anyChannel || recipientCount === 0 || sending || trimmedMessage.length > MAX_LEN}
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
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-3 mb-5 max-h-40 overflow-y-auto">
              <p className="text-2xs font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1.5">Preview — as {sampleTarget.businessName || 'this merchant'}</p>
              {channels.email && <p className="text-xs font-bold text-on-surface mb-1">{previewSubject}</p>}
              <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{previewMessage}</p>
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
