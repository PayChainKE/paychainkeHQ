import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { exportCSV } from '../utils/exportCSV';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';
import NewsletterComposer from '../components/newsletter/NewsletterComposer';

const PAGE_SIZE = 25;
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
  const [page, setPage] = useState(1);
  const [campaignPage, setCampaignPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [composeDone, setComposeDone] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Draft being edited (null = new, unsaved campaign) + the content it
  // seeds the composer's editor with when continuing one.
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [composeInitialContent, setComposeInitialContent] = useState('');
  const [draftStatus, setDraftStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [discardDraftState, setDiscardDraftState] = useState(null); // { draft, busy } | null

  // Delete confirmation
  const [deleteState, setDeleteState] = useState(null);

  // Send-campaign confirmation (replaces window.confirm)
  const [pendingSend, setPendingSend] = useState(null); // { htmlBody } | null

  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

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

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await api.get('/api/newsletter/drafts');
      setDrafts(res.data?.data || []);
    } catch {
      // Non-critical — drafts list just stays empty/stale rather than
      // blocking the rest of the page.
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

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

  useEffect(() => { setPage(1); }, [search, statusFilter]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const pagedCampaigns = useMemo(() => campaigns.slice((campaignPage - 1) * PAGE_SIZE, campaignPage * PAGE_SIZE), [campaigns, campaignPage]);

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
      showToast(e?.response?.data?.error || 'Could not toggle subscriber.');
    }
  }

  function startDelete(sub) { setDeleteState({ sub, busy: false }); }
  async function confirmDelete() {
    if (!deleteState) return;
    setDeleteState((s) => ({ ...s, busy: true, error: '' }));
    try {
      await api.delete(`/api/newsletter/${deleteState.sub._id}`);
      setSubscribers((arr) => arr.filter((s) => s._id !== deleteState.sub._id));
      setDeleteState(null);
    } catch (e) {
      setDeleteState((s) => ({ ...s, busy: false, error: e?.response?.data?.error || 'Delete failed.' }));
    }
  }

  function openCompose() {
    setComposeSubject('');
    setComposeBody('');
    setComposeInitialContent('');
    setActiveDraftId(null);
    setDraftStatus(null);
    setComposeError('');
    setComposeDone(null);
    setShowPreview(false);
    setComposeOpen(true);
  }

  function continueDraft(draft) {
    setComposeSubject(draft.subject || '');
    setComposeBody('');
    setComposeInitialContent(draft.body || '');
    setActiveDraftId(draft._id);
    setDraftStatus(null);
    setComposeError('');
    setComposeDone(null);
    setShowPreview(false);
    setComposeOpen(true);
  }

  async function saveDraft(html) {
    setDraftStatus('saving');
    try {
      const res = await api.post('/api/newsletter/drafts', {
        draftId: activeDraftId,
        subject: composeSubject,
        body: html,
      });
      setActiveDraftId(res.data?.data?._id || activeDraftId);
      setDraftStatus('saved');
      fetchDrafts();
      setTimeout(() => setDraftStatus((s) => (s === 'saved' ? null : s)), 3000);
    } catch (e) {
      setDraftStatus('error');
      showToast(e?.response?.data?.error || 'Could not save draft.');
    }
  }

  function startDiscardDraft(draft) { setDiscardDraftState({ draft, busy: false }); }
  async function confirmDiscardDraft() {
    if (!discardDraftState) return;
    setDiscardDraftState((s) => ({ ...s, busy: true }));
    try {
      await api.delete(`/api/newsletter/drafts/${discardDraftState.draft._id}`);
      setDrafts((arr) => arr.filter((d) => d._id !== discardDraftState.draft._id));
      if (activeDraftId === discardDraftState.draft._id) setActiveDraftId(null);
      setDiscardDraftState(null);
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not discard draft.');
      setDiscardDraftState(null);
    }
  }

  function sendCampaign(htmlBody) {
    setComposeError('');
    if (composeSubject.trim().length < 3) { setComposeError('Subject must be at least 3 characters.'); return; }
    setPendingSend({ htmlBody });
  }

  async function confirmSendCampaign() {
    if (!pendingSend) return;
    setComposeBusy(true);
    try {
      const res = await api.post('/api/newsletter/send', {
        subject: composeSubject.trim(),
        body: pendingSend.htmlBody,
        htmlMode: true,   // rich HTML from the editor is passed through to Resend as-is
        draftId: activeDraftId, // backend deletes the draft this was composed from, if any
      });
      if (res.data?.success) {
        setComposeDone(res.data);
        setActiveDraftId(null);
        fetchAll();
        fetchDrafts();
      } else {
        setComposeError(res.data?.error || 'Send failed.');
      }
    } catch (e) {
      setComposeError(e?.response?.data?.error || 'Send failed.');
    } finally {
      setComposeBusy(false);
      setPendingSend(null);
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
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Audience & Campaigns</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">Newsletter</h2>
            <p className="text-on-surface-variant/60 mt-1 text-xs md:text-sm font-body">Grow your audience, send updates, and track delivery.</p>
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
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 mb-2">Add subscriber manually</p>
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
                  className="px-4 py-2.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add
                </button>
              </form>
              <div className="h-5 mt-1.5">
                {addError && <p className="text-xs text-red-600 font-medium">{addError}</p>}
                {addOk && <p className="text-xs text-emerald-600 font-medium">✓ Subscriber added.</p>}
                {!addError && !addOk && <p className="text-2xs text-on-surface-variant/50">Duplicates are automatically rejected.</p>}
              </div>
            </div>
            {/* Search */}
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 mb-2">Search subscribers</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
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
                  className="px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white outline-none focus:border-primary"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <p className="text-2xs text-on-surface-variant/50 mt-1.5">Showing {filtered.length} of {stats.total} subscribers</p>
            </div>
          </div>
        </div>

        {/* Subscribers table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Audience</p>
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
                <tbody className="text-xs">
                  {paged.map((s, i) => (
                    <tr key={s._id} className="hover:bg-secondary-container/5 transition-colors group">
                      <td className="px-3 py-2 text-on-surface-variant/40 border-b border-outline-variant/5 text-2xs tabular-nums">{String((page - 1) * PAGE_SIZE + i + 1).padStart(3, '0')}</td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <p className="font-bold text-on-surface tracking-tight">{s.email}</p>
                        {s.addedBy?.email && <p className="text-2xs text-on-surface-variant/50">added by {s.addedBy.email}</p>}
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold border uppercase tracking-widest ${
                          s.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${
                          s.source === 'admin' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {s.source === 'admin' ? 'Manual' : 'Public'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-outline-variant/5 text-on-surface-variant/60 text-2xs">
                        {relativeTime(s.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right border-b border-outline-variant/5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleActive(s)}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant/60 transition-colors"
                            title={s.active ? 'Pause' : 'Reactivate'}
                          >
                            <span className="material-symbols-outlined text-base">{s.active ? 'pause_circle' : 'play_circle'}</span>
                          </button>
                          <button
                            onClick={() => startDelete(s)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant/60 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
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
              <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
            </div>
          )}
        </div>

        {/* Drafts — unfinished campaigns saved for later */}
        {(draftsLoading || drafts.length > 0) && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">In progress</p>
                <h3 className="text-base font-bold text-on-surface tracking-tight">Drafts</h3>
              </div>
              {drafts.length > 0 && (
                <span className="text-2xs font-bold text-on-surface-variant/40 bg-surface-container px-2.5 py-1 rounded-full">{drafts.length} saved</span>
              )}
            </div>
            {draftsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-surface-container animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/8">
                {drafts.map((d) => (
                  <div key={d._id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-secondary-container/5 transition-colors group">
                    <button onClick={() => continueDraft(d)} className="min-w-0 flex-1 text-left">
                      <p className="font-bold text-on-surface tracking-tight truncate text-sm">{d.subject?.trim() || '(no subject)'}</p>
                      <p className="text-2xs text-on-surface-variant/50 truncate mt-0.5">
                        {d.snippet || '(empty)'}
                      </p>
                      <p className="text-2xs text-on-surface-variant/40 mt-1">
                        Last edited {relativeTime(d.updatedAt)}{d.updatedByEmail ? ` · ${d.updatedByEmail}` : ''}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => continueDraft(d)}
                        className="px-3 py-1.5 rounded-lg text-2xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors">
                        Continue
                      </button>
                      <button onClick={() => startDiscardDraft(d)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant/60 hover:text-red-600 transition-colors" title="Discard draft">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past campaigns — delivery status */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">History</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">Campaign Delivery Status</h3>
            </div>
            <div className="flex items-center gap-3">
              {campaigns.length > 0 && (
                <div className="hidden sm:flex items-center gap-4 text-2xs font-bold text-on-surface-variant/50">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Delivered</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Failed</span>
                </div>
              )}
              <span className="text-2xs font-bold text-on-surface-variant/40 bg-surface-container px-2.5 py-1 rounded-full">{campaigns.length} sent</span>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant/40">No campaigns sent yet</p>
              <p className="text-xs text-on-surface-variant/30">Click "Compose Newsletter" to reach your subscribers.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-outline-variant/8">
                {pagedCampaigns.map((c, idx) => (
                  <CampaignRow key={c._id} campaign={c} index={(campaignPage - 1) * PAGE_SIZE + idx} />
                ))}
              </div>
              <TablePagination page={campaignPage} pageSize={PAGE_SIZE} total={campaigns.length} onPage={setCampaignPage} />
            </>
          )}
        </div>
      </div>

      {/* Compose — rich email editor */}
      {composeOpen && (
        <NewsletterComposer
          subject={composeSubject}
          onSubject={setComposeSubject}
          activeCount={stats.active}
          busy={composeBusy}
          error={composeError}
          done={composeDone}
          onSend={sendCampaign}
          onClose={() => { if (!composeBusy) { setComposeOpen(false); setComposeDone(null); } }}
          initialContent={composeInitialContent}
          draftStatus={draftStatus}
          onSaveDraft={saveDraft}
        />
      )}

      {/* Delete confirmation */}
      {deleteState && (
        <DeleteModal state={deleteState} onClose={() => !deleteState.busy && setDeleteState(null)} onConfirm={confirmDelete} />
      )}

      {/* Discard draft confirmation */}
      {discardDraftState && (
        <Modal onClose={() => !discardDraftState.busy && setDiscardDraftState(null)} maxWidth="max-w-md">
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Discard draft?</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Permanently delete the draft "<strong>{discardDraftState.draft.subject?.trim() || '(no subject)'}</strong>"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDiscardDraftState(null)} disabled={discardDraftState.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
              <button onClick={confirmDiscardDraft} disabled={discardDraftState.busy} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50">
                {discardDraftState.busy ? 'Discarding…' : 'Discard'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Send-campaign confirmation */}
      {pendingSend && (
        <Modal onClose={() => !composeBusy && setPendingSend(null)} maxWidth="max-w-md">
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">send</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Send campaign?</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Send "<strong>{composeSubject.trim()}</strong>" to <strong>{stats.active}</strong> active subscriber{stats.active === 1 ? '' : 's'}? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPendingSend(null)} disabled={composeBusy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
              <button onClick={confirmSendCampaign} disabled={composeBusy} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg disabled:opacity-50">
                {composeBusy ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
      )}
    </Layout>
  );
}

// ── Campaign delivery status row ──────────────────────────────────────
function deliveryStatus(successCount, failureCount, recipientCount) {
  if (recipientCount === 0) return { label: 'No Recipients', color: 'gray', icon: 'help' };
  const rate = successCount / recipientCount;
  if (rate === 1)   return { label: 'All Delivered',   color: 'emerald', icon: 'check_circle' };
  if (rate >= 0.9)  return { label: 'High Delivery',   color: 'emerald', icon: 'check_circle' };
  if (rate >= 0.5)  return { label: 'Partial Delivery', color: 'amber',  icon: 'warning' };
  if (rate > 0)     return { label: 'Low Delivery',    color: 'orange',  icon: 'error' };
  return             { label: 'Blocked / Failed',      color: 'red',     icon: 'cancel' };
}

const statusStyles = {
  emerald: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500', icon: 'text-emerald-600' },
  amber:   { badge: 'bg-amber-50  text-amber-700  border-amber-200',   bar: 'bg-amber-400',   dot: 'bg-amber-400',   icon: 'text-amber-600'  },
  orange:  { badge: 'bg-orange-50 text-orange-700 border-orange-200',  bar: 'bg-orange-400',  dot: 'bg-orange-400',  icon: 'text-orange-600' },
  red:     { badge: 'bg-red-50    text-red-700    border-red-200',     bar: 'bg-red-400',     dot: 'bg-red-400',     icon: 'text-red-600'    },
  gray:    { badge: 'bg-gray-50   text-gray-600   border-gray-200',    bar: 'bg-gray-300',    dot: 'bg-gray-400',    icon: 'text-gray-500'   },
};

const CampaignRow = ({ campaign: c, index }) => {
  const { successCount = 0, failureCount = 0, recipientCount = 0 } = c;
  const { label, color, icon } = deliveryStatus(successCount, failureCount, recipientCount);
  const styles = statusStyles[color];
  const deliveredPct = recipientCount > 0 ? Math.round((successCount / recipientCount) * 100) : 0;
  const failedPct    = recipientCount > 0 ? Math.round((failureCount  / recipientCount) * 100) : 0;

  return (
    <div className="px-6 py-5 hover:bg-secondary-container/5 transition-colors group">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* Left: index + subject */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center mt-0.5">
            <span className="text-2xs font-black text-on-surface-variant/40 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h4 className="font-bold text-on-surface tracking-tight truncate text-sm">{c.subject}</h4>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-widest border ${styles.badge}`}>
                <span className="material-symbols-outlined text-2xs" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                {label}
              </span>
            </div>
            <p className="text-2xs text-on-surface-variant/50 mb-3">
              Sent {fmtDate(c.sentAt)}
              {c.sentByEmail && <> · <span className="font-medium">{c.sentByEmail}</span></>}
            </p>

            {/* Delivery bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs font-bold text-on-surface-variant/50 uppercase tracking-widest">
                <span>Delivery rate</span>
                <span className={color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : color === 'red' ? 'text-red-600' : 'text-orange-600'}>
                  {deliveredPct}%
                </span>
              </div>
              {/* The bar — stacked: delivered (green) + failed (red) */}
              <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-700 ${styles.bar}`}
                  style={{ width: `${deliveredPct}%` }}
                />
                {failedPct > 0 && (
                  <div
                    className="h-full bg-red-300 transition-all duration-700"
                    style={{ width: `${failedPct}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: metric chips */}
        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5 flex-shrink-0 pl-10 sm:pl-0">
          {/* Delivered */}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
            <span className="material-symbols-outlined text-emerald-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
            <span className="text-emerald-800 font-black text-xs tabular-nums">{successCount.toLocaleString()}</span>
            <span className="text-emerald-600/60 text-2xs font-bold">/ {recipientCount.toLocaleString()}</span>
          </div>
          {/* Failed — only shown when > 0 */}
          {failureCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
              <span className="material-symbols-outlined text-red-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>unsubscribe</span>
              <span className="text-red-700 font-black text-xs tabular-nums">{failureCount.toLocaleString()}</span>
              <span className="text-red-500/60 text-2xs font-bold">failed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Bits ──────────────────────────────────────────────────────────────
const Th = ({ children }) => (
  <th className="px-4 py-3 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{children}</th>
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
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{label}</p>
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
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary mb-0.5">Compose newsletter</p>
          <h3 className="text-base font-bold text-on-surface">Reach {activeCount} active subscriber{activeCount === 1 ? '' : 's'}</h3>
        </div>
        <button onClick={onClose} disabled={busy} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant/60 disabled:opacity-40">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            maxLength={200}
            disabled={busy}
            placeholder="What's new at PayChain this month?"
            className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
          />
          <p className="text-2xs text-on-surface-variant/40 mt-1 text-right">{subject.length}/200</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">Body</label>
            <button
              onClick={onTogglePreview}
              type="button"
              className="text-2xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="border border-outline-variant/40 rounded-lg bg-white max-h-[300px] overflow-y-auto">
              <div className="bg-[#06201B] px-5 py-4 text-center">
                <p className="text-2xs font-bold tracking-[0.3em] text-emerald-300 uppercase">PayChain Updates</p>
                <h2 className="text-base font-bold text-white mt-1">{subject || '(no subject)'}</h2>
              </div>
              <div className="p-5 text-sm leading-[1.7] text-on-surface whitespace-pre-wrap">{body || '(empty body)'}</div>
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
          <p className="text-2xs text-on-surface-variant/40 mt-1">{body.length}/50000 · Plain text with blank-line paragraphs</p>
        </div>

        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
          <strong>Heads up:</strong> This will send <strong>{activeCount}</strong> emails through Resend. You'll be charged accordingly. Inactive subscribers and unsubscribed addresses are skipped.
        </div>
      </div>
      <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-end gap-3 bg-surface-container-low/30">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">Cancel</button>
        <button
          onClick={onSend}
          disabled={busy || subject.trim().length < 3 || body.trim().length < 10 || activeCount === 0}
          className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">send</span>
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
