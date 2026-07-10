import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { v: 'owner',   label: 'Owner',   desc: 'Full control. Can manage other team members and all platform settings.' },
  { v: 'admin',   label: 'Admin',   desc: 'Day-to-day operations: merchants, waitlist, messages, ledger.' },
  { v: 'analyst', label: 'Analyst', desc: 'Read-only access to insights, ledger, and audit data.' },
];

const ROLE_META = {
  owner:   { tone: 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-emerald-700/40' },
  admin:   { tone: 'bg-primary/10 text-primary border-primary/30' },
  analyst: { tone: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const STATUS_META = {
  active:   { label: 'Active',   pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
  inactive: { label: 'Inactive', pill: 'bg-gray-100 text-gray-700 border-gray-200',         dot: 'bg-gray-500' },
  pending:  { label: 'Pending',  pill: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
};

// Roadmap cards — surfaces the planned per-role consoles so the team page
// communicates where the platform is heading. These are presentational, not
// data, and intentionally separate from the live roster.
const FUTURE_CONSOLES = [
  {
    title: 'Onboarding Officer Console',
    icon: 'how_to_reg',
    tone: 'amber',
    desc: 'Dedicated workspace for officers to onboard merchants, drive KYB checklists, request additional documents, and approve activations.',
    capabilities: ['Queue of pending merchants', 'In-app KYB checklist + doc capture', 'Side-by-side document viewer', 'Approve / reject with reason', 'Officer leaderboard'],
    eta: 'Q3 2026',
  },
  {
    title: 'CMO Marketing Console',
    icon: 'campaign',
    tone: 'pink',
    desc: 'Marketing command-center to schedule newsletters, run drip campaigns, A/B test subject lines, segment audiences, and track funnel KPIs.',
    capabilities: ['Scheduled campaigns + cron', 'Segmentation by region / vertical', 'A/B subject testing', 'Funnel + open/click analytics', 'Press & investor distribution lists'],
    eta: 'Q4 2026',
  },
];

const TIER_FILTERS = [
  { id: 'all',     label: 'All',     icon: 'groups' },
  { id: 'owner',   label: 'Owners',  icon: 'star' },
  { id: 'admin',   label: 'Admins',  icon: 'admin_panel_settings' },
  { id: 'analyst', label: 'Analysts', icon: 'analytics' },
];

const Team = () => {
  const { admin: currentAdmin } = useAuth();
  const isOwner = currentAdmin?.role === 'owner';

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tier, setTier] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/team');
      if (res.data?.success) setMembers(res.data.data || []);
      else setError(res.data?.error || 'Could not load team.');
    } catch (e) {
      const code = e?.response?.status;
      setError(e?.response?.data?.error || (code === 404 ? 'Team endpoint not deployed yet. Push backend changes and retry.' : 'Could not load team.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  useEffect(() => {
    const h = () => fetchTeam();
    window.addEventListener('paychain:sync', h);
    return () => window.removeEventListener('paychain:sync', h);
  }, [fetchTeam]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); }, []);

  function exportCsv() {
    if (filtered.length === 0) { showToast('Nothing to export.'); return; }
    const rows = filtered.map((m) => ({
      Name: m.name || '',
      Email: m.email,
      Role: m.role,
      Status: m.status,
      'Merchants Onboarded': m.stats?.merchantsOnboarded ?? 0,
      'Tickets Resolved': m.stats?.ticketsResolved ?? 0,
      'Calls Handled': m.stats?.callsHandled ?? 0,
      'Login Count': m.loginCount ?? 0,
      'Last Login': m.lastLogin ? new Date(m.lastLogin).toISOString() : '',
      Joined: m.createdAt ? new Date(m.createdAt).toISOString() : '',
    }));
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
    a.download = `paychain-team-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => members.filter((m) => {
    if (tier !== 'all' && m.role !== tier) return false;
    if (status !== 'all' && m.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.email.toLowerCase().includes(s) || (m.name || '').toLowerCase().includes(s) || m.role.toLowerCase().includes(s);
    }
    return true;
  }), [members, tier, status, search]);

  const stats = useMemo(() => ({
    total:      members.length,
    active:     members.filter((m) => m.status === 'active').length,
    pending:    members.filter((m) => m.status === 'pending').length,
    owners:     members.filter((m) => m.role === 'owner').length,
    onboarded:  members.reduce((s, m) => s + (m.stats?.merchantsOnboarded || 0), 0),
    resolved:   members.reduce((s, m) => s + (m.stats?.ticketsResolved || 0), 0),
  }), [members]);

  async function handleUpdate(id, patch) {
    try {
      const res = await api.patch(`/api/admin/team/${id}`, patch);
      if (res.data?.success) {
        setMembers((arr) => arr.map((m) => m._id === id ? { ...m, ...res.data.data, stats: m.stats } : m));
        showToast('Saved.');
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not update.');
    }
  }
  async function handleRemove(member) {
    try {
      const res = await api.delete(`/api/admin/team/${member._id}`);
      if (res.data?.success) {
        setMembers((arr) => arr.filter((m) => m._id !== member._id));
        setEditing(null);
        showToast('Member removed.');
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not remove.');
    }
  }
  async function handleResend(member) {
    try {
      const res = await api.post(`/api/admin/team/${member._id}/resend-invite`);
      if (res.data?.success) showToast('Invite re-sent.');
      else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not resend.');
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-emerald-400/10 rounded-full blur-2xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">People Operations</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                Team & Roles
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Operators, analysts and owners running PayChain. Only the workspace owner can invite, edit, or remove members.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCsv} className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all">
                <span className="material-symbols-outlined text-base">file_download</span>
                Export CSV
              </button>
              {isOwner && (
                <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg">
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Invite Member
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile icon="groups"          label="Total Members"      value={stats.total} />
          <StatTile icon="bolt"            label="Active Now"         value={stats.active}    tone="emerald" pulse />
          <StatTile icon="hourglass_empty" label="Pending Invites"    value={stats.pending}   tone="amber" />
          <StatTile icon="star"            label="Owners"             value={stats.owners} />
          <StatTile icon="storefront"      label="Merchants Onboarded" value={stats.onboarded.toLocaleString()} />
          <StatTile icon="task_alt"        label="Tickets Resolved"   value={stats.resolved.toLocaleString()} />
        </div>

        {/* Roadmap — upcoming per-role consoles */}
        <div>
          <div className="flex items-center gap-3 mb-3 text-slate-400">
            <span className="text-2xs font-bold uppercase tracking-widest font-label">Coming Soon · Role Consoles</span>
            <div className="flex-1 h-[1px] bg-outline-variant/10"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FUTURE_CONSOLES.map((c) => <FutureConsoleCard key={c.title} {...c} />)}
          </div>
        </div>

        {/* Filters / search */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {TIER_FILTERS.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTier(tf.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-widest border transition-all ${
                    tier === tf.id ? 'bg-primary text-white border-primary shadow' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{tf.icon}</span>
                  {tf.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or role"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs"
                />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-xs font-bold uppercase tracking-widest bg-white">
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Roster — desktop */}
        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/10 bg-white flex items-center justify-between">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Active Roster</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">{filtered.length} member{filtered.length === 1 ? '' : 's'}</h3>
            </div>
            {!isOwner && <div className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40">Read-only · owner controls hidden</div>}
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th className="text-center">Merchants</Th>
                  <Th className="text-center">Tickets</Th>
                  <Th className="text-center">Calls</Th>
                  <Th>Joined</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No team members match this view.'}</td></tr>
                ) : filtered.map((m) => (
                  <RosterRow
                    key={m._id}
                    member={m}
                    isSelf={String(m._id) === String(currentAdmin?._id)}
                    isOwner={isOwner}
                    onEdit={() => setEditing(m)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roster — mobile */}
        <div className="md:hidden space-y-2">
          {loading ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">Loading team…</div> :
            filtered.length === 0 ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">{error || 'No team members match this view.'}</div> :
            filtered.map((m) => (
              <RosterCard
                key={m._id}
                member={m}
                isSelf={String(m._id) === String(currentAdmin?._id)}
                isOwner={isOwner}
                onEdit={() => setEditing(m)}
              />
            ))}
        </div>

        {/* Invite modal */}
        {inviteOpen && isOwner && (
          <InviteModal onClose={() => setInviteOpen(false)} onInvited={(m) => { setMembers((arr) => [m, ...arr.filter((x) => x._id !== m._id)]); setInviteOpen(false); showToast('Invite sent.'); }} />
        )}

        {/* Edit drawer */}
        {editing && (
          <EditDrawer
            member={editing}
            isSelf={String(editing._id) === String(currentAdmin?._id)}
            isOwner={isOwner}
            onClose={() => setEditing(null)}
            onSave={(patch) => handleUpdate(editing._id, patch)}
            onRemove={() => handleRemove(editing)}
            onResend={() => handleResend(editing)}
          />
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-on-inverse-surface px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
        )}
      </div>
    </Layout>
  );
};

// ── Invite modal ────────────────────────────────────────────────────
const InviteModal = ({ onClose, onInvited }) => {
  const [email, setEmail] = useState('');
  const [name, setName]   = useState('');
  const [role, setRole]   = useState('admin');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Enter a valid email.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/api/admin/team', { email: email.trim(), name: name.trim(), role });
      if (res.data?.success) onInvited({ ...res.data.data, stats: { merchantsOnboarded: 0, ticketsResolved: 0, callsHandled: 0 } });
      else setErr(res.data?.error || 'Could not invite.');
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not invite.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">Invite team member</p>
          <h3 className="text-xl font-bold tracking-tight">Send an invite</h3>
          <p className="text-xs text-emerald-100/60 mt-1">A secure link valid for 48 hours will be emailed to set their password.</p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4" autoComplete="off">
          <Field label="Email" required>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Display Name" hint="Optional. Member can update later.">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} />
          </Field>
          <Field label="Role" required hint="Owners can manage other team members. Admins handle daily ops. Analysts are read-only.">
            <div className="space-y-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.v} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${role === r.v ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50'}`}>
                  <input type="radio" name="role" value={r.v} checked={role === r.v} onChange={() => setRole(r.v)} className="mt-1 accent-primary" />
                  <div>
                    <p className="font-bold text-xs text-on-surface tracking-tight">{r.label}</p>
                    <p className="text-2xs text-on-surface-variant/60">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </Field>
          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">send</span>
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit drawer ─────────────────────────────────────────────────────
const EditDrawer = ({ member, isSelf, isOwner, onClose, onSave, onRemove, onResend }) => {
  const [name, setName] = useState(member.name || '');
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const dirty = name !== (member.name || '') || role !== member.role || status !== member.status;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        <div className="bg-gradient-to-br from-[#06201B] to-[#0a3029] p-6 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">Team Member</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base font-bold ring-2 ring-emerald-500/40 overflow-hidden">
              {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : (member.name || member.email).split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight truncate">{member.name || member.email}</h3>
              <p className="text-xs text-emerald-100/60 truncate">{member.email}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailPill label="Merchants" value={(member.stats?.merchantsOnboarded ?? 0).toLocaleString()} />
            <DetailPill label="Tickets"   value={(member.stats?.ticketsResolved ?? 0).toLocaleString()} />
            <DetailPill label="Calls"     value={(member.stats?.callsHandled ?? 0).toLocaleString()} />
            <DetailPill label="Logins"    value={(member.loginCount ?? 0).toLocaleString()} />
            <DetailPill label="Last login" value={fmtDate(member.lastLogin)} />
            <DetailPill label="Joined"    value={fmtDate(member.createdAt, true)} />
          </div>

          {member.status === 'pending' && isOwner && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 text-xl flex-shrink-0 mt-0.5">hourglass_empty</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-900">Invite pending</p>
                <p className="text-2xs text-amber-800">Member hasn't accepted yet. Resend the invite if they didn't receive it.</p>
                <button onClick={onResend} className="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-2xs font-bold uppercase tracking-widest hover:bg-amber-700 transition-all">
                  Resend invite
                </button>
              </div>
            </div>
          )}

          <Field label="Display Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} maxLength={80} className={`${inputClass} ${!isOwner ? 'opacity-60 cursor-not-allowed' : ''}`} />
          </Field>

          <Field label="Role" hint={isSelf ? 'You cannot demote yourself if you are the only owner.' : 'Changing role takes effect immediately on next request.'}>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!isOwner} className={`w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold bg-white ${!isOwner ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {ROLE_OPTIONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Field>

          <Field label="Status" hint="Inactive members cannot sign in.">
            <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!isOwner} className={`w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold bg-white ${!isOwner ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              {member.status === 'pending' && <option value="pending">Pending</option>}
            </select>
          </Field>

          {isOwner && confirmingRemove && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-bold text-red-900">Remove {member.email}? This cannot be undone.</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={() => setConfirmingRemove(false)} className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant text-2xs font-bold uppercase tracking-widest hover:bg-white transition-all">
                  Cancel
                </button>
                <button onClick={onRemove} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest transition-all flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Yes, remove
                </button>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
              <button onClick={() => setConfirmingRemove(true)} disabled={isSelf || confirmingRemove} className="text-2xs font-bold uppercase tracking-widest text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-sm">delete</span>
                Remove member
              </button>
              <button
                onClick={() => onSave({ name, role, status })}
                disabled={!dirty}
                className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Save changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Atoms ───────────────────────────────────────────────────────────
const inputClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-2xs text-on-surface-variant/50 mt-1">{hint}</p>}
  </div>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const DetailPill = ({ label, value }) => (
  <div className="bg-surface-container-low rounded-lg px-3 py-2">
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{label}</p>
    <p className="text-xs font-bold text-on-surface tracking-tight">{value}</p>
  </div>
);

const SkeletonRow = () => (
  <tr>
    <td colSpan={8} className="px-3 py-2.5 border-b border-outline-variant/5">
      <div className="h-6 bg-surface-container-low rounded animate-pulse"></div>
    </td>
  </tr>
);

const RosterRow = ({ member, isSelf, isOwner, onEdit }) => {
  const roleStyle = ROLE_META[member.role] || ROLE_META.admin;
  const statusStyle = STATUS_META[member.status] || STATUS_META.active;
  const initials = (member.name || member.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors group">
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-2xs flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white overflow-hidden">
            {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          <div>
            <p className="font-bold text-on-surface tracking-tight text-xs">{member.name || '—'}{isSelf && <span className="ml-1.5 text-2xs font-bold text-primary uppercase tracking-widest">You</span>}</p>
            <p className="text-2xs text-on-surface-variant/60">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${roleStyle.tone}`}>
          {member.role}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
          {statusStyle.label}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center font-bold tabular-nums text-xs">{(member.stats?.merchantsOnboarded ?? 0) || '—'}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center font-bold tabular-nums text-xs">{(member.stats?.ticketsResolved ?? 0) || '—'}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center font-bold tabular-nums text-xs">{(member.stats?.callsHandled ?? 0) || '—'}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {member.createdAt ? new Date(member.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        <button onClick={onEdit} className="text-on-surface-variant/40 hover:text-primary transition-all">
          <span className="material-symbols-outlined text-lg">{isOwner ? 'edit' : 'visibility'}</span>
        </button>
      </td>
    </tr>
  );
};

const RosterCard = ({ member, isSelf, isOwner, onEdit }) => {
  const roleStyle = ROLE_META[member.role] || ROLE_META.admin;
  const statusStyle = STATUS_META[member.status] || STATUS_META.active;
  const initials = (member.name || member.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button onClick={onEdit} className="w-full text-left bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white overflow-hidden flex-shrink-0">
          {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-xs">{member.name || '—'}{isSelf && <span className="ml-1.5 text-2xs font-bold text-primary uppercase tracking-widest">You</span>}</p>
          <p className="text-2xs text-on-surface-variant/60 truncate">{member.email}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${roleStyle.tone}`}>
              {member.role}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
              {statusStyle.label}
            </span>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
      </div>
    </button>
  );
};

// ── KPI tile ────────────────────────────────────────────────────────
const StatTile = ({ icon, label, value, tone, pulse }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    primary: 'bg-primary/10 text-primary',
  };
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
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
      </div>
    </div>
  );
};

const FutureConsoleCard = ({ title, icon, tone, desc, capabilities, eta }) => {
  const toneMap = {
    amber: { bg: 'from-amber-500/15 to-amber-500/5', ring: 'border-amber-500/30', text: 'text-amber-600', dot: 'bg-amber-500' },
    pink:  { bg: 'from-pink-500/15 to-pink-500/5',   ring: 'border-pink-500/30',  text: 'text-pink-600',  dot: 'bg-pink-500' },
  };
  const c = toneMap[tone] || toneMap.amber;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} border ${c.ring} p-5 md:p-6`}>
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl bg-white border ${c.ring} flex items-center justify-center ${c.text}`}>
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-outline-variant/30 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70">
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
            ETA · {eta}
          </span>
        </div>
        <h3 className="text-base md:text-lg font-bold text-on-surface tracking-tight mb-1">{title}</h3>
        <p className="text-xs text-on-surface-variant/70 mb-4">{desc}</p>
        <ul className="space-y-1.5">
          {capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2 text-xs text-on-surface-variant/80">
              <span className={`material-symbols-outlined text-sm ${c.text} flex-shrink-0 mt-0.5`}>check_circle</span>
              {cap}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

function fmtDate(iso, dateOnly) {
  if (!iso) return '—';
  const d = new Date(iso);
  return dateOnly ? d.toLocaleDateString() : d.toLocaleString();
}

export default Team;
