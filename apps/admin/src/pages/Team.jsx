import React, { useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';

// Reference team — wired to real backend in a follow-up. Layout reflects the
// future organizational shape so the Onboarding-Officer and CMO consoles
// drop straight in without restructuring this page.
const SEED_TEAM = [
  { name: 'Brandon Mutiti',  email: 'admin@paychain.co.ke',       role: 'Owner',              tier: 'executive',  onboarded: 0,   resolved: 0,   status: 'Active', added: '2026-01-12', location: 'Nairobi, KE' },
  { name: 'Maina Kamau',     email: 'maina.k@paychain.co.ke',     role: 'Super Admin',        tier: 'executive',  onboarded: 142, resolved: 86,  status: 'Active', added: '2025-10-12', location: 'Nairobi, KE' },
  { name: 'Sarah Njeri',     email: 's.njeri@paychain.co.ke',     role: 'Admin',              tier: 'admin',      onboarded: 89,  resolved: 41,  status: 'Active', added: '2025-11-04', location: 'Mombasa, KE' },
  { name: 'David Otieno',    email: 'd.otieno@paychain.co.ke',    role: 'Onboarding Officer', tier: 'onboarding', onboarded: 214, resolved: 12,  status: 'Active', added: '2025-12-15', location: 'Kisumu, KE' },
  { name: 'Kevin Musyoka',   email: 'k.musyoka@paychain.co.ke',   role: 'Onboarding Officer', tier: 'onboarding', onboarded: 156, resolved: 9,   status: 'Active', added: '2026-02-05', location: 'Eldoret, KE' },
  { name: 'Grace Wambui',    email: 'grace.w@paychain.co.ke',     role: 'CMO',                tier: 'marketing',  onboarded: 0,   resolved: 0,   status: 'Active', added: '2026-01-20', location: 'Nairobi, KE' },
  { name: 'Tanya Wanjiku',   email: 't.wanjiku@paychain.co.ke',   role: 'Compliance Analyst', tier: 'admin',      onboarded: 0,   resolved: 27,  status: 'Away',   added: '2026-03-08', location: 'Nairobi, KE' },
];

const ROLE_META = {
  'Owner':              { tone: 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white border-emerald-700/40' },
  'Super Admin':        { tone: 'bg-primary/10 text-primary border-primary/30' },
  'Admin':              { tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Onboarding Officer': { tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  'CMO':                { tone: 'bg-pink-50 text-pink-700 border-pink-200' },
  'Compliance Analyst': { tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  'Viewer':             { tone: 'bg-surface-container text-on-surface-variant border-outline-variant/30' },
};

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
  { id: 'all',        label: 'All',         icon: 'groups' },
  { id: 'executive',  label: 'Executive',   icon: 'star' },
  { id: 'admin',      label: 'Admin',       icon: 'admin_panel_settings' },
  { id: 'onboarding', label: 'Onboarding',  icon: 'how_to_reg' },
  { id: 'marketing',  label: 'Marketing',   icon: 'campaign' },
];

const Team = () => {
  const [tier, setTier] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => {
    return SEED_TEAM.filter((m) => {
      if (tier !== 'all' && m.tier !== tier) return false;
      if (status !== 'all' && m.status.toLowerCase() !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          m.role.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [tier, search, status]);

  const stats = useMemo(() => ({
    total:      SEED_TEAM.length,
    active:     SEED_TEAM.filter((m) => m.status === 'Active').length,
    onboarders: SEED_TEAM.filter((m) => m.tier === 'onboarding').length,
    admins:     SEED_TEAM.filter((m) => m.tier === 'admin' || m.tier === 'executive').length,
    onboarded:  SEED_TEAM.reduce((s, m) => s + m.onboarded, 0),
    resolved:   SEED_TEAM.reduce((s, m) => s + m.resolved,  0),
  }), []);

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
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">People Operations</p>
              </div>
              <h1 className="text-[32px] md:text-[40px] font-bold text-white tracking-tighter font-headline leading-none">
                Team & Roles
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-[13px] md:text-[14px]">
                Operators, officers, analysts and executives building PayChain. Granular access controls coming with the Q3 RBAC release.
              </p>
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg">
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Invite Member
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile icon="groups"          label="Total Members"      value={stats.total} />
          <StatTile icon="bolt"            label="Active Now"         value={stats.active}     tone="emerald" pulse />
          <StatTile icon="admin_panel_settings" label="Admins"        value={stats.admins} />
          <StatTile icon="how_to_reg"      label="Onboarders"         value={stats.onboarders} tone="amber" />
          <StatTile icon="storefront"      label="Merchants Onboarded" value={stats.onboarded.toLocaleString()} />
          <StatTile icon="task_alt"        label="Tickets Resolved"   value={stats.resolved.toLocaleString()} />
        </div>

        {/* Future-console roadmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FUTURE_CONSOLES.map((c) => <FutureConsoleCard key={c.title} {...c} />)}
        </div>

        {/* Filters / search bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {TIER_FILTERS.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTier(tf.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-all ${
                    tier === tf.id ? 'bg-primary text-white border-primary shadow' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{tf.icon}</span>
                  {tf.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or role…"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-[13px]"
                />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-outline-variant/40 rounded-lg text-[12px] font-bold uppercase tracking-widest bg-white">
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="away">Away</option>
              </select>
            </div>
          </div>
        </div>

        {/* Roster — desktop table */}
        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 bg-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Active Roster</p>
              <h3 className="text-base font-bold text-on-surface tracking-tight">{filtered.length} members</h3>
            </div>
            <div className="text-[11px] text-on-surface-variant/50 font-bold uppercase tracking-widest">
              Permissions managed via RBAC (Q3)
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Email</Th>
                  <Th className="text-center">Merchants</Th>
                  <Th className="text-center">Tickets</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant/40 text-sm">No team members match this view.</td></tr>
                ) : filtered.map((m) => <RosterRow key={m.email} member={m} />)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roster — mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant/40 text-sm">No team members match this view.</div>
          ) : filtered.map((m) => <RosterCard key={m.email} member={m} />)}
        </div>

        {/* Departments overview */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-editorial">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Organization</p>
          <h3 className="text-lg font-bold text-on-surface tracking-tight mb-5">Departments</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DeptCard icon="account_balance" name="Executive" lead="Brandon Mutiti" count={2} tone="emerald" />
            <DeptCard icon="admin_panel_settings" name="Operations" lead="Maina Kamau" count={2} tone="primary" />
            <DeptCard icon="how_to_reg" name="Onboarding" lead="David Otieno" count={2} tone="amber" />
            <DeptCard icon="campaign" name="Marketing" lead="Grace Wambui" count={1} tone="pink" />
          </div>
        </div>
      </div>
    </Layout>
  );
};

// ── Roster row (desktop) ────────────────────────────────────────────
const RosterRow = ({ member }) => {
  const roleStyle = ROLE_META[member.role] || ROLE_META.Viewer;
  const initials = member.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors group">
      <td className="px-4 py-3 border-b border-outline-variant/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-xs flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white">
            {initials}
          </div>
          <div>
            <p className="font-bold text-on-surface tracking-tight">{member.name}</p>
            <p className="text-[10px] text-on-surface-variant/50">{member.location}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 border-b border-outline-variant/5">
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${roleStyle.tone}`}>
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3 border-b border-outline-variant/5 text-on-surface-variant/70 text-[12px]">{member.email}</td>
      <td className="px-4 py-3 border-b border-outline-variant/5 text-center font-bold tabular-nums">{member.onboarded || '—'}</td>
      <td className="px-4 py-3 border-b border-outline-variant/5 text-center font-bold tabular-nums">{member.resolved || '—'}</td>
      <td className="px-4 py-3 border-b border-outline-variant/5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
          <span className={`text-[11px] font-bold uppercase tracking-widest ${member.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'}`}>{member.status}</span>
        </div>
      </td>
      <td className="px-4 py-3 border-b border-outline-variant/5 text-[11px] text-on-surface-variant/50">
        {new Date(member.added).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-4 py-3 border-b border-outline-variant/5 text-right">
        <button className="opacity-0 group-hover:opacity-100 text-on-surface-variant/40 hover:text-primary transition-all">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </td>
    </tr>
  );
};

const RosterCard = ({ member }) => {
  const roleStyle = ROLE_META[member.role] || ROLE_META.Viewer;
  const initials = member.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-[14px]">{member.name}</p>
          <p className="text-[12px] text-on-surface-variant/60 truncate">{member.email}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${roleStyle.tone}`}>
              {member.role}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${member.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
              {member.status}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-surface-container-low rounded-lg p-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">Onboarded</p>
          <p className="text-base font-bold tabular-nums">{member.onboarded || '—'}</p>
        </div>
        <div className="bg-surface-container-low rounded-lg p-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">Resolved</p>
          <p className="text-base font-bold tabular-nums">{member.resolved || '—'}</p>
        </div>
      </div>
    </div>
  );
};

// ── KPI stat tile ───────────────────────────────────────────────────
const StatTile = ({ icon, label, value, tone, pulse }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    primary: 'bg-primary/10 text-primary',
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
        <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{value}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
      </div>
    </div>
  );
};

// ── Future Console Card ─────────────────────────────────────────────
const FutureConsoleCard = ({ title, icon, tone, desc, capabilities, eta }) => {
  const toneMap = {
    amber: { bg: 'from-amber-500/15 to-amber-500/5',   ring: 'border-amber-500/30', text: 'text-amber-600',  dot: 'bg-amber-500' },
    pink:  { bg: 'from-pink-500/15 to-pink-500/5',     ring: 'border-pink-500/30',  text: 'text-pink-600',   dot: 'bg-pink-500' },
  };
  const c = toneMap[tone] || toneMap.amber;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} border ${c.ring} p-6`}>
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl bg-white border ${c.ring} flex items-center justify-center ${c.text}`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-outline-variant/30 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
            ETA · {eta}
          </span>
        </div>
        <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1">{title}</h3>
        <p className="text-[12px] text-on-surface-variant/70 mb-4">{desc}</p>
        <ul className="space-y-1.5">
          {capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2 text-[12px] text-on-surface-variant/80">
              <span className={`material-symbols-outlined text-[14px] ${c.text} flex-shrink-0 mt-0.5`}>check_circle</span>
              {cap}
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant/50 font-bold uppercase tracking-widest">Roadmap</span>
          <button disabled className="text-on-surface-variant/40 font-bold uppercase tracking-widest cursor-not-allowed">
            Preview soon →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Department card ─────────────────────────────────────────────────
const DeptCard = ({ icon, name, lead, count, tone }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    primary: 'bg-primary/10 text-primary border-primary/30',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    pink:    'bg-pink-50 text-pink-700 border-pink-200',
  };
  return (
    <div className="rounded-xl border border-outline-variant/20 p-4 bg-white hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${toneMap[tone]}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-on-surface-variant/60">{count} member{count === 1 ? '' : 's'}</span>
      </div>
      <p className="font-bold text-on-surface text-[14px] tracking-tight">{name}</p>
      <p className="text-[11px] text-on-surface-variant/60 mt-0.5">Lead · {lead}</p>
    </div>
  );
};

const Th = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

export default Team;
