import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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

// Friendly label + icon for each developer-side audit action. Falls back to
// the raw action string for anything not listed (matches AuditLog.jsx's
// ACTION_META fallback behaviour), so a new backend action never breaks
// this drawer.
const DEV_ACTION_META = {
  'developer.registered':                     { label: 'Account created',        icon: 'person_add' },
  'developer.verified':                       { label: 'Email verified',         icon: 'verified' },
  'developer.login.success':                  { label: 'Signed in',              icon: 'login' },
  'developer.login.failed':                   { label: 'Failed sign-in',         icon: 'warning' },
  'developer.login.blocked':                  { label: 'Sign-in blocked',        icon: 'block' },
  'developer.password.reset_requested':       { label: 'Password reset requested', icon: 'lock_reset' },
  'developer.password.reset_attempt_unknown': { label: 'Reset attempt · unknown', icon: 'help' },
  'developer.password.reset_verified':        { label: 'Reset OTP verified',     icon: 'verified' },
  'developer.password.reset_completed':       { label: 'Password reset',         icon: 'key' },
  'developer.api_key.created':                { label: 'API key created',        icon: 'vpn_key' },
  'developer.api_key.revoked':                { label: 'API key revoked',        icon: 'key_off' },
  'developer.webhook.created':                { label: 'Webhook registered',     icon: 'webhook' },
  'developer.merchant_link.verified':         { label: 'Linked merchant account', icon: 'link' },
  'developer.live_access.requested':          { label: 'Requested live access',  icon: 'rocket_launch' },
  'developer.payment.payout_executed':        { label: 'Payout executed (API)',  icon: 'call_made' },
  'admin.developer.live_access_approved':     { label: 'Admin · live access approved', icon: 'check_circle' },
  'admin.developer.live_access_rejected':     { label: 'Admin · live access rejected/revoked', icon: 'cancel' },
  'admin.developer.integration_test_run':     { label: 'Admin · ran integration test', icon: 'science' },
};

const DEV_SEVERITY_TONE = {
  info:     'bg-blue-50    text-blue-700   border-blue-200',
  success:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning:  'bg-amber-50   text-amber-700  border-amber-200',
  critical: 'bg-red-50     text-red-700    border-red-200',
};

const DEV_ACTOR_TONE = {
  self:  'text-emerald-700',
  admin: 'text-amber-700',
};

function relTime(iso) {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  if (days < 30)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Canned email templates so the admin doesn't have to draft a new message
// every time for the same handful of recurring situations. `subject`/`body`
// are functions of the developer doc so they can drop in the company name;
// the admin can still edit both before sending. "Custom" is just a blank
// slate for anything else.
const EMAIL_TEMPLATES = [
  {
    id: 'live_access_approved',
    label: 'Live Access Approved',
    icon: 'check_circle',
    subject: () => 'Your PayChain live API access has been approved',
    body: (d) => `Hi ${d.name || 'there'},\n\nGood news — your live API access request for ${d.companyName} has been approved. You can now generate live API keys from your developer dashboard and start accepting real payments through PayChain.\n\nIf anything comes up while you're integrating, just reply to this email and we'll help you out.\n\nWelcome aboard.\n\n— The PayChain Team`,
  },
  {
    id: 'live_access_rejected',
    label: 'Live Access Rejected',
    icon: 'cancel',
    subject: () => 'Update on your PayChain live access request',
    body: (d) => `Hi ${d.name || 'there'},\n\nThanks for requesting live API access for ${d.companyName}. After review, we're not able to approve it at this time.\n\nReason: [add the specific reason here]\n\nYou're welcome to address this and submit a new request once it's resolved — your sandbox/test access is unaffected in the meantime. Let us know if you have any questions.\n\n— The PayChain Team`,
  },
  {
    id: 'link_merchant_reminder',
    label: 'Link Merchant Account Reminder',
    icon: 'link',
    subject: () => 'Action needed: link your PayChain merchant account',
    body: (d) => `Hi ${d.name || 'there'},\n\nWe noticed ${d.companyName} hasn't linked a PayChain merchant account yet. Your API keys need a linked merchant account to actually move money — until this is done, live payments can't be processed.\n\nYou can link one from your developer dashboard under "Link Merchant Account." It only takes a minute.\n\nLet us know if you need a hand.\n\n— The PayChain Team`,
  },
  {
    id: 'custom',
    label: 'Custom Message',
    icon: 'edit_note',
    subject: () => '',
    body: () => '',
  },
];

// Live access is approved per merchant. These read the per-developer summary
// the API sends (approvedCount / pendingCount), so a developer with one
// approved and one pending merchant shows both.
const approvedCountOf = (d) => d.liveAccess?.approvedCount ?? (d.liveAccess?.approved ? 1 : 0);
const pendingCountOf = (d) => d.liveAccess?.pendingCount ?? (d.liveAccess?.requestedAt && !d.liveAccess?.approved ? 1 : 0);

const liveAccessMeta = (d) => {
  const approved = approvedCountOf(d);
  const pending = pendingCountOf(d);
  const total = d.merchants?.length || 0;
  if (approved > 0) return { label: total > 1 ? `Live Approved · ${approved}/${total}` : 'Live Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (pending > 0) return { label: 'Pending Review', pill: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Sandbox Only', pill: 'bg-gray-100 text-gray-700 border-gray-200' };
};

// Ran automatically the moment the developer submitted their live-access
// request (see backend requestLiveAccess) — shown right on the pending
// row so an admin sees a pass/fail signal before ever opening the "Test"
// modal, not just after clicking it.
const AutoTestBadge = ({ developer }) => {
  if (pendingCountOf(developer) === 0) return null;
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

  // Deep-link from the header's global search (?q=<company or email>) —
  // pre-fills this page's own search box, same as typing it in by hand.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearch(q);
      setSearchParams((p) => { p.delete('q'); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [webhooksDeveloper, setWebhooksDeveloper] = useState(null);
  const [webhooksData, setWebhooksData] = useState(null);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhooksError, setWebhooksError] = useState('');
  const [liveTest, setLiveTest] = useState(null); // { developer, merchant }
  const [testDeveloper, setTestDeveloper] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState('');
  const [activityDeveloper, setActivityDeveloper] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [messagesDeveloper, setMessagesDeveloper] = useState(null);
  const [messagesThread, setMessagesThread] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeTemplateId, setComposeTemplateId] = useState('custom');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState('');

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
    if (liveFilter === 'requested' && pendingCountOf(d) === 0) return false;
    if (liveFilter === 'approved' && approvedCountOf(d) === 0) return false;
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
    pendingReview: developers.filter((d) => pendingCountOf(d) > 0).length,
    liveApproved: developers.filter((d) => approvedCountOf(d) > 0).length,
  }), [developers]);

  async function handleApprove(developer, merchant) {
    setBusyId(developer._id);
    try {
      const res = await api.patch(`/api/admin/developers/${developer._id}/approve-live`, { merchantId: merchant.merchantId });
      if (res.data?.success) {
        setDevelopers((arr) => arr.map((d) => (d._id === developer._id ? res.data.developer : d)));
        showToast(`Live access approved for ${developer.companyName} on ${merchant.businessName || 'the merchant'}.`);
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not approve live access.');
    } finally { setBusyId(null); }
  }

  async function handleReject(developer, merchant) {
    const wasApproved = merchant.liveAccess?.approved;
    if (wasApproved && !window.confirm(`Revoke live access for ${developer.companyName} on ${merchant.businessName || 'this merchant'}? Its live API keys stop working immediately.`)) return;
    setBusyId(developer._id);
    try {
      const res = await api.patch(`/api/admin/developers/${developer._id}/reject-live`, { merchantId: merchant.merchantId });
      if (res.data?.success) {
        setDevelopers((arr) => arr.map((d) => (d._id === developer._id ? res.data.developer : d)));
        showToast(wasApproved ? `Live access revoked for ${developer.companyName} on ${merchant.businessName || 'the merchant'}.` : `Live access request rejected for ${developer.companyName}.`);
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

  async function openActivity(developer) {
    setActivityDeveloper(developer);
    setActivityData(null);
    setActivityError('');
    setActivityLoading(true);
    try {
      const res = await api.get(`/api/admin/developers/${developer._id}/audit-log`, { params: { limit: 100 } });
      if (res.data?.success) setActivityData(res.data.data || []);
      else setActivityError(res.data?.error || 'Could not load activity.');
    } catch (e) {
      setActivityError(e?.response?.data?.error || 'Could not load activity.');
    } finally { setActivityLoading(false); }
  }

  async function openMessages(developer) {
    setMessagesDeveloper(developer);
    setMessagesThread(null);
    setMessagesError('');
    setMessagesLoading(true);
    setSendError('');
    applyTemplate('custom', developer);
    try {
      const res = await api.get(`/api/admin/developers/${developer._id}/messages`);
      if (res.data?.success) setMessagesThread(res.data.data || null);
      else setMessagesError(res.data?.error || 'Could not load messages.');
    } catch (e) {
      setMessagesError(e?.response?.data?.error || 'Could not load messages.');
    } finally { setMessagesLoading(false); }
  }

  function applyTemplate(templateId, developer) {
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[EMAIL_TEMPLATES.length - 1];
    const d = developer || messagesDeveloper;
    setComposeTemplateId(templateId);
    setComposeSubject(template.subject(d || {}));
    setComposeBody(template.body(d || {}));
  }

  async function sendDeveloperEmail() {
    if (!messagesDeveloper) return;
    if (!composeSubject.trim()) { setSendError('Subject is required.'); return; }
    if (composeBody.trim().length < 2) { setSendError('Message cannot be empty.'); return; }
    setSendBusy(true);
    setSendError('');
    try {
      const res = await api.post(`/api/admin/developers/${messagesDeveloper._id}/messages`, {
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
      if (res.data?.success) {
        setMessagesThread(res.data.data);
        applyTemplate('custom', messagesDeveloper);
        showToast(`Email sent to ${messagesDeveloper.companyName}.`);
      } else {
        setSendError(res.data?.error || 'Could not send the email.');
      }
    } catch (e) {
      setSendError(e?.response?.data?.error || 'Could not send the email.');
    } finally { setSendBusy(false); }
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
                  <Th>Integration</Th>
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
                  <DeveloperRow key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={(m) => handleApprove(d, m)} onReject={(m) => handleReject(d, m)} onLiveTest={(m) => setLiveTest({ developer: d, merchant: m })} onViewWebhooks={() => openWebhooks(d)} onTestIntegration={() => openIntegrationTest(d)} onViewActivity={() => openActivity(d)} onEmail={() => openMessages(d)} />
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
              <DeveloperCard key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={(m) => handleApprove(d, m)} onReject={(m) => handleReject(d, m)} onLiveTest={(m) => setLiveTest({ developer: d, merchant: m })} onViewWebhooks={() => openWebhooks(d)} onTestIntegration={() => openIntegrationTest(d)} onViewActivity={() => openActivity(d)} onEmail={() => openMessages(d)} />
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

        {liveTest && (
          <LiveTestDrawer
            developer={liveTest.developer}
            merchant={liveTest.merchant}
            onClose={() => setLiveTest(null)}
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

        {activityDeveloper && (
          <ActivityDrawer
            developer={activityDeveloper}
            data={activityData}
            loading={activityLoading}
            error={activityError}
            onClose={() => setActivityDeveloper(null)}
          />
        )}

        {messagesDeveloper && (
          <MessagesDrawer
            developer={messagesDeveloper}
            thread={messagesThread}
            loading={messagesLoading}
            error={messagesError}
            templateId={composeTemplateId}
            onTemplate={(id) => applyTemplate(id, messagesDeveloper)}
            subject={composeSubject}
            onSubject={setComposeSubject}
            body={composeBody}
            onBody={setComposeBody}
            sendBusy={sendBusy}
            sendError={sendError}
            onSend={sendDeveloperEmail}
            onClose={() => setMessagesDeveloper(null)}
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

// One line per linked merchant: approval is decided merchant by merchant.
const DeveloperActions = ({ developer, canManage, busy, onApprove, onReject, onLiveTest }) => {
  if (!canManage) return null;
  const merchants = developer.merchants || [];
  if (merchants.length === 0) return <span className="text-2xs text-on-surface-variant/40">No merchant linked</span>;

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {merchants.map((m) => {
        const pending = m.liveAccess?.requestedAt && !m.liveAccess?.approved;
        const approved = m.liveAccess?.approved;
        return (
          <div key={m.merchantId} className="flex items-center gap-2">
            <span className="text-2xs text-on-surface-variant/70 max-w-[9rem] truncate" title={m.email || ''}>{m.businessName || 'Merchant'}</span>
            {pending && (
              <>
                <button onClick={() => onApprove(m)} disabled={busy} className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50">Approve</button>
                <button onClick={() => onReject(m)} disabled={busy} className="px-2.5 py-1 rounded-lg border border-outline-variant/40 text-on-surface-variant/70 hover:bg-surface-container-low text-2xs font-bold uppercase tracking-widest disabled:opacity-50">Reject</button>
              </>
            )}
            {approved && (
              <>
                <span className="text-2xs font-bold uppercase tracking-widest text-emerald-600">Live</span>
                <button onClick={() => onReject(m)} disabled={busy} className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-2xs font-bold uppercase tracking-widest disabled:opacity-50">Revoke</button>
              </>
            )}
            {!pending && !approved && <span className="text-2xs text-on-surface-variant/40">Sandbox only</span>}
            <button onClick={() => onLiveTest(m)} disabled={busy} title="Send a small real payment into this merchant to check it end to end" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-2xs font-bold uppercase tracking-widest disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">payments</span>
              Live test
            </button>
          </div>
        );
      })}
    </div>
  );
};

const DeveloperRow = ({ developer, canManage, busy, onApprove, onReject, onLiveTest, onViewWebhooks, onTestIntegration, onViewActivity, onEmail }) => {
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
        <div className="flex items-center gap-1.5">
          <button onClick={onViewWebhooks} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-sm">webhook</span>
            View
          </button>
          <button onClick={onViewActivity} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-sm">manage_history</span>
            Activity
          </button>
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onEmail} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-2xs font-bold uppercase tracking-widest transition-colors">
            <span className="material-symbols-outlined text-sm">mail</span>
            Email
          </button>
          {canManage && (
            <button onClick={onTestIntegration} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-2xs font-bold uppercase tracking-widest transition-colors">
              <span className="material-symbols-outlined text-sm">science</span>
              Test
            </button>
          )}
          <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} onLiveTest={onLiveTest} />
        </div>
      </td>
    </tr>
  );
};

const DeveloperCard = ({ developer, canManage, busy, onApprove, onReject, onLiveTest, onViewWebhooks, onTestIntegration, onViewActivity, onEmail }) => {
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
            <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} onLiveTest={onLiveTest} />
            <button onClick={onEmail} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-2xs font-bold uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">mail</span>
              Email
            </button>
            <button onClick={onViewWebhooks} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70">
              <span className="material-symbols-outlined text-sm">webhook</span>
              Webhooks
            </button>
            <button onClick={onViewActivity} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70">
              <span className="material-symbols-outlined text-sm">manage_history</span>
              Activity
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

// Slide-over panel showing everything a developer has done on their
// account — logins, API key/webhook changes, live-access requests — plus
// the admin-side decisions made on that account (approve/reject live
// access, integration test runs). Backed by GET
// /api/admin/developers/:id/audit-log, which reads the same AuditLog
// collection the merchant-facing Audit Log page does (see
// getDeveloperAuditLog in auditLogController.js).
const ActivityDrawer = ({ developer, data, loading, error, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-outline-variant/10 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Activity Log</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{developer.companyName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-surface-container-low rounded-xl animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-on-surface-variant/50 text-center py-10">No recorded activity for this developer yet.</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {data.map((row) => {
                const meta = DEV_ACTION_META[row.action] || { label: row.action, icon: 'radio_button_checked' };
                const tone = DEV_SEVERITY_TONE[row.severity] || DEV_SEVERITY_TONE.info;
                const actorTone = DEV_ACTOR_TONE[row.actor?.type] || 'text-on-surface-variant/60';
                return (
                  <div key={row._id} className="py-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${tone}`}>
                      <span className="material-symbols-outlined text-sm">{meta.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-on-surface truncate">{meta.label}</p>
                        <span className="text-2xs text-on-surface-variant/40 shrink-0" title={new Date(row.createdAt).toLocaleString()}>{relTime(row.createdAt)}</span>
                      </div>
                      {row.message && <p className="text-2xs text-on-surface-variant/60 mt-0.5 break-words">{row.message}</p>}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`text-2xs font-bold ${actorTone}`}>{row.actor?.type === 'admin' ? (row.actor?.name || 'Admin') : 'Developer'}</span>
                        {row.ip && <span className="text-2xs text-on-surface-variant/30">· {row.ip}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Slide-over panel for emailing a developer directly — pick a canned
// template (or write a custom message), edit it, send, and see everything
// PayChain has sent them so far in one running thread. Backed by
// GET/POST /api/admin/developers/:id/messages (sendDeveloperEmail in
// developerAdminController.js), which stores each send in a Contact
// document via the same Resend-backed pipeline the merchant-facing
// Messages page uses.
//
// Important honesty note, shown in the UI too: this only shows what
// PayChain has SENT. If the developer hits "Reply" in their own email
// client, that reply currently goes straight to the sending admin's own
// inbox — there's no inbound-email webhook anywhere in this codebase yet
// to catch it and thread it back in here.
const MessagesDrawer = ({ developer, thread, loading, error, templateId, onTemplate, subject, onSubject, body, onBody, sendBusy, sendError, onSend, onClose }) => {
  const history = thread?.replies || [];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-outline-variant/10 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-0.5">Email</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{developer.companyName}</h3>
            <p className="text-2xs text-on-surface-variant/50 mt-0.5">{developer.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">Conversation</p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />)}
              </div>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-on-surface-variant/50 text-center py-6 bg-surface-container-low/40 rounded-xl">Nothing sent to this developer yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {history.map((r) => (
                  <div key={r._id || r.sentAt} className="border border-outline-variant/20 rounded-xl p-3 bg-surface-container-low/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-on-surface truncate">{r.subject}</p>
                      <span className="text-2xs text-on-surface-variant/40 shrink-0">{relTime(r.sentAt)}</span>
                    </div>
                    <p className="text-2xs text-on-surface-variant/70 mt-1.5 whitespace-pre-wrap line-clamp-4">{r.body}</p>
                    <p className="text-2xs text-on-surface-variant/40 mt-1.5">Sent by {r.sentByEmail}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-2xs text-on-surface-variant/40 mt-2 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-xs mt-0.5">info</span>
              This shows what PayChain has sent. A developer's email reply doesn't appear here automatically yet — it lands in the sending admin's own inbox.
            </p>
          </div>

          <div className="border-t border-outline-variant/10 pt-5">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">Template</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTemplate(t.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-2xs font-bold uppercase tracking-widest transition-colors ${templateId === t.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-outline-variant/30 text-on-surface-variant/70 hover:bg-surface-container-low'}`}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => onSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 mb-3 bg-surface-container-low border border-outline-variant/20 focus:border-emerald-500 focus:ring-0 rounded-lg text-xs font-semibold"
            />

            <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => onBody(e.target.value)}
              rows={8}
              placeholder="Write your message…"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/20 focus:border-emerald-500 focus:ring-0 rounded-lg text-xs leading-relaxed resize-none"
            />

            {sendError && <p className="text-2xs text-red-600 mt-2">{sendError}</p>}

            <button
              onClick={onSend}
              disabled={sendBusy}
              className="w-full mt-4 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendBusy ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">send</span>
              )}
              {sendBusy ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// A small REAL payment, started by an admin, to check that a developer's merchant
// works end to end: the M-PESA prompt reaches a phone and the money lands in that
// merchant's wallet. Money in only; it never pays anything out. The phone is
// picked from three known parties rather than typed, and the amount is capped by
// the server.
const LiveTestDrawer = ({ developer, merchant, onClose }) => {
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phoneSource, setPhoneSource] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const customPhoneRef = useRef(null);
  const [amount, setAmount] = useState(10);
  const [deliverWebhook, setDeliverWebhook] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null); // { payment, sentTo, diagnostic }
  const [waited, setWaited] = useState(0);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/admin/developers/${developer._id}/live-test/options`, { params: { merchantId: merchant.merchantId } })
      .then((res) => {
        if (cancelled) return;
        setOptions(res.data);
        const first = (res.data.phones || []).find((p) => p.available);
        if (first) setPhoneSource(first.source);
      })
      .catch((e) => !cancelled && setLoadError(e?.response?.data?.error || 'Could not load the test options.'));
    return () => { cancelled = true; };
  }, [developer._id, merchant.merchantId]);

  // Recent tests for this developer (any merchant), so an admin reopening
  // this drawer can see it's already been verified instead of guessing.
  const refreshHistory = useCallback(() => {
    api.get(`/api/admin/developers/${developer._id}/live-test/history`)
      .then((res) => setHistory(res.data.tests || []))
      .catch((e) => setHistoryError(e?.response?.data?.error || 'Could not load past tests.'));
  }, [developer._id]);
  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  // Poll the payment while the M-PESA prompt is open (up to 2.5 minutes).
  const paymentId = test?.payment?.id;
  const status = test?.payment?.status;
  useEffect(() => {
    if (!paymentId || status !== 'pending') return undefined;
    let cancelled = false;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const res = await api.get(`/api/admin/developers/${developer._id}/live-test/${paymentId}`);
        if (!cancelled && res.data?.payment) setTest((t) => ({ ...t, payment: res.data.payment, diagnostic: res.data.diagnostic || t.diagnostic }));
        if (!cancelled && res.data?.payment?.status !== 'pending') refreshHistory();
      } catch { /* keep polling */ }
      if (!cancelled) setWaited(Math.round((Date.now() - startedAt) / 1000));
    };
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [paymentId, status, developer._id]);

  useEffect(() => { if (phoneSource === 'custom') customPhoneRef.current?.focus(); }, [phoneSource]);

  const max = options?.maxAmount || 50;
  const amountNum = Number(amount);
  const amountOk = Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= max;
  const chosen = options?.phones?.find((p) => p.source === phoneSource);
  // Light client-side check only, so the button can enable as the admin types;
  // the server re-validates and normalizes the number before sending anything.
  const customPhoneValid = /^(0|\+?254)[17]\d{8}$/.test(String(customPhone).replace(/[\s-]/g, ''));
  const phoneReady = phoneSource === 'custom' ? customPhoneValid : !!chosen?.available;

  async function start() {
    setError('');
    setStarting(true);
    try {
      const res = await api.post(`/api/admin/developers/${developer._id}/live-test`, {
        merchantId: merchant.merchantId, phoneSource, amount: amountNum, deliverWebhook,
        ...(phoneSource === 'custom' ? { customPhone } : {}),
      });
      setTest({ payment: res.data.payment, sentTo: res.data.sentTo, diagnostic: res.data.diagnostic || null });
      setWaited(0);
      setCopied(false);
      refreshHistory();
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not start the test.');
    } finally { setStarting(false); }
  }

  // A plain-text block an admin can paste straight into a message to the
  // developer — the actual NCBA/Daraja result, not just "it failed," so they
  // aren't left guessing whether the problem is on their side or PayChain's.
  function diagnosticSnippet() {
    if (!test?.payment) return '';
    const p = test.payment;
    const d = test.diagnostic;
    const lines = [
      `PayChain live test — ${developer.companyName}`,
      `Merchant: ${merchant.businessName || merchant.merchantId}`,
      `When: ${new Date(p.createdAt || Date.now()).toLocaleString('en-KE')}`,
      `Amount: KES ${p.amount}`,
      `Sent to: ${test.sentTo || '—'}`,
      `Status: ${p.status}`,
    ];
    if (p.status === 'failed') lines.push(`Reason: ${p.failureReason || 'Unknown'}`);
    if (d?.resultDesc) lines.push(`NCBA result: ${d.resultDesc}`);
    if (d?.ncbaReason) lines.push(`NCBA said: ${d.ncbaReason}`);
    lines.push(`Reference: ${p.reference}`);
    lines.push(`Webhook: ${p.webhooksSent ? 'sent to your endpoint' : 'not sent (admin left it off for this test)'}`);
    return lines.join('\n');
  }

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(diagnosticSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setError('Could not copy — your browser blocked clipboard access.'); }
  }

  const timedOut = status === 'pending' && waited >= 150;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-outline-variant/10 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-0.5">Live test · real money</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{developer.companyName}</h3>
            <p className="text-2xs text-on-surface-variant/60">into {merchant.businessName || 'the merchant'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadError && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{loadError}</div>}
          {!options && !loadError && <p className="text-xs text-on-surface-variant/60 text-center py-8">Loading…</p>}

          {options && !test && (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">warning</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This sends a <strong>real</strong> M-PESA prompt. Whoever approves it is charged, and the money is paid into
                  <strong> {merchant.businessName || 'this merchant'}</strong>'s wallet. It only ever collects money in; it never pays anything out.
                </p>
              </div>

              {historyError && <p className="text-2xs text-red-600">{historyError}</p>}
              {history && history.length > 0 && (
                <div>
                  <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">Recent tests for this developer</p>
                  <div className="rounded-xl border border-outline-variant/20 divide-y divide-outline-variant/10 max-h-40 overflow-y-auto">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 px-3 py-2 text-2xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.status === 'success' ? 'bg-emerald-500' : h.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span className="flex-1 truncate text-on-surface-variant/80">
                          KES {h.amount} into {h.merchant?.businessName || 'a merchant'} {h.testedBy ? `by ${h.testedBy}` : ''}
                        </span>
                        <span className="text-on-surface-variant/40 shrink-0" title={new Date(h.createdAt).toLocaleString()}>{relTime(h.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 mb-2">Send the prompt to</p>
                <div className="space-y-2">
                  {options.phones.map((p) => p.source === 'custom' ? (
                    <label key={p.source} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer border-outline-variant/30 hover:bg-surface-container-low ${phoneSource === p.source ? 'ring-2 ring-amber-300' : ''}`}>
                      <input type="radio" name="phoneSource" checked={phoneSource === p.source} onChange={() => setPhoneSource(p.source)} />
                      <span className="flex-1 text-xs font-bold text-on-surface">{p.label}</span>
                      <input
                        ref={customPhoneRef}
                        type="tel"
                        inputMode="tel"
                        placeholder="0712345678"
                        value={customPhone}
                        onFocus={() => setPhoneSource('custom')}
                        onChange={(e) => { setCustomPhone(e.target.value); setPhoneSource('custom'); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-32 rounded-lg border border-outline-variant/30 px-2 py-1 text-2xs font-mono text-on-surface"
                      />
                    </label>
                  ) : (
                    // Even when this party has no valid number on file, the row stays
                    // clickable: tapping it drops straight into "type a number" instead
                    // of sitting there disabled and doing nothing.
                    <label
                      key={p.source}
                      onClick={() => { if (!p.available) setPhoneSource('custom'); }}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer border-outline-variant/30 hover:bg-surface-container-low ${(phoneSource === p.source && p.available) ? 'ring-2 ring-amber-300' : ''}`}
                    >
                      <input type="radio" name="phoneSource" disabled={!p.available} checked={phoneSource === p.source} onChange={() => setPhoneSource(p.source)} />
                      <span className="flex-1 text-xs font-bold text-on-surface">{p.label}</span>
                      <span className="text-2xs font-mono text-on-surface-variant/60">{p.available ? p.hint : 'no number on file — tap to type one'}</span>
                    </label>
                  ))}
                </div>
                {phoneSource === 'custom' && customPhone && !customPhoneValid && (
                  <p className="text-2xs text-red-600 mt-1.5">Enter a valid Kenyan number, e.g. 0712345678.</p>
                )}
              </div>

              <div>
                <label className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 block mb-2">Amount (KES, up to {max})</label>
                <input type="number" min={1} max={max} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-bold text-on-surface" />
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-outline-variant/20 p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={deliverWebhook} onChange={(e) => setDeliverWebhook(e.target.checked)} />
                <span className="text-xs text-on-surface-variant/80 leading-relaxed">
                  Also send the payment webhook to the developer's endpoints. Leave off unless you're testing their webhook;
                  their system will receive a real-looking event marked <code className="font-mono">origin: admin_test</code>.
                </span>
              </label>

              {error && <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">{error}</div>}

              <button onClick={start} disabled={starting || !phoneReady || !amountOk} className="w-full px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-widest">
                {starting ? 'Sending…' : `Send real KES ${amountOk ? amountNum : '…'} prompt${phoneReady ? ` to ${phoneSource === 'custom' ? customPhone : chosen.hint}` : ''}`}
              </button>
            </>
          )}

          {test && (
            <div className="space-y-3">
              {status === 'pending' && !timedOut && (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm font-bold text-on-surface">Approve the M-PESA prompt on {test.sentTo}</p>
                  <p className="text-2xs text-on-surface-variant/50 mt-1">Waiting… {waited}s</p>
                </div>
              )}
              {status === 'pending' && timedOut && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">
                  Still pending after 2.5 minutes. It may still complete. Check {merchant.businessName || 'the merchant'}'s transactions before trying again.
                </div>
              )}
              {status === 'success' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5"><span className="material-symbols-outlined text-lg">check_circle</span>Received KES {test.payment.amount}</p>
                  <p className="text-xs text-emerald-800 mt-1">Paid into {merchant.businessName || 'the merchant'}'s wallet. {test.payment.webhooksSent ? 'The payment webhook was sent to the developer.' : 'No webhook was sent to the developer.'}</p>
                </div>
              )}
              {status === 'failed' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-700 flex items-center gap-1.5"><span className="material-symbols-outlined text-lg">error</span>Payment failed</p>
                  <p className="text-xs text-red-800 mt-1">{test.payment.failureReason || 'The prompt was cancelled or timed out.'}</p>
                  {test.diagnostic?.ncbaReason && <p className="text-2xs text-red-700/80 mt-1">NCBA said: {test.diagnostic.ncbaReason}</p>}
                </div>
              )}
              <p className="text-2xs text-on-surface-variant/40 font-mono">Reference {test.payment.reference}</p>

              {status !== 'pending' && (
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                      {status === 'success' ? 'Share the result' : 'Share with the developer'}
                    </p>
                    <button onClick={copyDiagnostic} className="text-2xs font-bold text-amber-700 hover:text-amber-600 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-2xs font-mono text-on-surface-variant/70 whitespace-pre-wrap leading-relaxed">{diagnosticSnippet()}</pre>
                </div>
              )}

              {status !== 'pending' && (
                <button onClick={() => { setTest(null); setError(''); }} className="w-full px-4 py-2.5 rounded-lg border border-outline-variant/30 text-on-surface-variant/70 hover:bg-surface-container-low text-2xs font-bold uppercase tracking-widest">
                  Run another test
                </button>
              )}
            </div>
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
