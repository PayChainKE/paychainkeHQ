import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// ── Constants ─────────────────────────────────────────────────────────
const RANGES = [
  { v: '24h', l: '24H' },
  { v: '7d',  l: '7D' },
  { v: '30d', l: '30D' },
  { v: 'all', l: 'ALL' },
];

const CHANNELS = [
  { id: 'all',       label: 'All channels', icon: 'inbox' },
  { id: 'call',      label: 'Calls',        icon: 'call' },
  { id: 'sms',       label: 'SMS',          icon: 'sms' },
  { id: 'whatsapp',  label: 'WhatsApp',     icon: 'chat' },
  { id: 'voicemail', label: 'Voicemail',    icon: 'voicemail' },
];

const CHANNEL_META = {
  call:      { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'call',      hue: '#10B981' },
  sms:       { color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: 'sms',       hue: '#3B82F6' },
  whatsapp:  { color: 'bg-green-50 text-green-700 border-green-200',       icon: 'chat',      hue: '#22C55E' },
  voicemail: { color: 'bg-violet-50 text-violet-700 border-violet-200',    icon: 'voicemail', hue: '#8B5CF6' },
};

const STATUS_META = {
  new:         { label: 'New',         pill: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500 animate-pulse' },
  in_progress: { label: 'In Progress', pill: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  resolved:    { label: 'Resolved',    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  missed:      { label: 'Missed',      pill: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  spam:        { label: 'Spam',        pill: 'bg-gray-100 text-gray-700 border-gray-200',         dot: 'bg-gray-500' },
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtFullTime = (iso) => iso ? new Date(iso).toLocaleString() : '—';

const fmtDuration = (s) => {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const fmtPhone = (raw) => {
  if (!raw) return '—';
  const s = String(raw).replace(/\s/g, '');
  if (s.startsWith('+254') && s.length === 13) return `+254 ${s.slice(4, 7)} ${s.slice(7, 10)} ${s.slice(10)}`;
  return s;
};

const CallCentre = () => {
  const [range, setRange] = useState('7d');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/communications', {
        params: { range, channel, status, q: search, page, limit: 30 },
      });
      if (res.data?.success) {
        setData(res.data.data);
        setRefreshedAt(new Date());
      } else setError(res.data?.error || 'Could not load communications.');
    } catch (e) {
      const code = e?.response?.status;
      setError(
        e?.response?.data?.error ||
        (code === 404 ? 'Call-centre endpoint not deployed yet. Push backend changes and retry.' : 'Could not load communications.')
      );
    } finally { setLoading(false); }
  }, [range, channel, status, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchData]);

  // Debounce search
  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(searchInput); }, 350);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchInput]);

  // ESC closes detail panel on small screens
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const selected = useMemo(() => data?.items?.find((x) => x._id === selectedId) || null, [data, selectedId]);

  async function updateStatus(id, newStatus) {
    setUpdating(true);
    try {
      const res = await api.patch(`/api/admin/communications/${id}`, { status: newStatus });
      if (res.data?.success) {
        setData((prev) => prev ? { ...prev, items: prev.items.map((i) => i._id === id ? { ...i, ...res.data.data } : i) } : prev);
      }
    } catch { /* noop */ } finally { setUpdating(false); }
  }
  async function togglePriority(id, priority) {
    setUpdating(true);
    try {
      const res = await api.patch(`/api/admin/communications/${id}`, { priority: !priority });
      if (res.data?.success) {
        setData((prev) => prev ? { ...prev, items: prev.items.map((i) => i._id === id ? { ...i, ...res.data.data } : i) } : prev);
      }
    } catch { /* noop */ } finally { setUpdating(false); }
  }
  async function addNote(id) {
    const body = noteText.trim();
    if (!body) return;
    setUpdating(true);
    try {
      const res = await api.post(`/api/admin/communications/${id}/notes`, { body });
      if (res.data?.success) {
        setData((prev) => prev ? { ...prev, items: prev.items.map((i) => i._id === id ? { ...i, ...res.data.data } : i) } : prev);
        setNoteText('');
      }
    } catch { /* noop */ } finally { setUpdating(false); }
  }
  async function removeRecord(id) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setUpdating(true);
    try {
      const res = await api.delete(`/api/admin/communications/${id}`);
      if (res.data?.success) {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((i) => i._id !== id) } : prev);
        setSelectedId(null);
      }
    } catch { /* noop */ } finally { setUpdating(false); }
  }

  const channelCount = (id) => data?.channelMix?.find((m) => m.channel === id)?.count || 0;
  const filtersActive = channel !== 'all' || status !== 'all' || !!search;

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-6 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-emerald-400/10 rounded-full blur-2xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">Communications Hub · Live</p>
              </div>
              <h1 className="text-[32px] md:text-[40px] font-bold text-white tracking-tighter font-headline leading-none">
                Call Centre
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-[13px] md:text-[14px]">
                Every call, SMS, WhatsApp and voicemail received on the PayChain hotline — triaged, attributed to merchants, and resolved in one console.
              </p>
              {refreshedAt && (
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/60 mt-3">
                  Last refresh · {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-1 bg-emerald-900/40 rounded-xl border border-emerald-800/40 backdrop-blur-sm">
                {RANGES.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => { setRange(r.v); setPage(1); }}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                      range === r.v ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-200/60 hover:text-white'
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-[11px] font-bold rounded-xl uppercase tracking-widest transition-all disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon="inbox"     label="In Range"        value={data.kpis.totalRange.toLocaleString()} />
            <Kpi icon="today"     label="Today"           value={data.kpis.totalToday.toLocaleString()}  tone="primary" />
            <Kpi icon="schedule"  label="Last 24h"        value={data.kpis.total24h.toLocaleString()}    tone="emerald" pulse />
            <Kpi icon="call_end"  label="Missed Calls"    value={data.kpis.missed.toLocaleString()}      tone="red" />
            <Kpi icon="task_alt"  label="Resolution Rate" value={`${data.kpis.resolutionRate}%`}         tone="emerald" />
            <Kpi icon="timer"     label="Avg Call Time"   value={fmtDuration(data.kpis.avgDurationSec)} />
          </div>
        )}

        {/* Channel filter strip */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { setChannel(ch.id); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-all ${
                    channel === ch.id
                      ? 'bg-primary text-white border-primary shadow'
                      : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{ch.icon}</span>
                  {ch.label}
                  {ch.id !== 'all' && (
                    <span className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded ${channel === ch.id ? 'bg-white/20' : 'bg-surface-container'}`}>
                      {channelCount(ch.id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">search</span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by phone, caller, or message body…"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-[13px]"
                />
              </div>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-[12px] font-bold uppercase tracking-widest bg-white">
                <option value="all">All status</option>
                {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
              {filtersActive && (
                <button onClick={() => { setChannel('all'); setStatus('all'); setSearchInput(''); setSearch(''); setPage(1); }} className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={fetchData} />
        ) : data && data.items.length === 0 ? (
          <EmptyState filtersActive={filtersActive} onClear={() => { setChannel('all'); setStatus('all'); setSearchInput(''); setSearch(''); setPage(1); }} />
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Conversation list */}
            <div className={`${selected ? 'lg:col-span-5' : 'lg:col-span-12'} bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden`}>
              <div className="px-5 py-3 border-b border-outline-variant/10 bg-white flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Inbox</p>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">
                    {data.pagination.total.toLocaleString()} record{data.pagination.total === 1 ? '' : 's'}
                  </h3>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Page {data.pagination.page}/{data.pagination.totalPages}
                </div>
              </div>
              <div className="divide-y divide-outline-variant/10 max-h-[640px] overflow-y-auto custom-scrollbar">
                {data.items.map((item) => (
                  <InboxRow
                    key={item._id}
                    item={item}
                    selected={selectedId === item._id}
                    onClick={() => setSelectedId(item._id)}
                  />
                ))}
              </div>
              {data.pagination.totalPages > 1 && (
                <div className="px-5 py-3 bg-surface flex items-center justify-between border-t border-outline-variant/10">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg hover:bg-surface-container-low text-[11px] font-bold uppercase tracking-widest disabled:opacity-30">
                    ← Prev
                  </button>
                  <span className="text-[12px] text-on-surface-variant/60">
                    {data.pagination.page} of {data.pagination.totalPages}
                  </span>
                  <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages} className="px-3 py-1.5 rounded-lg hover:bg-surface-container-low text-[11px] font-bold uppercase tracking-widest disabled:opacity-30">
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <DetailPanel
                item={selected}
                onClose={() => setSelectedId(null)}
                onStatus={(s) => updateStatus(selected._id, s)}
                onPriority={() => togglePriority(selected._id, selected.priority)}
                onDelete={() => removeRecord(selected._id)}
                noteText={noteText}
                onNoteText={setNoteText}
                onAddNote={() => addNote(selected._id)}
                busy={updating}
              />
            )}
          </div>
        ) : null}

        {/* Channel integration banner */}
        <IntegrationBanner />
      </div>
    </Layout>
  );
};

// ── Inbox row ────────────────────────────────────────────────────────
const InboxRow = ({ item, selected, onClick }) => {
  const cm = CHANNEL_META[item.channel];
  const sm = STATUS_META[item.status] || STATUS_META.new;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-3 transition-colors flex items-start gap-3 ${
        selected ? 'bg-emerald-50/70 border-l-4 border-l-emerald-500' : 'hover:bg-surface-container-low/50 border-l-4 border-l-transparent'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cm.hue }}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cm.icon}</span>
        </div>
        {item.status === 'new' && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-on-surface text-[13px] tracking-tight truncate">
            {item.callerName || item.merchant?.businessName || fmtPhone(item.fromNumber)}
          </p>
          <span className="text-[10px] text-on-surface-variant/50 flex-shrink-0">{fmtTime(item.occurredAt)}</span>
        </div>
        <p className="text-[11px] text-on-surface-variant/60 font-mono truncate">{fmtPhone(item.fromNumber)}</p>
        {item.body && <p className="text-[12px] text-on-surface-variant/80 line-clamp-2 mt-1">{item.body}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${sm.pill}`}>
            <span className={`w-1 h-1 rounded-full ${sm.dot}`}></span>
            {sm.label}
          </span>
          {item.channel === 'call' && item.durationSec > 0 && (
            <span className="text-[10px] text-on-surface-variant/50 font-bold">{fmtDuration(item.durationSec)}</span>
          )}
          {item.priority && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
              Priority
            </span>
          )}
          {item.merchant && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
              <span className="material-symbols-outlined text-[12px]">storefront</span>
              {item.merchant.businessName}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// ── Detail panel ─────────────────────────────────────────────────────
const DetailPanel = ({ item, onClose, onStatus, onPriority, onDelete, noteText, onNoteText, onAddNote, busy }) => {
  const cm = CHANNEL_META[item.channel];
  const sm = STATUS_META[item.status] || STATUS_META.new;
  return (
    <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="p-5 border-b border-outline-variant/10 bg-gradient-to-br from-white to-emerald-50/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cm.hue }}>
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cm.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{item.channel.toUpperCase()} · {item.direction === 'inbound' ? 'Incoming' : 'Outgoing'}</p>
              <h3 className="text-lg font-bold text-on-surface tracking-tight">
                {item.callerName || item.merchant?.businessName || fmtPhone(item.fromNumber)}
              </h3>
              <p className="text-[11px] text-on-surface-variant/60 font-mono">{fmtPhone(item.fromNumber)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant/40 hover:text-on-surface p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${sm.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
            {sm.label}
          </span>
          <button onClick={onPriority} disabled={busy} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
            item.priority ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-on-surface-variant/60 border-outline-variant/30 hover:border-amber-300'
          }`}>
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: item.priority ? "'FILL' 1" : "'FILL' 0" }}>flag</span>
            {item.priority ? 'Priority' : 'Mark priority'}
          </button>
          <span className="ml-auto text-[10px] text-on-surface-variant/50">{fmtFullTime(item.occurredAt)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
        {/* Merchant attribution */}
        {item.merchant && (
          <div className="bg-emerald-50/40 border border-emerald-200/40 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">storefront</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 mb-0.5">Matched Merchant</p>
              <p className="font-bold text-on-surface text-[14px] truncate">{item.merchant.businessName}</p>
              {item.merchant.paybillAccount && <p className="text-[11px] text-on-surface-variant/60 font-mono">Paybill #{item.merchant.paybillAccount}</p>}
            </div>
            {item.merchant.flagged && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-[12px]">flag</span>
                Flagged
              </span>
            )}
          </div>
        )}

        {/* Call-specific: recording + duration */}
        {item.channel === 'call' && (
          <Section title="Call details">
            <div className="grid grid-cols-2 gap-3">
              <DetailPill label="Duration" value={fmtDuration(item.durationSec)} />
              <DetailPill label="Direction" value={item.direction === 'inbound' ? 'Incoming' : 'Outgoing'} />
              {item.provider && <DetailPill label="Provider" value={item.provider} />}
              {item.toNumber && <DetailPill label="To" value={fmtPhone(item.toNumber)} mono />}
            </div>
            {item.recordingUrl && (
              <div className="mt-3 p-3 bg-surface-container-low rounded-lg">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-2">Recording</p>
                <audio controls src={item.recordingUrl} className="w-full h-9"></audio>
              </div>
            )}
          </Section>
        )}

        {/* Message body for SMS/WhatsApp/voicemail transcript */}
        {item.body && (
          <Section title={item.channel === 'voicemail' ? 'Voicemail transcript' : 'Message'}>
            <div className="p-4 bg-white border border-outline-variant/20 rounded-xl text-[13px] text-on-surface whitespace-pre-wrap leading-relaxed">
              {item.body}
            </div>
            {item.attachments && item.attachments.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {item.attachments.map((a, i) => (
                  <a key={i} href={a} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-low rounded-lg text-[11px] font-bold text-primary hover:underline">
                    <span className="material-symbols-outlined text-[14px]">attach_file</span>
                    Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Status updater */}
        <Section title="Update status">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_META).map(([v, m]) => (
              <button
                key={v}
                onClick={() => onStatus(v)}
                disabled={busy || item.status === v}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  item.status === v
                    ? `${m.pill} ring-2 ring-offset-1 ring-emerald-300`
                    : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`}></span>
                {m.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Internal notes */}
        <Section title={`Internal notes (${item.notes?.length || 0})`}>
          <div className="space-y-2 mb-3">
            {(item.notes || []).map((n, i) => (
              <div key={i} className="p-3 bg-surface-container-low rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{n.authorEmail || 'admin'}</span>
                  <span className="text-[10px] text-on-surface-variant/40">{fmtFullTime(n.createdAt)}</span>
                </div>
                <p className="text-[12px] text-on-surface whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
            {(!item.notes || item.notes.length === 0) && (
              <p className="text-[11px] text-on-surface-variant/40 italic">No internal notes yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => onNoteText(e.target.value)}
              placeholder="Add an internal note (visible to team only)…"
              rows={2}
              maxLength={2000}
              className="flex-1 px-3 py-2 border border-outline-variant/30 rounded-lg text-[13px] focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none"
            />
            <button onClick={onAddNote} disabled={busy || !noteText.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all">
              Add
            </button>
          </div>
        </Section>

        {/* Danger zone */}
        <div className="pt-4 border-t border-outline-variant/10">
          <button onClick={onDelete} disabled={busy} className="text-[11px] font-bold uppercase tracking-widest text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50">
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Delete record
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">{title}</p>
    {children}
  </div>
);

const DetailPill = ({ label, value, mono }) => (
  <div className="bg-surface-container-low rounded-lg px-3 py-2">
    <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{label}</p>
    <p className={`text-[13px] font-bold text-on-surface tracking-tight ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

// ── KPI tile ─────────────────────────────────────────────────────────
const Kpi = ({ icon, label, value, tone, pulse }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
    amber:   'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || 'bg-surface-container text-on-surface-variant/70'}`}>
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-on-surface tracking-tighter tabular-nums">{value}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
      </div>
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────────────
const EmptyState = ({ filtersActive, onClear }) => (
  <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-16 text-center shadow-editorial">
    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
      <span className="material-symbols-outlined text-3xl">forum</span>
    </div>
    <h3 className="text-lg font-bold text-on-surface mb-1">
      {filtersActive ? 'No records match this view' : 'Inbox is clear'}
    </h3>
    <p className="text-[13px] text-on-surface-variant/60 max-w-md mx-auto mb-4">
      {filtersActive
        ? 'Try widening the date range, switching channel, or clearing your filters.'
        : 'When merchants call, SMS or WhatsApp the PayChain hotline, every interaction will be logged here for triage.'}
    </p>
    {filtersActive && (
      <button onClick={onClear} className="px-4 py-2 bg-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-lg">
        Clear filters
      </button>
    )}
  </div>
);

// ── Integration banner ───────────────────────────────────────────────
const IntegrationBanner = () => (
  <div className="rounded-2xl border border-outline-variant/20 p-5 bg-gradient-to-br from-white to-emerald-50/30 shadow-editorial">
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">Channel integration</p>
        <h3 className="text-base font-bold text-on-surface tracking-tight mb-1">Connect your telephony provider</h3>
        <p className="text-[13px] text-on-surface-variant/70 mb-3 max-w-2xl">
          Records show up here automatically once a provider webhook is wired. PayChain supports Africa's Talking, Twilio, and Safaricom Daraja by posting to <code className="font-mono text-[12px] bg-surface-container-low px-1.5 py-0.5 rounded">/api/webhooks/communications</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-outline-variant/30 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Africa's Talking · Not connected
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-outline-variant/30 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Twilio · Not connected
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-outline-variant/30 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Safaricom Daraja · Not connected
          </span>
        </div>
      </div>
    </div>
  </div>
);

const LoadingState = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <div className="lg:col-span-12 h-96 bg-surface-container-low rounded-2xl animate-pulse"></div>
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
      <span className="material-symbols-outlined text-3xl">error</span>
    </div>
    <h3 className="text-lg font-bold text-red-900 mb-1">Call centre unavailable</h3>
    <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{error}</p>
    <button onClick={onRetry} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg">
      Retry
    </button>
  </div>
);

export default CallCentre;
