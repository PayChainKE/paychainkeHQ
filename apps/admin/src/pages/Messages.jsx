import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 20;

// ── Constants ─────────────────────────────────────────────────────────
const STATUS_META = {
  open:        { label: 'Open',        pill: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', pill: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
  resolved:    { label: 'Resolved',    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  closed:      { label: 'Closed',      pill: 'bg-gray-100 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
};
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const TYPE_META = {
  merchant:    { label: 'Merchant',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  investor:    { label: 'Investor',    color: 'bg-violet-50 text-violet-700 border-violet-200' },
  partnership: { label: 'Partnership', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  press:       { label: 'Press',       color: 'bg-pink-50 text-pink-700 border-pink-200' },
  developer:   { label: 'Developer',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  careers:     { label: 'Careers',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  other:       { label: 'Other',       color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

const FILTER_TABS = [
  { v: 'all',      label: 'All' },
  { v: 'unread',   label: 'Unread' },
  { v: 'priority', label: 'Flagged' },
  { v: 'open',     label: 'Open' },
  { v: 'in_progress', label: 'In Progress' },
  { v: 'resolved', label: 'Resolved' },
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
function initials(name) {
  if (!name) return 'M';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Composer
  const [replyDraft, setReplyDraft] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState('');
  const replyRef = useRef(null);

  // Confirm-delete modal
  const [deleteState, setDeleteState] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/contact');
      const list = Array.isArray(res.data) ? res.data : [];
      setMessages(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0]._id);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load inbox.');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { fetchMessages(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = () => fetchMessages();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchMessages]);

  // Derived stats
  const stats = useMemo(() => ({
    total: messages.length,
    unread: messages.filter((m) => !m.isRead).length,
    open: messages.filter((m) => (m.status || 'open') === 'open').length,
    inProgress: messages.filter((m) => m.status === 'in_progress').length,
    resolved: messages.filter((m) => m.status === 'resolved').length,
    priority: messages.filter((m) => m.priority).length,
  }), [messages]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter === 'unread' && m.isRead) return false;
      if (filter === 'priority' && !m.priority) return false;
      if (['open', 'in_progress', 'resolved', 'closed'].includes(filter) && (m.status || 'open') !== filter) return false;
      if (typeFilter !== 'all' && m.contactType !== typeFilter) return false;
      if (q) {
        const hay = [m.name, m.email, m.subject, m.message].filter(Boolean).map((s) => String(s).toLowerCase());
        if (!hay.some((s) => s.includes(q))) return false;
      }
      return true;
    });
  }, [messages, search, filter, typeFilter]);

  useEffect(() => { setPage(1); }, [search, filter, typeFilter]);

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const selected = messages.find((m) => m._id === selectedId);

  // Auto-mark read when a message opens
  useEffect(() => {
    if (!selected || selected.isRead) return;
    api.patch(`/api/contact/${selected._id}/read`).then(() => {
      setMessages((arr) => arr.map((m) => (m._id === selected._id ? { ...m, isRead: true } : m)));
    }).catch(() => {});
  }, [selected?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset composer when conversation changes
  useEffect(() => { 
    setReplyDraft(''); 
    setReplySubject(selected ? `Re: ${selected.subject}` : ''); 
    setReplyError(''); 
    setAttachments([]); 
  }, [selectedId, selected]);

  // ── Actions ───────────────────────────────────────────────────────
  function selectMessage(id) {
    setSelectedId(id);
    setIsMobileDetailOpen(true);
  }

  async function toggleUnread() {
    if (!selected) return;
    const next = selected.isRead ? 'unread' : 'read';
    try {
      const res = await api.patch(`/api/contact/${selected._id}/${next}`);
      setMessages((arr) => arr.map((m) => (m._id === selected._id ? { ...m, isRead: res.data.data.isRead } : m)));
    } catch (e) { /* ignore */ }
  }

  async function togglePriority() {
    if (!selected) return;
    try {
      const res = await api.patch(`/api/contact/${selected._id}/priority`);
      setMessages((arr) => arr.map((m) => (m._id === selected._id ? { ...m, priority: res.data.data.priority } : m)));
    } catch (e) { /* ignore */ }
  }

  async function changeStatus(status) {
    if (!selected) return;
    try {
      const res = await api.patch(`/api/contact/${selected._id}/status`, { status });
      setMessages((arr) => arr.map((m) => (m._id === selected._id ? { ...m, ...res.data.data } : m)));
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not update status.');
    }
  }

  async function sendReply() {
    if (!selected) return;
    const body = replyDraft.trim();
    if (body.length < 2) { setReplyError('Reply cannot be empty.'); return; }
    setReplyBusy(true);
    setReplyError('');
    try {
      const res = await api.post(`/api/contact/${selected._id}/reply`, { body, subject: replySubject, attachments });
      if (res.data?.success) {
        setMessages((arr) => arr.map((m) => (m._id === selected._id ? { ...m, ...res.data.data } : m)));
        setReplyDraft('');
        // Scroll to bottom of thread
        setTimeout(() => replyRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setReplyError(res.data?.error || 'Reply failed.');
      }
    } catch (e) {
      setReplyError(e?.response?.data?.error || 'Reply failed.');
    } finally {
      setReplyBusy(false);
    }
  }

  function startDelete() {
    if (!selected) return;
    setDeleteState({ message: selected, busy: false });
  }
  async function confirmDelete() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true, error: '' }));
    try {
      await api.delete(`/api/contact/${deleteState.message._id}`);
      setMessages((arr) => arr.filter((m) => m._id !== deleteState.message._id));
      setSelectedId(null);
      setDeleteState(null);
      setIsMobileDetailOpen(false);
    } catch (e) {
      setDeleteState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Delete failed.' }));
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirmingBulkDelete) { setConfirmingBulkDelete(true); return; }
    setConfirmingBulkDelete(false);
    setBulkDeleteBusy(true);
    try {
      await api.post('/api/contact/bulk-delete', { ids: Array.from(selectedIds) });
      setMessages((arr) => arr.filter((m) => !selectedIds.has(m._id)));
      if (selectedIds.has(selectedId)) {
        setSelectedId(null);
        setIsMobileDetailOpen(false);
      }
      setSelectedIds(new Set());
    } catch (e) {
      showToast(e?.response?.data?.error || 'Bulk delete failed.');
    } finally {
      setBulkDeleteBusy(false);
    }
  }
  
  function toggleSelection(id) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
    setConfirmingBulkDelete(false);
  }

  return (
    <Layout>
      <div className="flex -m-4 md:-m-8 h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] overflow-hidden">
        {/* ── LEFT: Filter rail ──────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 bg-[#0a1f1a] text-white border-r border-emerald-900/30">
          <div className="px-5 py-5 border-b border-emerald-900/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-300 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>headset_mic</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-300">Support Console</p>
            </div>
            <h2 className="text-base font-bold mt-1">Inquiries</h2>
          </div>
          <div className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
            <RailLink active={filter === 'all'} onClick={() => setFilter('all')} icon="inbox" count={stats.total}>All inquiries</RailLink>
            <RailLink active={filter === 'unread'} onClick={() => setFilter('unread')} icon="mark_email_unread" count={stats.unread} tone="emerald">Unread</RailLink>
            <RailLink active={filter === 'priority'} onClick={() => setFilter('priority')} icon="flag" count={stats.priority} tone="red">Flagged</RailLink>
            <div className="h-px bg-emerald-900/30 my-3"></div>
            <p className="px-3 text-2xs font-bold uppercase tracking-widest text-emerald-300/40 mb-1">Status</p>
            <RailLink active={filter === 'open'} onClick={() => setFilter('open')} icon="schedule" count={stats.open}>Open</RailLink>
            <RailLink active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} icon="more_horiz" count={stats.inProgress}>In Progress</RailLink>
            <RailLink active={filter === 'resolved'} onClick={() => setFilter('resolved')} icon="check_circle" count={stats.resolved}>Resolved</RailLink>
            <div className="h-px bg-emerald-900/30 my-3"></div>
            <p className="px-3 text-2xs font-bold uppercase tracking-widest text-emerald-300/40 mb-1">Type</p>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-[#06201B] border border-emerald-900/40 rounded-lg text-white text-xs px-3 py-2 focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All types</option>
              {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
          <div className="px-5 py-4 border-t border-emerald-900/30">
            <p className="text-2xs font-bold uppercase tracking-widest text-emerald-300/50 mb-1">Last refresh</p>
            <p className="text-2xs text-emerald-100/60">{relativeTime(Date.now())}</p>
            <button onClick={fetchMessages} className="mt-2 w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-2xs font-bold uppercase tracking-widest rounded-lg transition-colors">
              Refresh
            </button>
          </div>
        </aside>

        {/* ── MIDDLE: Inquiry list ───────────────────────────────── */}
        <section className={`w-full md:w-[380px] bg-surface flex flex-col h-full overflow-hidden border-r border-outline-variant/10 ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 pt-4 pb-3 border-b border-outline-variant/10 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between lg:hidden">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">Inbox</h2>
              <span className="px-2 py-0.5 bg-secondary-container/20 text-secondary text-2xs font-bold rounded-lg uppercase">{stats.unread} unread</span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/20 mb-2">
                <span className="text-2xs font-bold text-on-surface-variant uppercase tracking-widest">
                  {confirmingBulkDelete ? `Delete ${selectedIds.size}?` : `${selectedIds.size} selected`}
                </span>
                <div className="flex items-center gap-1.5">
                  {confirmingBulkDelete && (
                    <button onClick={() => setConfirmingBulkDelete(false)} className="px-3 py-1 border border-outline-variant/40 text-on-surface-variant text-2xs font-bold uppercase tracking-widest rounded transition-colors hover:bg-white">
                      Cancel
                    </button>
                  )}
                  <button onClick={bulkDelete} disabled={bulkDeleteBusy} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50">
                    {bulkDeleteBusy ? 'Deleting...' : confirmingBulkDelete ? 'Confirm' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-lg">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, subject..."
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs text-on-surface"
              />
            </div>
            {/* Mobile-only quick filter pills (rail is hidden) */}
            <div className="lg:hidden flex gap-1 overflow-x-auto no-scrollbar">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setFilter(t.v)}
                  className={`px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest whitespace-nowrap ${
                    filter === t.v ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <ListSkeleton />
            ) : error ? (
              <div className="p-6 text-center text-error text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <EmptyList />
            ) : (
              paged.map((m) => {
                const isActive = selectedId === m._id;
                const st = STATUS_META[m.status || 'open'];
                return (
                  <div key={m._id} className="relative group">
                    <button
                      onClick={() => selectMessage(m._id)}
                      className={`w-full text-left px-4 py-3 border-b border-outline-variant/5 transition-all relative ${
                        isActive ? 'bg-primary/5' : 'hover:bg-surface-container-lowest'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></span>}
                      {!m.isRead && !isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></span>}
                      <div className="flex gap-3 items-center">
                        <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleSelection(m._id); }}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${selectedIds.has(m._id) ? 'bg-primary border-primary text-white' : 'border-outline-variant/40 bg-white group-hover:border-primary/50'}`}>
                            {selectedIds.has(m._id) && <span className="material-symbols-outlined text-xs font-bold">check</span>}
                          </div>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-2xs uppercase shadow-sm ${
                          !m.isRead ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant/40'
                        }`}>
                          {initials(m.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-0.5 gap-2">
                            <p className={`text-xs truncate ${!m.isRead ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant/70'}`}>{m.name}</p>
                            <span className="text-2xs font-bold text-on-surface-variant/40 whitespace-nowrap">{relativeTime(m.createdAt)}</span>
                          </div>
                          <p className={`text-xs truncate mb-1 ${!m.isRead ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant/70'}`}>{m.subject}</p>
                          <p className={`text-2xs line-clamp-1 ${!m.isRead ? 'text-on-surface-variant/60' : 'text-on-surface-variant/40'}`}>{m.message}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${st.pill}`}>
                              <span className={`w-1 h-1 rounded-full ${st.dot}`}></span>
                              {st.label}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${(TYPE_META[m.contactType] || TYPE_META.other).color}`}>
                              {(TYPE_META[m.contactType] || TYPE_META.other).label}
                            </span>
                            {m.priority && <span className="material-symbols-outlined text-amber-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>}
                            {m.replies && m.replies.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-2xs text-on-surface-variant/50 font-bold">
                                <span className="material-symbols-outlined text-2xs">reply</span>
                                {m.replies.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </section>

        {/* ── RIGHT: Detail + composer ───────────────────────────── */}
        <section className={`flex-1 bg-surface-container-low flex flex-col h-full overflow-hidden ${isMobileDetailOpen ? 'flex' : 'hidden md:flex'}`}>
          {selected ? (
            <Conversation
              m={selected}
              draft={replyDraft}
              onDraft={setReplyDraft}
              replySubject={replySubject}
              onSubject={setReplySubject}
              attachments={attachments}
              setAttachments={setAttachments}
              uploading={uploading}
              setUploading={setUploading}
              busy={replyBusy}
              error={replyError}
              onSend={sendReply}
              onBack={() => setIsMobileDetailOpen(false)}
              onToggleUnread={toggleUnread}
              onTogglePriority={togglePriority}
              onChangeStatus={changeStatus}
              onDelete={startDelete}
              showToast={showToast}
              replyRef={replyRef}
            />
          ) : (
            <EmptyDetail />
          )}
        </section>
      </div>

      {/* Delete confirmation */}
      {deleteState && (
        <DeleteModal state={deleteState} onClose={() => !deleteState.busy && setDeleteState(null)} onConfirm={confirmDelete} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-on-inverse-surface px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
      )}
    </Layout>
  );
};

// ── Conversation Panel ────────────────────────────────────────────────
const Conversation = ({ m, draft, onDraft, replySubject, onSubject, attachments, setAttachments, uploading, setUploading, busy, error, onSend, onBack, onToggleUnread, onTogglePriority, onChangeStatus, onDelete, replyRef, showToast }) => {
  const st = STATUS_META[m.status || 'open'];
  const typeMeta = TYPE_META[m.contactType] || TYPE_META.other;
  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-outline-variant/10 px-4 md:px-6 py-3 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs uppercase bg-primary text-white shadow-sm`}>
          {initials(m.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-on-surface tracking-tight truncate">{m.name}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${typeMeta.color}`}>{typeMeta.label}</span>
          </div>
          <p className="text-xs text-on-surface-variant/60 truncate">{m.email} · {m.phone || 'no phone'}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={m.status || 'open'}
            onChange={(e) => onChangeStatus(e.target.value)}
            className={`text-2xs font-bold uppercase tracking-widest border rounded-lg px-2 py-1 outline-none cursor-pointer ${st.pill}`}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <button onClick={onTogglePriority} className={`p-2 rounded-lg transition-colors ${m.priority ? 'text-amber-500 bg-amber-50' : 'text-on-surface-variant/30 hover:bg-surface-container-low'}`} title={m.priority ? 'Remove flag' : 'Flag for follow-up'}>
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: m.priority ? "'FILL' 1" : '' }}>flag</span>
          </button>
          <button onClick={onToggleUnread} className="p-2 rounded-lg text-on-surface-variant/40 hover:bg-surface-container-low transition-colors" title={m.isRead ? 'Mark unread' : 'Mark read'}>
            <span className="material-symbols-outlined text-xl">{m.isRead ? 'mark_email_unread' : 'mark_email_read'}</span>
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-4">
          {/* Original message */}
          <div className="bg-white rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-start justify-between gap-3 bg-surface-container-low/30">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight">{m.subject}</h3>
                <p className="text-2xs text-on-surface-variant/60 mt-0.5">From <strong>{m.name}</strong> · {fmtDate(m.createdAt)}</p>
              </div>
            </div>
            <div className="p-5 text-sm leading-[1.75] text-on-surface whitespace-pre-wrap">{m.message}</div>
            {m.referralSource && (
              <div className="px-5 pb-4 text-2xs text-on-surface-variant/50">Referred via: <span className="font-bold">{m.referralSource}</span></div>
            )}
          </div>

          {/* Replies */}
          {m.replies && m.replies.map((r, idx) => (
            <div key={idx} className="flex gap-3 justify-end">
              <div className="bg-primary text-white rounded-2xl rounded-tr-md shadow-sm max-w-[80%] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-emerald-900/40 bg-[#06201B]/40">
                  <p className="text-2xs font-bold uppercase tracking-widest text-emerald-200">Replied by {r.sentByEmail || 'admin'}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xs text-emerald-100/60">{fmtDate(r.sentAt)}</p>
                    <DeliveryStatus resendId={r.resendId} />
                  </div>
                </div>
                <div className="px-4 py-3 text-sm leading-[1.7] whitespace-pre-wrap">{r.body}</div>
                {r.attachments && r.attachments.length > 0 && (
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {r.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-emerald-900/30">
                        <img src={url} alt="attachment" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-2xs font-bold flex-shrink-0 mt-1">
                <span className="material-symbols-outlined text-sm">support_agent</span>
              </div>
            </div>
          ))}
          <div ref={replyRef}></div>
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-outline-variant/10 px-4 md:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 mt-1">
              <span className="material-symbols-outlined text-base">support_agent</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-2">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">Reply to {m.name} <span className="text-on-surface-variant/40">({m.email})</span></p>
              </div>
              <input 
                type="text" 
                value={replySubject} 
                onChange={(e) => onSubject(e.target.value)} 
                placeholder="Subject..."
                className="w-full px-3 py-1.5 border border-outline-variant/40 rounded-t-lg text-xs font-medium focus:border-primary outline-none border-b-0"
                disabled={busy}
              />
              <textarea
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
                rows={3}
                placeholder="Type your reply…"
                disabled={busy}
                className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-b-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none disabled:opacity-50"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onSend(); }
                }}
              />
              {attachments.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {attachments.map((url, i) => (
                    <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-outline-variant/30">
                      <img src={url} alt="attachment" className="w-full h-full object-cover" />
                      <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 flex items-center justify-center text-2xs rounded-bl">×</button>
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-xl">attach_file</span>
                    <span className="text-2xs font-bold uppercase tracking-widest">{uploading ? 'Uploading...' : 'Attach'}</span>
                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploading(true);
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await api.post('/api/contact/upload-attachment', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (res.data?.url) setAttachments([...attachments, res.data.url]);
                      } catch (err) {
                        showToast('Upload failed');
                      } finally {
                        setUploading(false);
                      }
                    }} disabled={uploading || busy} />
                  </label>
                  <p className="text-2xs text-on-surface-variant/40 font-medium">Ctrl/⌘ + Enter to send</p>
                </div>
                <div className="flex gap-2">
                  {m.status !== 'resolved' && (
                    <button onClick={() => onChangeStatus('resolved')} className="px-3 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low transition-all">
                      Mark resolved
                    </button>
                  )}
                  <button
                    onClick={onSend}
                    disabled={busy || draft.trim().length < 2}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    {busy ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const DeliveryStatus = ({ resendId }) => {
  const [status, setStatus] = React.useState('loading');
  
  React.useEffect(() => {
    if (!resendId) { setStatus('unknown'); return; }
    api.get(`/api/contact/delivery-status/${resendId}`)
      .then(r => setStatus(r.data.status))
      .catch(() => setStatus('unknown'));
  }, [resendId]);

  if (!resendId) return null;
  if (status === 'loading') return <span className="text-2xs text-emerald-600/50">...</span>;
  return (
    <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 ml-2 border border-emerald-200/50">
      {status}
    </span>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────
const RailLink = ({ active, onClick, icon, count, tone, children }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
      active ? 'bg-emerald-600/20 text-emerald-200' : 'text-white/70 hover:bg-white/5'
    }`}
  >
    <span className="material-symbols-outlined text-base">{icon}</span>
    <span className="flex-1 text-left">{children}</span>
    {count != null && count > 0 && (
      <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${tone === 'red' ? 'bg-red-500/30 text-red-200' : tone === 'emerald' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-white/80'}`}>
        {count}
      </span>
    )}
  </button>
);

const ListSkeleton = () => (
  <div className="p-4 space-y-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-container animate-pulse"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-surface-container rounded animate-pulse"></div>
          <div className="h-2 w-full bg-surface-container rounded animate-pulse"></div>
        </div>
      </div>
    ))}
  </div>
);

const EmptyList = () => (
  <div className="p-10 text-center">
    <div className="w-14 h-14 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant/40 mb-3">
      <span className="material-symbols-outlined text-2xl">inbox</span>
    </div>
    <p className="text-sm text-on-surface-variant/60 font-medium">No inquiries match this view.</p>
  </div>
);

const EmptyDetail = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/40 p-8">
    <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-4">
      <span className="material-symbols-outlined text-4xl">forum</span>
    </div>
    <p className="text-base font-bold text-on-surface-variant mb-1">Select a conversation</p>
    <p className="text-sm text-center max-w-sm">Customer inquiries from the contact form will appear here. Reply, flag, or update status — all in one place.</p>
  </div>
);

const DeleteModal = ({ state, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">delete</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-1">Delete conversation</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        Permanently remove the inquiry from <strong>{state.message.name}</strong> ({state.message.email})? Any reply history is lost.
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

export default Messages;
