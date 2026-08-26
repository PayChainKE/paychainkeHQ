import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

// Reuses the same real onboarding-officer review pipeline as apps/officer
// (backend/controllers/officerController.js, /api/officer/applications/*) —
// owner/admin roles are already fully authorized to view and act on every
// application (see officerRoutes.js's `viewOrAct` RBAC comment), they just
// had no page in this dashboard that called the endpoint. Originating a new
// application or claiming one stays officer-only by design (that's the
// officer's specific job), so this admin view is read/decide, not intake.
//
// This list also includes every self-serve merchant (web/mobile signup) —
// they carry no kybStatus/kybDocuments/checklist since they never entered
// officer review, so they show with the synthetic 'self_serve' status below
// and open into a read-only detail view (no approve/reject/checklist
// actions — see KycApplicationDetail.jsx's canDecide) showing whatever
// signup details they do have (KRA PIN, business number, certificate).
const STATUS_META = {
  pending:            { label: 'Pending',            pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  requires_revision:  { label: 'Requires Revision',  pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  approved:           { label: 'Approved',           pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:           { label: 'Rejected',           pill: 'bg-red-50 text-red-700 border-red-200' },
  self_serve:         { label: 'Self-Serve Signup',  pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const RISK_META = {
  low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-700 border-red-200',
};

function ageLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(ms / 60000));
  return `${mins}m ago`;
}

const KycVerification = () => {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [riskTier, setRiskTier] = useState('all');
  const [search, setSearch] = useState('');
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (status !== 'all') params.status = status;
      if (riskTier !== 'all') params.riskTier = riskTier;
      if (search) params.q = search;
      const res = await api.get('/api/officer/applications', { params });
      if (res.data?.success) {
        setApplications(res.data.data || []);
        setTotalApplications(res.data.pagination?.total ?? (res.data.data || []).length);
      } else setError(res.data?.error || 'Could not load the queue.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load the queue.');
    } finally { setLoading(false); }
  }, [status, riskTier, search, page]);

  useEffect(() => { setPage(1); }, [status, riskTier, search]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get('/api/officer/metrics');
      if (res.data?.success) setMetrics(res.data.data);
    } catch (e) { /* stay silent, non-critical */ }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Compliance</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                KYC / KYB Verification
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Welcome back, {admin?.name || admin?.email}. Every merchant's signup details in one place — documents, checklist, and risk tier for officer-reviewed applications, plus KRA PIN, business number, and certificate for self-serve signups.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon="hourglass_empty" label="Pending Verification" value={metrics?.pending ?? '—'} tone="amber" />
          <StatTile icon="restart_alt" label="Resubmitted" value={metrics?.resubmitted ?? '—'} tone="primary" />
          <StatTile icon="today" label="Approved Today" value={metrics?.approvedToday ?? '—'} tone="emerald" />
          <StatTile icon="date_range" label="Approved This Week" value={metrics?.approvedThisWeek ?? '—'} tone="emerald" />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'pending', 'requires_revision', 'approved', 'rejected', 'self_serve'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-widest border transition-all ${
                    status === s ? 'bg-primary text-white border-primary shadow' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                  }`}
                >
                  {s === 'all' ? 'All' : (STATUS_META[s]?.label || s)}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by business, owner, email, or phone"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs"
                />
              </div>
              <select value={riskTier} onChange={(e) => setRiskTier(e.target.value)} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white">
                <option value="all">All risk tiers</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Queue</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{totalApplications} application{totalApplications === 1 ? '' : 's'}</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Business</Th>
                  <Th>Owner</Th>
                  <Th>Status</Th>
                  <Th>Risk</Th>
                  <Th>Submitted</Th>
                  <Th>Claimed By</Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-2.5 border-b border-outline-variant/5"><div className="h-6 bg-surface-container-low rounded animate-pulse"></div></td></tr>
                  ))
                ) : applications.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No applications match this view.'}</td></tr>
                ) : applications.map((app) => (
                  <QueueRow key={app._id} app={app} onOpen={() => navigate(`/kyc-verification/${app._id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-2">
          {loading ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">Loading queue…</div> :
            applications.length === 0 ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">{error || 'No applications match this view.'}</div> :
            applications.map((app) => (
              <QueueCard key={app._id} app={app} onOpen={() => navigate(`/kyc-verification/${app._id}`)} />
            ))}
        </div>

        {totalApplications > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-2xs font-medium text-on-surface-variant/60">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalApplications)} of {totalApplications}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-2xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * PAGE_SIZE >= totalApplications || loading}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-2xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const StatTile = ({ icon, label, value, tone }) => {
  const toneMap = { emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', primary: 'bg-primary/10 text-primary' };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || 'bg-surface-container text-on-surface-variant/70'}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{value}</span>
    </div>
  );
};

const QueueRow = ({ app, onOpen }) => {
  const statusStyle = STATUS_META[app.kybStatus || 'self_serve'];
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors cursor-pointer" onClick={onOpen}>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <p className="font-bold text-on-surface tracking-tight text-xs">{app.businessName}</p>
        <p className="text-2xs text-on-surface-variant/60">{app.businessType || '—'}</p>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <p className="text-xs">{app.name}</p>
        <p className="text-2xs text-on-surface-variant/60">{app.phone} · {app.email}</p>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>{statusStyle.label}</span>
        {app.resubmissionCount > 0 && <span className="ml-1 inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">Resubmitted</span>}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        {app.riskTier ? <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${RISK_META[app.riskTier]}`}>{app.riskTier}</span> : <span className="text-on-surface-variant/40">—</span>}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">{ageLabel(app.submittedAt)}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {app.claimedBy ? (app.claimedBy.name || app.claimedBy.email || 'Claimed') : 'Unclaimed'}
      </td>
    </tr>
  );
};

const QueueCard = ({ app, onOpen }) => {
  const statusStyle = STATUS_META[app.kybStatus || 'self_serve'];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="w-full text-left bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-on-surface text-xs truncate">{app.businessName}</p>
          <p className="text-2xs text-on-surface-variant/60 truncate">{app.name} · {app.phone}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>{statusStyle.label}</span>
            <span className="text-2xs text-on-surface-variant/50">{ageLabel(app.submittedAt)}</span>
          </div>
        </div>
        <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 whitespace-nowrap">
          {app.claimedBy ? (app.claimedBy.name || 'Claimed') : 'Unclaimed'}
        </span>
      </div>
    </div>
  );
};

export default KycVerification;
