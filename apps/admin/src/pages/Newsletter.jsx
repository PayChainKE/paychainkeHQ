import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { exportCSV } from '../utils/exportCSV';
import api from '../api/api';

const EMAIL_RE = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

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

export default function Newsletter() {
  const [subscribers, setSubscribers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add-subscriber inline form
  const [addEmail, setAddEmail] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [addOk, setAddOk] = useState(false);

  // Search / filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [composeDone, setComposeDone] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Delete confirmation
  const [deleteState, setDeleteState] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subs, camps] = await Promise.all([
        api.get('/api/newsletter'),
        api.get('/api/newsletter/campaigns').catch(() => ({ data: { data: [] } })),
      ]);
      setSubscribers(Array.isArray(subs.data) ? subs.data : []);
      setCampaigns(camps.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load newsletter data.');
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

  // Derived
  const stats = useMemo(() => ({
    total: subscribers.length,
    active: subscribers.filter((s) => s.active).length,
    inactive: subscribers.filter((s) => !s.active).length,
    adminAdded: subscribers.filter((s) => s.source === 'admin').length,
    recent7d: subscribers.filter((s) => (Date.now() - new Date(s.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000).length,
    campaignsSent: campaigns.length,
    lastCampaignAt: campaigns[0]?.sentAt,
  }), [subscribers, campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (q && !s.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subscribers, search, statusFilter]);

  // ── Actions ────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e?.preventDefault();
    setAddError('');
    setAddOk(false);
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAddError('Enter a valid email.'); return; }
    setAddBusy(true);
    try {
      await api.post('/api/newsletter/admin', { email });
      setAddEmail('');
      setAddOk(true);
      setTimeout(() => setAddOk(false), 2200);
      fetchAll();
    } catch (e) {
      setAddError(e?.response?.data?.error || 'Could not add subscriber.');
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleActive(sub) {
    try {
      const res = await api.patch(`/api/newsletter/${sub._id}/toggle`);
      setSubscribers((arr) => arr.map((s) => (s._id === sub._id ? { ...s, active: res.data.data.active } : s)));
    } catch (e) {
      alert(e?.response?.data?.error || 'Could not toggle subscriber.');
    }
  }

  function startDelete(sub) { setDeleteState({ sub, busy: false }); }
  async function confirmDelete() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true }));
    try {
      await api.delete(`/api/newsletter/${deleteState.sub._id}`);
      setSubscribers((arr) => arr.filter((s) => s._id !== deleteState.sub._id));
      setDeleteState(null);
    } catch (e) {
      alert(e?.response?.data?.error || 'Delete failed.');
      setDeleteState(null);
    }
  }

  function openCompose() {
    setComposeSubject('');
    setComposeBody('');
    setComposeError('');
    setComposeDone(null);
    setShowPreview(false);
    setComposeOpen(true);
  }
  async function sendCampaign() {
    setComposeError('');
    if (composeSubject.trim().length < 3) { setComposeError('Subject must be at least 3 characters.'); return; }
    if (composeBody.trim().length < 10) { setComposeError('Body must be at least 10 characters.'); return; }
    if (!confirm(`Send "${composeSubject.trim()}" to ${stats.active} active subscriber${stats.active === 1 ? '' : 's'}?`)) return;
    setComposeBusy(true);
    try {
      const res = await api.post('/api/newsletter/send', {
        subject: composeSubject.trim(),
        body: composeBody,
      });
      if (res.data?.success) {
        setComposeDone(res.data);
        fetchAll();
      } else {
        setComposeError(res.data?.error || 'Send failed.');
      }
    } catch (e) {
      setComposeError(e?.response?.data?.error || 'Send failed.');
    } finally {
      setComposeBusy(false);
    }
  }

  function downloadCsv() {
    const rows = filtered.map((s) => ({
      Email: s.email,
      Status: s.active ? 'Active' : 'Inactive',
      Source: s.source || 'public',
      'Added By': s.addedBy?.email || '',
      'Date Subscribed': s.createdAt ? new Date(s.createdAt).toISOString() : '',
    }));
    exportCSV('paychain-newsletter-subscribers.csv', rows);
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Audience & Campaigns</p>
            </div>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Newsletter</h2>
            <p className="text-on-surface-variant/60 mt-1 text-[13px] md:text-[14px] font-body">Grow your audience, send updates, and track delivery.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCsv} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-low transition-colors shadow-sm uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">file_download</span>
              Export
            </button>
            <button onClick={openCompose} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-widest font-label">
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Compose Newsletter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <StatCard label="Active Subscribers" value={stats.active} icon="group" tone="emerald" />
          <StatCard label="Total" value={stats.total} icon="contacts" tone="primary" />
          <StatCard label="New (7d)" value={stats.recent7d} icon="trending_up" tone="amber" />
          <StatCard label="Campaigns Sent" value={stats.campaignsSent} icon="campaign" tone="violet" />
          <StatCard label="Last Send" value={stats.lastCampaignAt ? relativeTime(stats.lastCampaignAt) : '—'} icon="schedule" tone="blue" isText />
        </div>

        {/* Add subscriber + Search bar */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-editorial">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Add subscriber */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 mb-2">Add subscriber manually</p>
              <form onSubmit={handleAdd} className="flex gap-2">
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => { setAddEmail(e.target.value); setAddError(''); }}
                  placeholder="merchant@example.com"
                  disabled={addBusy}
                  className="flex-1 px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={addBusy || !addEmail.trim()}
                  className="px-4 py-2.5 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add
                </button>
              </form>
              <div className="h-5 mt-1.5">
                {addError && <p className="text-[12px] text-red-600 font-medium">{addError}</p>}
                {addOk && <p className="text-[12px] text-emerald-600 font-medium">✓ Subscriber added.</p>}
                {!addError && !addOk && <p className="text-[11px] text-on-surface-variant/50">Duplicates are automatically rejected.</p>}
              </div>
            </div>
            {/* Search */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 mb-2">Search subscribers</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">search</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by email..."
                    className="w-full pl-9 pr-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 border border-outline-variant/40 rounded-lg text-[12px] font-bold uppercase tracking-widest bg-white outline-none focus:border-primary"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <p className="text-[11px] text-on-surface-variant/50 mt-1.5">Showing {filtered.length} of {stats.total} subscribers</p>
            </div>
          </div>
        </div>

        {/* Subscribers table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Audience</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">Subscribers</h3>
            </div>
          </div>
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="p-10 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse font-body">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <Th>#</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Source</Th>
                    <Th>Subscribed</Th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {filtered.map((s, i) => (
                    <tr key={s._id} className="hover:bg-secondary-container/5 transition-colors group">
                      <td className="px-4 py-3 text-on-surface-variant/40 border-b border-outline-variant/5">{String(i + 1).padStart(3, '0')}</td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <p className="font-bold text-on-surface tracking-tight">{s.email}</p>
                        {s.addedBy?.email && <p className="text-[10px] text-on-surface-variant/50">added by {s.addedBy.email}</p>}
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${
                          s.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                          s.source === 'admin' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {s.source === 'admin' ? 'Manual' : 'Public'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-outline-variant/5 text-on-surface-variant/60">
                        {relativeTime(s.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-outline-variant/5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleActive(s)}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant/60 transition-colors"
                            title={s.active ? 'Pause' : 'Reactivate'}
                          >
                            <span className="material-symbols-outlined text-[16px]">{s.active ? 'pause_circle' : 'play_circle'}</span>
                          </button>
                          <button
                            onClick={() => startDelete(s)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant/60 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant/40">
                        {subscribers.length === 0 ? 'No subscribers yet — add one above or wait for public signups.' : 'No subscribers match this filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Past campaigns */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">History</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">Past Campaigns</h3>
            </div>
            <span className="text-[11px] text-on-surface-variant/40">{campaigns.length} sent</span>
          </div>
          {campaigns.length === 0 ? (
            <div className="p-10 text-center text-on-surface-variant/40 text-sm">No campaigns sent yet. Click "Compose Newsletter" to send your first.</div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {campaigns.map((c) => (
                <div key={c._id} className="px-6 py-4 hover:bg-secondary-container/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-on-surface tracking-tight truncate">{c.subject}</h4>
                      <p className="text-[12px] text-on-surface-variant/60 mt-0.5">
                        Sent {fmtDate(c.sentAt)} by {c.sentByEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Delivered</p>
                        <p className="text-base font-bold text-on-surface tracking-tight">{c.successCount} / {c.recipientCount}</p>
                      </div>
                      {c.failureCount > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Failed</p>
                          <p className="text-base font-bold text-red-700">{c.failureCount}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <ComposeModal
          subject={composeSubject}
          body={composeBody}
          onSubject={setComposeSubject}
          onBody={setComposeBody}
          busy={composeBusy}
          error={composeError}
          done={composeDone}
          activeCount={stats.active}
          preview={showPreview}
          onTogglePreview={() => setShowPreview((p) => !p)}
          onSend={sendCampaign}
          onClose={() => { if (!composeBusy) { setComposeOpen(false); setComposeDone(null); } }}
        />
      )}

      {/* Delete confirmation */}
      {deleteState && (
        <DeleteModal state={deleteState} onClose={() => !deleteState.busy && setDeleteState(null)} onConfirm={confirmDelete} />
      )}
    </Layout>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────
const Th = ({ children }) => (
  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
);

const StatCard = ({ label, value, icon, tone, isText }) => {
  const toneMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    violet:  'bg-violet-50 text-violet-600',
    blue:    'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between shadow-sm transition-all hover:scale-[1.02]">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{label}</p>
        <h3 className={`${isText ? 'text-sm' : 'text-xl md:text-2xl'} font-bold text-on-surface tracking-tight truncate`}>{value}</h3>
      </div>
      <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${toneMap[tone] || toneMap.primary}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="p-6 space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-10 bg-surface-container animate-pulse rounded"></div>
    ))}
  </div>
);

const DeleteModal = ({ state, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">delete</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-1">Delete subscriber</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        Permanently remove <strong>{state.sub.email}</strong> from the newsletter? They'll need to re-subscribe to receive future emails.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button onClick={onConfirm} disabled={state.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
          {state.busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ── Compose Modal ────────────────────────────────────────────────────
const ComposeModal = ({ subject, body, onSubject, onBody, busy, error, done, activeCount, preview, onTogglePreview, onSend, onClose }) => {
  if (done) {
    return (
      <Modal onClose={onClose} maxWidth="max-w-md">
        <div className="p-7 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">mark_email_read</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-1">Campaign sent</h3>
          <p className="text-sm text-on-surface-variant mb-5">{done.message}</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg">Done</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-0.5">Compose newsletter</p>
          <h3 className="text-base font-bold text-on-surface">Reach {activeCount} active subscriber{activeCount === 1 ? '' : 's'}</h3>
        </div>
        <button onClick={onClose} disabled={busy} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant/60 disabled:opacity-40">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            maxLength={200}
            disabled={busy}
            placeholder="What's new at PayChain this month?"
            className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
          />
          <p className="text-[10px] text-on-surface-variant/40 mt-1 text-right">{subject.length}/200</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">Body</label>
            <button
              onClick={onTogglePreview}
              type="button"
              className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="border border-outline-variant/40 rounded-lg bg-white max-h-[300px] overflow-y-auto">
              <div className="bg-[#06201B] px-5 py-4 text-center">
                <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-300 uppercase">PayChain Updates</p>
                <h2 className="text-base font-bold text-white mt-1">{subject || '(no subject)'}</h2>
              </div>
              <div className="p-5 text-[14px] leading-[1.7] text-on-surface whitespace-pre-wrap">{body || '(empty body)'}</div>
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => onBody(e.target.value)}
              rows={10}
              maxLength={50000}
              disabled={busy}
              placeholder="Write your newsletter body. Plain text — paragraphs separated by blank lines will be formatted automatically."
              className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none font-mono disabled:opacity-50"
            />
          )}
          <p className="text-[10px] text-on-surface-variant/40 mt-1">{body.length}/50000 · Plain text with blank-line paragraphs</p>
        </div>

        {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[12px] text-amber-800">
          <strong>Heads up:</strong> This will send <strong>{activeCount}</strong> emails through Resend. You'll be charged accordingly. Inactive subscribers and unsubscribed addresses are skipped.
        </div>
      </div>
      <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-end gap-3 bg-surface-container-low/30">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-[11px] font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button
          onClick={onSend}
          disabled={busy || subject.trim().length < 3 || body.trim().length < 10 || activeCount === 0}
          className="px-5 py-2 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[14px]">send</span>
          {busy ? 'Sending…' : `Send to ${activeCount}`}
        </button>
      </div>
    </Modal>
  );
};

const Modal = ({ onClose, children, maxWidth = 'max-w-md' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden`} onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);
