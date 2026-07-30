import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { formatAccountNumber } from '../utils/formatAccountNumber';

// ── Constants ─────────────────────────────────────────────────────────
const STATUS_META = {
  pending:   { label: 'Pending',   pill: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',   icon: 'schedule' },
  contacted: { label: 'Contacted', pill: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-500',    icon: 'call' },
  approved:  { label: 'Approved',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: 'check_circle' },
  rejected:  { label: 'Rejected',  pill: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500',     icon: 'cancel' },
  converted: { label: 'Converted', pill: 'bg-violet-50 text-violet-700 border-violet-200',  dot: 'bg-violet-500',  icon: 'storefront' },
};
const STATUS_ORDER = ['pending', 'contacted', 'approved', 'converted', 'rejected'];
const PAGE_SIZE = 20;

const defaultFilters = {
  status: 'all',
  priority: 'all',
  source: 'all',
  recency: 'all',
};

function relativeTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function initials(name) {
  if (!name) return 'M';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const Waitlist = () => {
  const [entries, setEntries] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);
  const [activeTab, setActiveTab] = useState('all');

  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  // Detail drawer
  const [detailEntry, setDetailEntry] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Convert confirmation modal
  const [convertState, setConvertState] = useState(null); // { entry, busy, error, done }

  // Delete confirmation
  const [deleteState, setDeleteState] = useState(null); // { entry, busy }

  // Bulk-action confirmation (replaces window.confirm)
  const [bulkConfirm, setBulkConfirm] = useState(null); // { type: 'status', status } | { type: 'delete' }
  const [bulkBusy, setBulkBusy] = useState(false);

  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, ana] = await Promise.all([
        api.get('/api/waitlist'),
        api.get('/api/waitlist/analytics').catch(() => ({ data: null })),
      ]);
      const data = Array.isArray(list.data) ? list.data : [];
      setEntries(data);
      if (ana.data?.success) setAnalytics(ana.data.data);
    } catch (err) {
      console.error('Fetch waitlist failed:', err);
      setError(err?.response?.data?.error || err?.message || 'Could not load waitlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const h = () => fetchAll();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchAll]);

  // Outside-click closers
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    if (openMenuId) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMenuId]);

  useEffect(() => {
    const onClick = (e) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) setShowFilters(false);
    };
    if (showFilters) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showFilters]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filters, activeTab]);

  // Derived: status counts (for tabs/stats)
  const statusCounts = useMemo(() => {
    const c = { all: entries.length, pending: 0, contacted: 0, approved: 0, rejected: 0, converted: 0, priority: 0 };
    entries.forEach((e) => {
      c[e.status || 'pending'] = (c[e.status || 'pending'] || 0) + 1;
      if (e.priority) c.priority++;
    });
    return c;
  }, [entries]);

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([, v]) => v !== 'all').length,
    [filters]
  );

  // Derived: filtered + searched entries
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const phoneQ = q.replace(/\D/g, '');
    return entries.filter((e) => {
      // Tab
      if (activeTab !== 'all' && (e.status || 'pending') !== activeTab) return false;
      // Search
      if (q) {
        const hay = [e.fullName, e.businessName, e.email, e.businessType].filter(Boolean).map((s) => String(s).toLowerCase());
        const phoneMatch = phoneQ && String(e.phone || '').replace(/\D/g, '').includes(phoneQ);
        if (!phoneMatch && !hay.some((s) => s.includes(q))) return false;
      }
      // Filters
      if (filters.status !== 'all' && (e.status || 'pending') !== filters.status) return false;
      if (filters.priority === 'priority' && !e.priority) return false;
      if (filters.priority === 'standard' && e.priority) return false;
      if (filters.source !== 'all' && (e.businessType || '').toLowerCase() !== filters.source.toLowerCase()) return false;
      if (filters.recency !== 'all') {
        const days = (Date.now() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (filters.recency === '7d' && days > 7) return false;
        if (filters.recency === '30d' && days > 30) return false;
        if (filters.recency === 'older' && days <= 30) return false;
      }
      return true;
    });
  }, [entries, search, filters, activeTab]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pagedEntries = filteredEntries.slice(pageStart, pageStart + PAGE_SIZE);

  // Unique business types for filter dropdown
  const businessTypes = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => { if (e.businessType) set.add(e.businessType); });
    return Array.from(set).sort();
  }, [entries]);

  // ── Actions ─────────────────────────────────────────────────────────
  async function changeStatus(entry, status) {
    setOpenMenuId(null);
    try {
      await api.put(`/api/waitlist/${entry._id}/status`, { status });
      fetchAll();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Failed to update status.');
    }
  }

  async function togglePriority(entry) {
    setOpenMenuId(null);
    try {
      await api.put(`/api/waitlist/${entry._id}/priority`, { priority: !entry.priority });
      fetchAll();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Failed to toggle priority.');
    }
  }

  function openDetail(entry) {
    setDetailEntry(entry);
    setNotesDraft(entry.notes || '');
    setNotesSaved(false);
  }
  function closeDetail() { setDetailEntry(null); }

  async function saveNotes() {
    if (!detailEntry) return;
    setNotesSaving(true);
    try {
      await api.put(`/api/waitlist/${detailEntry._id}/notes`, { notes: notesDraft });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2200);
      fetchAll();
    } catch (e) {
      showToast(e?.response?.data?.error || 'Failed to save notes.');
    } finally {
      setNotesSaving(false);
    }
  }

  function startConvert(entry) {
    setOpenMenuId(null);
    setConvertState({ entry, busy: false, error: '', done: null });
  }
  async function confirmConvert() {
    if (!convertState) return;
    setConvertState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.post(`/api/waitlist/${convertState.entry._id}/convert`);
      if (res.data?.success) {
        setConvertState((s) => ({ ...s, busy: false, done: res.data.data }));
        fetchAll();
      } else {
        setConvertState((s) => ({ ...s, busy: false, error: res.data?.error || 'Conversion failed.' }));
      }
    } catch (e) {
      setConvertState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Conversion failed.' }));
    }
  }

  function startDelete(entry) {
    setOpenMenuId(null);
    setDeleteState({ entry, busy: false });
  }
  async function confirmDelete() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true, error: '' }));
    try {
      await api.delete(`/api/waitlist/${deleteState.entry._id}`);
      setDeleteState(null);
      fetchAll();
    } catch (e) {
      setDeleteState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Delete failed.' }));
    }
  }

  // ── Bulk actions ────────────────────────────────────────────────────
  const allOnPageSelected = pagedEntries.length > 0 && pagedEntries.every((e) => selected.has(e._id));
  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) {
      pagedEntries.forEach((e) => next.delete(e._id));
    } else {
      pagedEntries.forEach((e) => next.add(e._id));
    }
    setSelected(next);
    setBulkConfirm(null);
  }
  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    setBulkConfirm(null);
  }

  function requestBulk(action) { setBulkConfirm(action); }
  function cancelBulk() { setBulkConfirm(null); }

  async function confirmBulk() {
    if (!bulkConfirm) return;
    const ids = Array.from(selected);
    if (ids.length === 0) { setBulkConfirm(null); return; }
    setBulkBusy(true);
    try {
      if (bulkConfirm.type === 'delete') {
        await Promise.all(ids.map((id) => api.delete(`/api/waitlist/${id}`)));
      } else {
        await Promise.all(ids.map((id) => api.put(`/api/waitlist/${id}/status`, { status: bulkConfirm.status })));
      }
      setSelected(new Set());
      fetchAll();
    } catch (e) {
      showToast(bulkConfirm.type === 'delete' ? 'Some deletes failed. Refreshing list.' : 'Some updates failed. Refreshing list.');
      fetchAll();
    } finally {
      setBulkBusy(false);
      setBulkConfirm(null);
    }
  }

  // ── CSV export ──────────────────────────────────────────────────────
  function exportCsv() {
    const rows = filteredEntries.map((e) => ({
      'Full Name': e.fullName || '',
      'Business': e.businessName || '',
      'Email': e.email || '',
      'Phone': e.phone || '',
      'Type': e.businessType || '',
      'Challenge': (e.challenge || '').replace(/\n/g, ' '),
      'Status': e.status || 'pending',
      'Priority': e.priority ? 'Yes' : '',
      'Created': e.createdAt ? new Date(e.createdAt).toISOString() : '',
      'Contacted': e.contactedAt ? new Date(e.contactedAt).toISOString() : '',
      'Converted': e.convertedAt ? new Date(e.convertedAt).toISOString() : '',
    }));
    if (rows.length === 0) { showToast('Nothing to export.'); return; }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paychain-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearAll() { setSearch(''); setFilters(defaultFilters); setActiveTab('all'); }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">Waitlist Pipeline</h2>
            <p className="text-on-surface-variant/60 mt-1 text-xs md:text-sm font-body">Track prospective merchants from interest through to onboarded business.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={exportCsv} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-low transition-colors shadow-sm uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">file_download</span>
              Export CSV
            </button>
            <button onClick={fetchAll} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-md uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Analytics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          <StatCard label="Total" value={analytics?.total ?? statusCounts.all} icon="group" tone="primary" />
          <StatCard label="New (7d)" value={analytics?.recent7d ?? 0} icon="trending_up" tone="emerald" />
          <StatCard label="Pending" value={statusCounts.pending} icon="schedule" tone="amber" />
          <StatCard label="Approved" value={statusCounts.approved} icon="check_circle" tone="emerald" />
          <StatCard label="Converted" value={statusCounts.converted} icon="storefront" tone="violet" />
          <StatCard label="Conv. Rate" value={`${analytics?.conversionRate ?? 0}%`} icon="bolt" tone="blue" sub={analytics?.avgDaysToConvert != null ? `~${analytics.avgDaysToConvert}d avg` : null} />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-outline-variant/10 font-body overflow-x-auto no-scrollbar whitespace-nowrap">
          <Tab v="all" current={activeTab} onClick={setActiveTab}>All <Count>{statusCounts.all}</Count></Tab>
          {STATUS_ORDER.map((s) => (
            <Tab key={s} v={s} current={activeTab} onClick={setActiveTab}>
              {STATUS_META[s].label} <Count>{statusCounts[s] || 0}</Count>
            </Tab>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-4 md:px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-xl">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-10 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm w-full font-body text-on-surface"
                  placeholder="Search name, business, email or phone..."
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
              <div className="relative" ref={filtersRef}>
                <button
                  onClick={() => setShowFilters((s) => !s)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors font-label tracking-tight ${
                    activeFilterCount > 0 ? 'bg-primary text-white hover:bg-primary/90' : 'text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">filter_list</span>
                  Filters
                  {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-2xs font-bold">{activeFilterCount}</span>}
                </button>
                {showFilters && (
                  <FilterPopover
                    filters={filters}
                    businessTypes={businessTypes}
                    onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
                    onReset={() => setFilters(defaultFilters)}
                    onClose={() => setShowFilters(false)}
                  />
                )}
              </div>
              {(search || activeFilterCount > 0 || activeTab !== 'all') && (
                <button onClick={clearAll} className="flex items-center gap-1 px-3 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-base">refresh</span>
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/60 font-body whitespace-nowrap">
              {filteredEntries.length} of {entries.length}
            </p>
          </div>

          {/* Bulk-action bar (only when something is selected) */}
          {selected.size > 0 && (
            <div className="px-4 md:px-6 py-3 bg-primary/5 border-b border-outline-variant/10 flex flex-wrap items-center gap-3">
              {bulkConfirm ? (
                <>
                  <p className="text-xs font-bold text-primary">
                    {bulkConfirm.type === 'delete'
                      ? `Permanently delete ${selected.size} entr${selected.size === 1 ? 'y' : 'ies'}?`
                      : `Mark ${selected.size} entr${selected.size === 1 ? 'y' : 'ies'} as ${bulkConfirm.status}?`}
                  </p>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button onClick={cancelBulk} disabled={bulkBusy} className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant text-2xs font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={confirmBulk} disabled={bulkBusy} className={`px-3 py-1.5 rounded-lg text-white text-2xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${bulkConfirm.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}>
                      {bulkBusy ? 'Working…' : 'Confirm'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-primary">{selected.size} selected</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <BulkBtn onClick={() => requestBulk({ type: 'status', status: 'contacted' })} icon="call">Mark Contacted</BulkBtn>
                    <BulkBtn onClick={() => requestBulk({ type: 'status', status: 'approved' })} icon="check_circle">Mark Approved</BulkBtn>
                    <BulkBtn onClick={() => requestBulk({ type: 'status', status: 'rejected' })} icon="cancel">Reject</BulkBtn>
                    <BulkBtn onClick={() => requestBulk({ type: 'delete' })} icon="delete" tone="red">Delete</BulkBtn>
                  </div>
                  <button onClick={() => setSelected(new Set())} className="ml-auto text-2xs font-bold text-on-surface-variant/60 hover:text-on-surface uppercase tracking-widest">Clear selection</button>
                </>
              )}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-on-surface-variant/60 font-medium">Loading waitlist…</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl">error</span>
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse font-body">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-3 py-2 w-10">
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
                    </th>
                    <Th>#</Th>
                    <Th>Merchant</Th>
                    <Th>Contact</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Added</Th>
                    <Th>Priority</Th>
                    <th className="px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {pagedEntries.map((e, i) => {
                    const st = STATUS_META[e.status || 'pending'];
                    const isSelected = selected.has(e._id);
                    return (
                      <tr
                        key={e._id}
                        className={`hover:bg-secondary-container/5 transition-colors group cursor-pointer ${e.priority ? 'bg-amber-50/20' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                        onClick={() => openDetail(e)}
                      >
                        <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(e._id)} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant/40 border-b border-outline-variant/5">{String(pageStart + i + 1).padStart(3, '0')}</td>
                        <td className="px-3 py-2 border-b border-outline-variant/5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary text-xs font-bold ring-2 ring-white shadow-sm uppercase">
                              {initials(e.fullName)}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface tracking-tight">{e.fullName || '—'}</p>
                              <p className="text-2xs text-on-surface-variant/60">{e.businessName || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-outline-variant/5">
                          <p className="text-on-surface-variant/80 font-medium">{e.phone || '—'}</p>
                          <p className="text-2xs text-on-surface-variant/60">{e.email || 'No email'}</p>
                        </td>
                        <td className="px-3 py-2 border-b border-outline-variant/5">
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-2xs font-bold uppercase tracking-tight">{e.businessType || '—'}</span>
                        </td>
                        <td className="px-3 py-2 border-b border-outline-variant/5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold border tracking-wide uppercase ${st.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/60">
                          {relativeTime(e.createdAt)}
                        </td>
                        <td className="px-3 py-2 border-b border-outline-variant/5" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            onClick={() => togglePriority(e)}
                            className="p-1 rounded hover:bg-amber-50 transition-colors"
                            title={e.priority ? 'Remove priority' : 'Mark as priority'}
                          >
                            <span className={`material-symbols-outlined text-xl ${e.priority ? 'text-amber-500' : 'text-on-surface-variant/20'}`} style={{ fontVariationSettings: e.priority ? "'FILL' 1" : '' }}>star</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right border-b border-outline-variant/5 relative" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setOpenMenuId(openMenuId === e._id ? null : e._id); }}
                            className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant/30 hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-xl">more_vert</span>
                          </button>
                          {openMenuId === e._id && (
                            <div ref={menuRef} className="absolute right-3 top-10 z-20 w-56 bg-white rounded-xl shadow-xl border border-outline-variant/20 overflow-hidden">
                              <MenuItem icon="visibility" tone="blue" onClick={() => { setOpenMenuId(null); openDetail(e); }}>View / edit notes</MenuItem>
                              <div className="h-px bg-outline-variant/20"></div>
                              {(e.status || 'pending') !== 'contacted' && <MenuItem icon="call" tone="blue" onClick={() => changeStatus(e, 'contacted')}>Mark Contacted</MenuItem>}
                              {(e.status || 'pending') !== 'approved' && <MenuItem icon="check_circle" tone="emerald" onClick={() => changeStatus(e, 'approved')}>Mark Approved</MenuItem>}
                              {(e.status || 'pending') !== 'pending' && (e.status || 'pending') !== 'converted' && <MenuItem icon="schedule" tone="amber" onClick={() => changeStatus(e, 'pending')}>Move to Pending</MenuItem>}
                              {(e.status || 'pending') !== 'rejected' && (e.status || 'pending') !== 'converted' && <MenuItem icon="cancel" tone="red" onClick={() => changeStatus(e, 'rejected')}>Reject</MenuItem>}
                              {(e.status || 'pending') !== 'converted' && (
                                <>
                                  <div className="h-px bg-outline-variant/20"></div>
                                  <MenuItem icon="storefront" tone="violet" onClick={() => startConvert(e)}>Convert to Merchant</MenuItem>
                                </>
                              )}
                              <div className="h-px bg-outline-variant/20"></div>
                              <MenuItem icon="delete_forever" tone="red" onClick={() => startDelete(e)}>Delete entry</MenuItem>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pagedEntries.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-on-surface-variant/40">
                        {entries.length === 0
                          ? 'No waitlist entries yet.'
                          : (
                            <div className="space-y-2">
                              <p>No entries match the current filters.</p>
                              <button onClick={clearAll} className="text-primary font-bold underline text-xs">Clear filters</button>
                            </div>
                          )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredEntries.length > PAGE_SIZE && (
            <div className="px-6 py-3 bg-surface flex items-center justify-between border-t border-outline-variant/10">
              <p className="text-xs text-on-surface-variant/60 font-body">
                Page {page} of {totalPages} · Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => p === '…'
                    ? <span key={`g${idx}`} className="px-1 text-on-surface-variant/30">…</span>
                    : (
                      <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold tracking-tight ${p === page ? 'bg-primary text-white' : 'hover:bg-surface-container-low text-on-surface-variant'}`}>
                        {p}
                      </button>
                    ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top business types card */}
        {analytics?.topBusinessTypes && analytics.topBusinessTypes.length > 0 && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/80">Top business types in pipeline</h4>
              <span className="material-symbols-outlined text-on-surface-variant/40 text-xl">leaderboard</span>
            </div>
            <div className="space-y-2">
              {analytics.topBusinessTypes.map((t, idx) => {
                const max = analytics.topBusinessTypes[0]?.count || 1;
                const pct = (t.count / max) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <p className="text-xs font-bold text-on-surface w-28 truncate">{t.type}</p>
                    <div className="flex-1 h-2 bg-surface-container-low rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-on-surface-variant w-10 text-right">{t.count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {detailEntry && (
        <DetailDrawer
          entry={detailEntry}
          notes={notesDraft}
          onNotesChange={setNotesDraft}
          onSaveNotes={saveNotes}
          saving={notesSaving}
          saved={notesSaved}
          onClose={closeDetail}
          onAction={(action) => {
            if (action.startsWith('status:')) changeStatus(detailEntry, action.split(':')[1]);
            else if (action === 'priority') togglePriority(detailEntry);
            else if (action === 'convert') { closeDetail(); startConvert(detailEntry); }
            else if (action === 'delete') { closeDetail(); startDelete(detailEntry); }
          }}
        />
      )}

      {/* Convert modal */}
      {convertState && (
        <ConvertModal
          state={convertState}
          onClose={() => { if (!convertState.busy) { setConvertState(null); } }}
          onConfirm={confirmConvert}
        />
      )}

      {/* Delete modal */}
      {deleteState && (
        <DeleteModal
          state={deleteState}
          onClose={() => { if (!deleteState.busy) setDeleteState(null); }}
          onConfirm={confirmDelete}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
      )}
    </Layout>
  );
};

// ── Bits ─────────────────────────────────────────────────────────────
const Th = ({ children }) => (
  <th className="px-4 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
);

const Count = ({ children }) => (
  <span className="ml-1 px-1.5 py-0.5 rounded-md bg-surface-container-low text-2xs font-bold text-on-surface-variant/70">{children}</span>
);

const Tab = ({ v, current, onClick, children }) => (
  <button
    onClick={() => onClick(v)}
    className={`px-4 py-2 text-sm transition-colors relative flex-shrink-0 ${
      current === v ? 'font-bold text-primary' : 'font-medium text-on-surface-variant/60 hover:text-primary'
    }`}
  >
    {children}
    {current === v && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
  </button>
);

const StatCard = ({ label, value, icon, tone, sub }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    violet:  'bg-violet-50 text-violet-600',
    blue:    'bg-blue-50 text-blue-600',
    gray:    'bg-surface-container text-on-surface-variant/60',
  };
  return (
    <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-sm transition-all hover:scale-[1.02]">
      <div className="min-w-0">
        <p className="text-2xs md:text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{label}</p>
        <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{value}</h3>
        {sub && <p className="text-2xs text-on-surface-variant/60 mt-0.5">{sub}</p>}
      </div>
      <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center ${toneMap[tone] || toneMap.gray}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
};

const MenuItem = ({ icon, tone, onClick, children }) => {
  const toneMap = {
    emerald: 'text-emerald-700 hover:bg-emerald-50',
    amber:   'text-amber-700 hover:bg-amber-50',
    red:     'text-red-700 hover:bg-red-50',
    blue:    'text-blue-700 hover:bg-blue-50',
    violet:  'text-violet-700 hover:bg-violet-50',
  };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-left transition-colors ${toneMap[tone]}`}>
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {children}
    </button>
  );
};

const BulkBtn = ({ icon, onClick, tone, children }) => {
  const toneMap = {
    red: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-bold uppercase tracking-widest transition-colors ${toneMap[tone] || 'bg-white border border-outline-variant/40 text-on-surface hover:bg-surface-container-low'}`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {children}
    </button>
  );
};

const FilterPopover = ({ filters, businessTypes, onChange, onReset, onClose }) => {
  const groups = [
    { key: 'status', label: 'Status', opts: [{ v: 'all', l: 'All' }, ...STATUS_ORDER.map((s) => ({ v: s, l: STATUS_META[s].label }))] },
    { key: 'priority', label: 'Priority', opts: [{ v: 'all', l: 'All' }, { v: 'priority', l: 'Priority' }, { v: 'standard', l: 'Standard' }] },
    { key: 'recency', label: 'Added', opts: [{ v: 'all', l: 'Any time' }, { v: '7d', l: 'Last 7d' }, { v: '30d', l: 'Last 30d' }, { v: 'older', l: 'Older than 30d' }] },
  ];
  return (
    <div className="absolute right-0 top-12 z-30 w-72 bg-white rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
        <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface">Filter</h4>
        <button onClick={onReset} className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 hover:text-error">Reset</button>
      </div>
      <div className="max-h-[440px] overflow-y-auto custom-scrollbar p-4 space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">{g.label}</label>
            <div className="flex flex-wrap gap-1.5">
              {g.opts.map((o) => {
                const selected = filters[g.key] === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => onChange({ [g.key]: o.v })}
                    className={`px-2.5 py-1 rounded-full text-2xs font-semibold border transition-all ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/40 hover:border-primary/40'}`}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {businessTypes.length > 0 && (
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">Business Type</label>
            <select
              value={filters.source}
              onChange={(e) => onChange({ source: e.target.value })}
              className="w-full px-2 py-1.5 border border-outline-variant/40 rounded-md text-xs font-medium bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
            >
              <option value="all">All types</option>
              {businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container-low/50 flex justify-end">
        <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:shadow-md">Done</button>
      </div>
    </div>
  );
};

// ── Detail Drawer ────────────────────────────────────────────────────
const DetailDrawer = ({ entry, notes, onNotesChange, onSaveNotes, saving, saved, onClose, onAction }) => {
  const st = STATUS_META[entry.status || 'pending'];
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="ml-auto relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-outline-variant/20 px-6 py-4 flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 mb-0.5">Waitlist Entry</p>
            <h3 className="text-xl font-bold text-on-surface tracking-tight truncate">{entry.fullName}</h3>
            <p className="text-xs text-on-surface-variant/70 mt-0.5">{entry.businessName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + priority */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold border tracking-wide uppercase ${st.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
              {st.label}
            </span>
            {entry.priority && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold border bg-amber-50 text-amber-700 border-amber-200">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                Priority
              </span>
            )}
            <span className="text-2xs text-on-surface-variant/60 ml-auto">Added {relativeTime(entry.createdAt)}</span>
          </div>

          {/* Contact card */}
          <Section title="Contact Information" icon="person">
            <Row label="Full Name" value={entry.fullName} />
            <Row label="Email" value={entry.email || '— none provided —'} />
            <Row label="Phone" value={entry.phone} mono />
          </Section>

          {/* Business card */}
          <Section title="Business Details" icon="storefront">
            <Row label="Business Name" value={entry.businessName} />
            <Row label="Business Type" value={entry.businessType} />
            {entry.challenge && <Row label="Stated Challenge" value={<span className="text-xs leading-relaxed">{entry.challenge}</span>} />}
          </Section>

          {/* Timeline */}
          <Section title="Pipeline Timeline" icon="schedule">
            <Row label="Submitted" value={fmtDate(entry.createdAt)} />
            {entry.contactedAt && <Row label="First Contacted" value={fmtDate(entry.contactedAt)} />}
            {entry.convertedAt && <Row label="Converted" value={fmtDate(entry.convertedAt)} />}
            {entry.convertedMerchantId && (
              <Row label="Merchant Record" value={
                <span className="font-mono text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-200">
                  {entry.convertedMerchantId.paybillAccount ? `#${entry.convertedMerchantId.paybillAccount}` : 'Linked'}
                </span>
              } />
            )}
            {entry.updatedBy?.email && <Row label="Last Updated By" value={entry.updatedBy.email} />}
          </Section>

          {/* Internal notes */}
          <Section title="Internal Notes" icon="sticky_note_2">
            <div className="p-4 space-y-2">
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Add internal notes about this lead — visible only to admins."
                className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-2xs text-on-surface-variant/50">{notes.length}/2000 · only admins see this</p>
                <div className="flex items-center gap-2">
                  {saved && <span className="text-2xs text-emerald-600 font-bold">✓ Saved</span>}
                  <button
                    onClick={onSaveNotes}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save notes'}
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Quick actions */}
          <Section title="Quick Actions" icon="bolt">
            <div className="p-4 grid grid-cols-2 gap-2">
              {(entry.status || 'pending') !== 'contacted' && (
                <ActionBtn icon="call" tone="blue" onClick={() => onAction('status:contacted')}>Mark Contacted</ActionBtn>
              )}
              {(entry.status || 'pending') !== 'approved' && (
                <ActionBtn icon="check_circle" tone="emerald" onClick={() => onAction('status:approved')}>Mark Approved</ActionBtn>
              )}
              {(entry.status || 'pending') !== 'rejected' && (entry.status || 'pending') !== 'converted' && (
                <ActionBtn icon="cancel" tone="red" onClick={() => onAction('status:rejected')}>Reject</ActionBtn>
              )}
              <ActionBtn icon={entry.priority ? 'star' : 'star_outline'} tone="amber" onClick={() => onAction('priority')}>
                {entry.priority ? 'Remove priority' : 'Mark priority'}
              </ActionBtn>
              {(entry.status || 'pending') !== 'converted' && (
                <ActionBtn icon="storefront" tone="violet" onClick={() => onAction('convert')} className="col-span-2">Convert to Merchant</ActionBtn>
              )}
              <ActionBtn icon="delete_forever" tone="red" onClick={() => onAction('delete')} className="col-span-2">Delete Entry</ActionBtn>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-low flex items-center gap-2">
      <span className="material-symbols-outlined text-on-surface-variant/60 text-lg">{icon}</span>
      <h4 className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/80">{title}</h4>
    </div>
    <div className="divide-y divide-outline-variant/10">{children}</div>
  </div>
);

const Row = ({ label, value, mono }) => (
  <div className="px-4 py-3 grid grid-cols-3 gap-3 items-start">
    <div className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">{label}</div>
    <div className={`col-span-2 text-sm text-on-surface ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
  </div>
);

const ActionBtn = ({ icon, tone, onClick, children, className = '' }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
    red:     'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
    blue:    'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    violet:  'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200',
  };
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${toneMap[tone]} ${className}`}>
      <span className="material-symbols-outlined text-base">{icon}</span>
      {children}
    </button>
  );
};

// ── Convert Modal ────────────────────────────────────────────────────
const ConvertModal = ({ state, onClose, onConfirm }) => {
  if (state.done) {
    return (
      <Modal onClose={onClose}>
        <div className="p-7 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">Merchant created</h3>
          <p className="text-sm text-on-surface-variant mb-4">A secure setup invite has been emailed to <strong>{state.done.email}</strong>.</p>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-5 inline-block">
            <p className="text-2xs font-bold uppercase tracking-widest text-emerald-700 mb-1">PayChain Account</p>
            <p className="font-mono text-xl font-bold text-emerald-900">{formatAccountNumber(state.done.ncbaVirtualAccountNumber || state.done.ncbaMerchantCode || 'Pending')}</p>
          </div>
          <div>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg">Done</button>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose}>
      <div className="p-7">
        <div className="w-14 h-14 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">storefront</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-1">Convert to Merchant</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          <strong>{state.entry.businessName}</strong> ({state.entry.email || state.entry.phone}) will be created as a full merchant account.
        </p>
        <div className="text-xs px-3 py-2.5 rounded-lg mb-5 bg-violet-50 text-violet-800 border border-violet-100">
          This will: mint a unique 5-digit account number, generate a secure 24-hour password-setup link, and email it to the merchant. The waitlist entry will be marked as converted.
        </div>
        {state.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{state.error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
          <button onClick={onConfirm} disabled={state.busy} className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50">
            {state.busy ? 'Converting…' : 'Convert & Invite'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const DeleteModal = ({ state, onClose, onConfirm }) => (
  <Modal onClose={onClose}>
    <div className="p-7">
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">delete_forever</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-1">Delete waitlist entry</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        Permanently remove <strong>{state.entry.fullName}</strong> ({state.entry.businessName}) from the waitlist? This cannot be undone.
      </p>
      {state.error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-4">{state.error}</div>}
      <div className="flex gap-3">
        <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button onClick={onConfirm} disabled={state.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
          {state.busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </Modal>
);

const Modal = ({ onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);

export default Waitlist;
