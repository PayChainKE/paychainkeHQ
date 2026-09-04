import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

const STATUS_META = {
  active:               { label: 'Active',     pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_verification: { label: 'Unverified', pill: 'bg-gray-100 text-gray-700 border-gray-200' },
  suspended:            { label: 'Suspended',  pill: 'bg-red-50 text-red-700 border-red-200' },
};

const liveAccessMeta = (d) => {
  if (d.liveAccess?.approved) return { label: 'Live Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (d.liveAccess?.requestedAt) return { label: 'Pending Review', pill: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Sandbox Only', pill: 'bg-gray-100 text-gray-700 border-gray-200' };
};

// Ran automatically the moment the developer submitted their live-access
// request (see backend requestLiveAccess) — shown right on the pending
// row so an admin sees a pass/fail signal before ever opening the "Test"
// modal, not just after clicking it.
const AutoTestBadge = ({ developer }) => {
  if (developer.liveAccess?.approved || !developer.liveAccess?.requestedAt) return null;
  const test = developer.liveAccess?.autoTest;
  if (!test) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border bg-gray-100 text-gray-500 border-gray-200" title="The automatic check didn't run — use the Test button to check manually.">
        <span className="material-symbols-outlined text-xs">help</span>
        No auto-check
      </span>
    );
  }
  const passed = test.collectTest?.passed;
  const webhooksPassed = test.webhookTests?.filter((w) => w.passed).length ?? 0;
  const webhooksTotal = test.webhookTests?.length ?? 0;
  const title = [
    `Collect test: ${passed ? 'passed' : 'FAILED'} — ${test.collectTest?.message || ''}`,
    test.noWebhooksRegistered ? 'No webhook registered (polling-only integration).' : `Webhooks: ${webhooksPassed}/${webhooksTotal} acked.`,
  ].join('\n');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}
      title={title}
    >
      <span className="material-symbols-outlined text-xs">{passed ? 'check_circle' : 'error'}</span>
      {passed ? 'Auto-check passed' : 'Auto-check failed'}
    </span>
  );
};

const Developers = () => {
  const { admin: currentAdmin } = useAuth();
  const canManage = currentAdmin?.role === 'owner' || currentAdmin?.role === 'admin';

  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [webhooksDeveloper, setWebhooksDeveloper] = useState(null);
  const [webhooksData, setWebhooksData] = useState(null);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhooksError, setWebhooksError] = useState('');
  const [testDeveloper, setTestDeveloper] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState('');

  const fetchDevelopers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/developers', { params: { pageSize: 500 } });
      if (res.data?.success) setDevelopers(res.data.data || []);
      else setError(res.data?.error || 'Could not load developers.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load developers.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDevelopers(); }, [fetchDevelopers]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); }, []);

  const filtered = useMemo(() => developers.filter((d) => {
    if (liveFilter === 'requested' && !(d.liveAccess?.requestedAt && !d.liveAccess?.approved)) return false;
    if (liveFilter === 'approved' && !d.liveAccess?.approved) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return d.email.toLowerCase().includes(s) || d.companyName.toLowerCase().includes(s) || (d.name || '').toLowerCase().includes(s);
  }), [developers, search, liveFilter]);

  useEffect(() => { setPage(1); }, [search, liveFilter]);

  const pagedDevelopers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const stats = useMemo(() => ({
    total: developers.length,
    pendingReview: developers.filter((d) => d.liveAccess?.requestedAt && !d.liveAccess?.approved).length,
    liveApproved: developers.filter((d) => d.liveAccess?.approved).length,
  }), [developers]);

  async function handleApprove(developer) {
    setBusyId(developer._id);
    try {
      const res = await api.patch(`/api/admin/developers/${developer._id}/approve-live`);
      if (res.data?.success) {
        setDevelopers((arr) => arr.map((d) => (d._id === developer._id ? res.data.developer : d)));
        showToast(`Live access approved for ${developer.companyName}.`);
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not approve live access.');
    } finally { setBusyId(null); }
  }

  async function handleReject(developer) {
    setBusyId(developer._id);
    try {
      const res = await api.patch(`/api/admin/developers/${developer._id}/reject-live`);
      if (res.data?.success) {
        setDevelopers((arr) => arr.map((d) => (d._id === developer._id ? res.data.developer : d)));
        showToast(developer.liveAccess?.approved ? `Live access revoked for ${developer.companyName}.` : `Live access request rejected for ${developer.companyName}.`);
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not update live access.');
    } finally { setBusyId(null); }
  }

  function openIntegrationTest(developer) {
    setTestDeveloper(developer);
    setTestResult(null);
    setTestError('');
  }

  async function runIntegrationTest() {
    if (!testDeveloper) return;
    setTestRunning(true);
    setTestError('');
    try {
      const res = await api.post(`/api/admin/developers/${testDeveloper._id}/run-integration-test`);
      if (res.data?.success) setTestResult(res.data.data);
      else setTestError(res.data?.error || 'Could not run the integration test.');
    } catch (e) {
      setTestError(e?.response?.data?.error || 'Could not run the integration test.');
    } finally { setTestRunning(false); }
  }

  async function openWebhooks(developer) {
    setWebhooksDeveloper(developer);
    setWebhooksData(null);
    setWebhooksError('');
    setWebhooksLoading(true);
    try {
      const res = await api.get(`/api/admin/developers/${developer._id}/webhooks`);
      if (res.data?.success) setWebhooksData(res.data.data || []);
      else setWebhooksError(res.data?.error || 'Could not load webhooks.');
    } catch (e) {
      setWebhooksError(e?.response?.data?.error || 'Could not load webhooks.');
    } finally { setWebhooksLoading(false); }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Developer API</p>
            </div>
            <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
              Developer Accounts
            </h1>
            <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
              Third parties integrating PayChain into their own software. Sandbox/test API keys are self-serve; live keys that move real money require approval here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile icon="code" label="Total Developers" value={stats.total} />
          <StatTile icon="hourglass_top" label="Pending Review" value={stats.pendingReview} tone={stats.pendingReview > 0 ? 'amber' : undefined} pulse={stats.pendingReview > 0} />
          <StatTile icon="verified" label="Live Approved" value={stats.liveApproved} tone="emerald" />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, contact, or email"
              className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs"
            />
          </div>
          <select
            value={liveFilter}
            onChange={(e) => setLiveFilter(e.target.value)}
            className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0"
          >
            <option value="all">All Developers</option>
            <option value="requested">Pending Review</option>
            <option value="approved">Live Approved</option>
          </select>
        </div>

        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Developer Roster</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{filtered.length} developer{filtered.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Company</Th>
                  <Th>Status</Th>
                  <Th>Live Access</Th>
                  <Th>Joined</Th>
                  <Th>Webhooks</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-2.5 border-b border-outline-variant/5"><div className="h-6 bg-surface-container-low rounded animate-pulse"></div></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No developer accounts yet.'}</td></tr>
                ) : pagedDevelopers.map((d) => (
                  <DeveloperRow key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={() => handleApprove(d)} onReject={() => handleReject(d)} onViewWebhooks={() => openWebhooks(d)} onTestIntegration={() => openIntegrationTest(d)} />
                ))}
              </tbody>
            </table>
          </div>
          {!loading && <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}
        </div>

        <div className="md:hidden space-y-2">
          {loading ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">Loading developers…</div> :
            filtered.length === 0 ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">{error || 'No developer accounts yet.'}</div> :
            pagedDevelopers.map((d) => (
              <DeveloperCard key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={() => handleApprove(d)} onReject={() => handleReject(d)} onViewWebhooks={() => openWebhooks(d)} onTestIntegration={() => openIntegrationTest(d)} />
            ))}
          {!loading && filtered.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
              <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
        )}

        {webhooksDeveloper && (
          <WebhooksDrawer
            developer={webhooksDeveloper}
            data={webhooksData}
            loading={webhooksLoading}
            error={webhooksError}
            onClose={() => setWebhooksDeveloper(null)}
          />
        )}

        {testDeveloper && (
          <IntegrationTestDrawer
            developer={testDeveloper}
            result={testResult}
            running={testRunning}
            error={testError}
            onRun={runIntegrationTest}
            onClose={() => setTestDeveloper(null)}
          />
        )}
      </div>
    </Layout>
  );
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const StatTile = ({ icon, label, value, tone, pulse }) => {
  const toneMap = { emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', primary: 'bg-primary/10 text-primary' };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || 'bg-surface-container text-on-surface-variant/70'}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{value}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
      </div>
    </div>
  );
};

const DeveloperActions = ({ developer, canManage, busy, onApprove, onReject }) => {
  if (!canManage) return null;
  const pending = developer.liveAccess?.requestedAt && !developer.liveAccess?.approved;
  const approved = developer.liveAccess?.approved;

  if (pending) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onApprove} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50">
          Approve
        </button>
        <button onClick={onReject} disabled={busy} className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant/70 hover:bg-surface-container-low text-2xs font-bold uppercase tracking-widest disabled:opacity-50">
          Reject
        </button>
      </div>
    );
  }

  if (approved) {
    return (
      <button onClick={onReject} disabled={busy} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-2xs font-bold uppercase tracking-widest disabled:opacity-50">
        Revoke
      </button>
    );
  }

  return <span className="text-2xs text-on-surface-variant/40">No action needed</span>;
};

const DeveloperRow = ({ developer, canManage, busy, onApprove, onReject, onViewWebhooks, onTestIntegration }) => {
  const statusStyle = STATUS_META[developer.status] || STATUS_META.active;
  const liveStyle = liveAccessMeta(developer);
  const initials = (developer.companyName || developer.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors group">
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-2xs flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white">
            {initials}
          </div>
          <div>
            <p className="font-bold text-on-surface tracking-tight text-xs">{developer.companyName}</p>
            <p className="text-2xs text-on-surface-variant/60">{developer.name} · {developer.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
          {statusStyle.label}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${liveStyle.pill}`}>
            {liveStyle.label}
          </span>
          <AutoTestBadge developer={developer} />
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {developer.createdAt ? new Date(developer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <button onClick={onViewWebhooks} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-sm">webhook</span>
          View
        </button>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        <div className="flex items-center justify-end gap-2">
          {canManage && (
            <button onClick={onTestIntegration} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-2xs font-bold uppercase tracking-widest transition-colors">
              <span className="material-symbols-outlined text-sm">science</span>
              Test
            </button>
          )}
          <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} />
        </div>
      </td>
    </tr>
  );
};

const DeveloperCard = ({ developer, canManage, busy, onApprove, onReject, onViewWebhooks, onTestIntegration }) => {
  const statusStyle = STATUS_META[developer.status] || STATUS_META.active;
  const liveStyle = liveAccessMeta(developer);
  const initials = (developer.companyName || developer.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-xs">{developer.companyName}</p>
          <p className="text-2xs text-on-surface-variant/60 truncate">{developer.name} · {developer.email}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>{statusStyle.label}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${liveStyle.pill}`}>{liveStyle.label}</span>
            <AutoTestBadge developer={developer} />
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} />
            <button onClick={onViewWebhooks} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70">
              <span className="material-symbols-outlined text-sm">webhook</span>
              Webhooks
            </button>
            {canManage && (
              <button onClick={onTestIntegration} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-2xs font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">science</span>
                Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DELIVERY_STATUS_META = {
  success:   { label: 'Delivered', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending:   { label: 'Retrying',  pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  failed:    { label: 'Failed',    pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  exhausted: { label: 'Exhausted', pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

// Slide-over panel showing one developer's webhook endpoints and recent
// delivery health — lets support/ops answer "is this integration actually
// receiving events" (an ISP's reconnection flow, a CRM sync) without
// needing raw DB access.
const WebhooksDrawer = ({ developer, data, loading, error, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-outline-variant/10 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Webhooks</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{developer.companyName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-surface-container-low rounded-xl animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-on-surface-variant/50 text-center py-10">This developer hasn't registered any webhook endpoints yet.</p>
          ) : (
            data.map((webhook) => (
              <div key={webhook._id} className="border border-outline-variant/20 rounded-xl overflow-hidden">
                <div className="p-4 bg-surface-container-low/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-on-surface break-all">{webhook.url}</p>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${webhook.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {webhook.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {webhook.events.map((e) => (
                      <span key={e} className="px-1.5 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20 text-2xs font-mono text-on-surface-variant/70">{e}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-2xs text-on-surface-variant/50">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{webhook.deliveryStats.success} delivered</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{webhook.deliveryStats.pending + webhook.deliveryStats.failed} retrying</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{webhook.deliveryStats.exhausted} exhausted</span>
                  </div>
                </div>

                {webhook.recentDeliveries.length > 0 && (
                  <div className="divide-y divide-outline-variant/10">
                    {webhook.recentDeliveries.map((d) => {
                      const meta = DELIVERY_STATUS_META[d.status] || DELIVERY_STATUS_META.pending;
                      return (
                        <div key={d._id} className="px-4 py-2 flex items-center justify-between gap-2 text-2xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                            <span className="font-mono text-on-surface-variant/70 truncate">{d.event}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-on-surface-variant/40">
                            {d.lastResponseCode && <span>{d.lastResponseCode}</span>}
                            <span>{new Date(d.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border ${meta.pill}`}>{meta.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Slide-over panel that lets an admin actually run a developer's
// integration before approving live access, instead of taking their word
// for it — Test 1 fires a real simulated test-mode collect through the same
// pipeline any test API call uses (proves the merchant link + test key are
// set up correctly); Test 2 pings every one of the developer's registered
// webhook endpoints for real (proves their server is reachable and returns
// 2xx). Both zero-risk: test-mode never touches a real rail or balance, and
// webhook pings are the same "Send test event" ping developers already
// trigger on themselves from their own dashboard.
const IntegrationTestDrawer = ({ developer, result, running, error, onRun, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-outline-variant/10 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-indigo-600 mb-0.5">Integration Test</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{developer.companyName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result && !running && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl">science</span>
              </div>
              <p className="text-sm text-on-surface-variant/70 max-w-xs mx-auto mb-5">
                Runs a simulated test-mode collect and pings every registered webhook, so you can verify this integration actually works before approving live access.
              </p>
              <button onClick={onRun} className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-widest">
                Run Test
              </button>
            </div>
          )}

          {running && (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-widest">Running checks…</p>
              <p className="text-2xs text-on-surface-variant/40 mt-1">This can take a few seconds — a simulated payment has to settle.</p>
            </div>
          )}

          {error && !running && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{error}</div>
          )}

          {result && !running && (
            <>
              {result.merchant ? (
                <div className="bg-surface-container-low/60 rounded-lg p-3">
                  <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Linked merchant</p>
                  <p className="text-xs font-bold text-on-surface">{result.merchant.businessName}</p>
                </div>
              ) : null}

              <TestResultCard
                title="1. Simulated test-mode collect"
                subtitle="Proves the merchant link and test API key work end to end"
                passed={result.collectTest.passed}
                message={result.collectTest.message}
              />

              {result.noWebhooksRegistered ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">info</span>
                  <p className="text-xs text-amber-800">
                    No webhook registered yet — this integration will need to poll <code className="font-mono">GET /payments/:id</code> instead, which is a valid alternative but worth confirming with the developer.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">2. Webhook delivery</p>
                  <div className="space-y-2">
                    {result.webhookTests.map((w) => (
                      <TestResultCard
                        key={w.webhookId}
                        title={w.url}
                        mono
                        passed={w.passed}
                        message={w.passed ? `Delivered — HTTP ${w.responseCode}` : (w.error || 'Delivery failed.')}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button onClick={onRun} className="w-full px-4 py-2.5 rounded-lg border border-outline-variant/30 text-on-surface-variant/70 hover:bg-surface-container-low text-2xs font-bold uppercase tracking-widest transition-colors">
                Run again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TestResultCard = ({ title, subtitle, message, passed, mono }) => (
  <div className={`rounded-xl border p-3.5 flex gap-3 ${passed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'}`}>
    <span className={`material-symbols-outlined text-lg shrink-0 ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
      {passed ? 'check_circle' : 'cancel'}
    </span>
    <div className="min-w-0">
      <p className={`text-xs font-bold break-all ${mono ? 'font-mono' : ''} ${passed ? 'text-emerald-800' : 'text-red-800'}`}>{title}</p>
      {subtitle && <p className="text-2xs text-on-surface-variant/50 mt-0.5">{subtitle}</p>}
      <p className={`text-2xs mt-1 ${passed ? 'text-emerald-700/80' : 'text-red-700/80'}`}>{message}</p>
    </div>
  </div>
);

export default Developers;
