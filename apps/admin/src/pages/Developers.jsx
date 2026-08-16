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
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-3 py-2.5 border-b border-outline-variant/5"><div className="h-6 bg-surface-container-low rounded animate-pulse"></div></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No developer accounts yet.'}</td></tr>
                ) : pagedDevelopers.map((d) => (
                  <DeveloperRow key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={() => handleApprove(d)} onReject={() => handleReject(d)} />
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
              <DeveloperCard key={d._id} developer={d} canManage={canManage} busy={busyId === d._id} onApprove={() => handleApprove(d)} onReject={() => handleReject(d)} />
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

const DeveloperRow = ({ developer, canManage, busy, onApprove, onReject }) => {
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${liveStyle.pill}`}>
          {liveStyle.label}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {developer.createdAt ? new Date(developer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} />
      </td>
    </tr>
  );
};

const DeveloperCard = ({ developer, canManage, busy, onApprove, onReject }) => {
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
          </div>
          <div className="mt-3">
            <DeveloperActions developer={developer} canManage={canManage} busy={busy} onApprove={onApprove} onReject={onReject} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Developers;
