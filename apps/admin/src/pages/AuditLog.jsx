import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

// ── Action → display ────────────────────────────────────────────────────
// Friendly labels + icon for each action verb. Anything not listed falls
// back to the action string and a default icon, so adding new audit actions
// in the backend doesn't break the page.
const ACTION_META = {
  'merchant.signup':                          { label: 'Signed up',                icon: 'person_add' },
  'merchant.login.success':                   { label: 'Signed in',                icon: 'login' },
  'merchant.login.biometric':                 { label: 'Signed in (biometric)',    icon: 'fingerprint' },
  'merchant.login.failed':                    { label: 'Failed sign-in',           icon: 'warning' },
  'merchant.login.blocked':                   { label: 'Sign-in blocked',          icon: 'block' },
  'merchant.login.otp_requested':             { label: 'OTP requested',            icon: 'mail' },
  'merchant.password.reset_requested':        { label: 'Password reset requested', icon: 'lock_reset' },
  'merchant.password.reset_attempt_unknown':  { label: 'Reset attempt · unknown',  icon: 'help' },
  'merchant.password.reset_verified':         { label: 'Reset OTP verified',       icon: 'verified' },
  'merchant.password.reset_completed':        { label: 'Password reset',           icon: 'key' },
  'merchant.password.changed':                { label: 'Password changed',         icon: 'password' },
  'merchant.password.change_failed':          { label: 'Password change failed',   icon: 'warning' },
  'merchant.profile.updated':                 { label: 'Profile updated',          icon: 'edit' },
  'merchant.biometrics.enabled':              { label: 'Biometrics enabled',       icon: 'fingerprint' },
  'merchant.biometrics.disabled':             { label: 'Biometrics disabled',     icon: 'fingerprint_off' },
  'admin.merchant.created':                   { label: 'Admin · onboarded',        icon: 'add_business' },
  'admin.merchant.flagged':                   { label: 'Admin · flagged',          icon: 'flag' },
  'admin.merchant.unflagged':                 { label: 'Admin · cleared flag',     icon: 'outlined_flag' },
  'admin.merchant.locked':                    { label: 'Admin · locked',           icon: 'lock' },
  'admin.merchant.unlocked':                  { label: 'Admin · unlocked',         icon: 'lock_open' },
  'admin.merchant.deleted':                   { label: 'Admin · deleted',          icon: 'delete_forever' },
};

const SEVERITY_TONE = {
  info:     'bg-blue-50    text-blue-700   border-blue-200',
  success:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning:  'bg-amber-50   text-amber-700  border-amber-200',
  critical: 'bg-red-50     text-red-700    border-red-200',
};

const CATEGORY_TONE = {
  auth:     'bg-blue-100    text-blue-800',
  security: 'bg-red-100     text-red-800',
  profile:  'bg-violet-100  text-violet-800',
  admin:    'bg-amber-100   text-amber-800',
  wallet:   'bg-emerald-100 text-emerald-800',
  system:   'bg-gray-100    text-gray-700',
};

const ACTOR_TONE = {
  self:   'text-emerald-700',
  admin:  'text-amber-700',
  system: 'text-gray-500',
};

const CATEGORY_OPTIONS = [
  { v: 'all',     l: 'All Categories' },
  { v: 'auth',    l: 'Authentication' },
  { v: 'security',l: 'Security' },
  { v: 'profile', l: 'Profile' },
  { v: 'admin',   l: 'Admin Actions' },
  { v: 'wallet',  l: 'Wallet' },
  { v: 'system',  l: 'System' },
];

const SEVERITY_OPTIONS = [
  { v: 'all',      l: 'All Severities' },
  { v: 'critical', l: 'Critical' },
  { v: 'warning',  l: 'Warning' },
  { v: 'info',     l: 'Info' },
  { v: 'success',  l: 'Success' },
];

const ACTOR_OPTIONS = [
  { v: 'all',    l: 'Any actor' },
  { v: 'self',   l: 'Merchant (self)' },
  { v: 'admin',  l: 'Admin' },
  { v: 'system', l: 'System' },
];

const PLATFORM_OPTIONS = [
  { v: 'all',     l: 'Any platform' },
  { v: 'web',     l: 'Web dashboard' },
  { v: 'mobile',  l: 'Mobile app' },
  { v: 'unknown', l: 'Unknown' },
];

const PLATFORM_META = {
  web:     { label: 'Web',     icon: 'desktop_windows', tone: 'bg-blue-100   text-blue-800   border-blue-200' },
  mobile:  { label: 'Mobile',  icon: 'smartphone',      tone: 'bg-violet-100 text-violet-800 border-violet-200' },
  unknown: { label: 'Unknown', icon: 'help',            tone: 'bg-gray-100   text-gray-700   border-gray-200' },
};

const RANGE_OPTIONS = [
  { v: '24h', l: 'Last 24h', hours: 24 },
  { v: '7d',  l: 'Last 7d',  hours: 24 * 7 },
  { v: '30d', l: 'Last 30d', hours: 24 * 30 },
  { v: 'all', l: 'All time', hours: null },
];

function relTime(iso) {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)       return 'Just now';
  if (sec < 3600)     return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)    return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  if (days < 30)      return `${days}d ago`;
  if (days < 365)     return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function absTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [actor, setActor] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [range, setRange] = useState('7d');
  const [drawerEntry, setDrawerEntry] = useState(null);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (search.trim()) p.q = search.trim();
    if (category !== 'all') p.category = category;
    if (severity !== 'all') p.severity = severity;
    if (actor    !== 'all') p.actor    = actor;
    if (platform !== 'all') p.platform = platform;
    const rangeMeta = RANGE_OPTIONS.find((r) => r.v === range);
    if (rangeMeta?.hours) {
      p.from = new Date(Date.now() - rangeMeta.hours * 60 * 60 * 1000).toISOString();
    }
    return p;
  }, [page, search, category, severity, actor, platform, range]);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/audit-log', { params });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setTotal(res.data.total || 0);
        setKpis(res.data.kpis || null);
      } else {
        setError(res.data?.error || 'Could not load audit log.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  // Reset to page 1 whenever a filter changes (but not when the page itself changes).
  useEffect(() => { setPage(1); }, [search, category, severity, actor, platform, range]);

  function clearFilters() {
    setSearch(''); setCategory('all'); setSeverity('all'); setActor('all'); setPlatform('all'); setRange('7d');
  }

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Audit Log</p>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">
              Every action across PayChain
            </h2>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1">
              Sign-ins, password resets, profile changes, and every admin action — with timestamps, IPs and devices.
            </p>
          </div>
          <button
            onClick={fetchLog}
            className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/20"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>

        {/* KPIs — last 24h, independent of the current filter */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <KpiCard label="24h Events"      value={kpis?.total}        tone="primary" />
          <KpiCard label="Critical"        value={kpis?.critical}     tone="red" />
          <KpiCard label="Warnings"        value={kpis?.warnings}     tone="amber" />
          <KpiCard label="Sign-ins"        value={kpis?.logins}       tone="emerald" />
          <KpiCard label="Failed sign-ins" value={kpis?.failedLogins} tone="amber" />
          <KpiCard label="Password resets" value={kpis?.resets}       tone="red" />
          <KpiCard label="Admin actions"   value={kpis?.adminActions} tone="violet" />
          <KpiCard label="From web"        value={kpis?.webEvents}    tone="primary" icon="desktop_windows" />
          <KpiCard label="From mobile"     value={kpis?.mobileEvents} tone="violet"  icon="smartphone" />
        </div>

        {/* Filters */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-3 md:p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-lg">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, email, action, IP…"
              className="w-full pl-10 pr-3 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>
          <FilterSelect value={range}    onChange={setRange}    options={RANGE_OPTIONS} />
          <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
          <FilterSelect value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
          <FilterSelect value={actor}    onChange={setActor}    options={ACTOR_OPTIONS} />
          <FilterSelect value={platform} onChange={setPlatform} options={PLATFORM_OPTIONS} />
          {(search || category !== 'all' || severity !== 'all' || actor !== 'all' || platform !== 'all' || range !== '7d') && (
            <button
              onClick={clearFilters}
              className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-error px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse font-body">
              <thead>
                <tr className="bg-surface-container-low/60">
                  <Th>When</Th>
                  <Th>Merchant</Th>
                  <Th>Action</Th>
                  <Th>Category</Th>
                  <Th>Platform</Th>
                  <Th>Actor</Th>
                  <Th>IP / Device</Th>
                  <Th className="text-right"></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="8" className="px-3 py-3">
                        <div className="h-5 bg-on-surface/5 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-error text-sm">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-on-surface-variant/40 text-sm">
                      No audit events match the current filters.
                    </td>
                  </tr>
                ) : rows.map((r) => {
                  const meta  = ACTION_META[r.action] || { label: r.action, icon: 'history' };
                  const sevCls = SEVERITY_TONE[r.severity] || SEVERITY_TONE.info;
                  const catCls = CATEGORY_TONE[r.category] || CATEGORY_TONE.system;
                  const actCls = ACTOR_TONE[r.actor?.type] || ACTOR_TONE.system;
                  const platMeta = PLATFORM_META[r.platform] || PLATFORM_META.unknown;
                  return (
                    <tr
                      key={r._id}
                      onClick={() => setDrawerEntry(r)}
                      className="hover:bg-secondary-container/5 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <p className="text-xs font-bold text-on-surface tracking-tight">{relTime(r.createdAt)}</p>
                        <p className="text-2xs text-on-surface-variant/50 mt-0.5">{absTime(r.createdAt)}</p>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        {r.merchantEmail ? (
                          <>
                            <p className="text-xs font-bold text-on-surface tracking-tight truncate max-w-[180px]">{r.merchantName || r.merchantEmail}</p>
                            <p className="text-2xs text-on-surface-variant/60 truncate max-w-[180px]">{r.merchantEmail}</p>
                          </>
                        ) : (
                          <span className="text-2xs text-on-surface-variant/40 italic">— platform —</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <div className="flex items-start gap-2">
                          <span className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 ${
                            r.severity === 'critical' ? 'text-red-600' :
                            r.severity === 'warning'  ? 'text-amber-600' :
                            r.severity === 'success'  ? 'text-emerald-600' : 'text-blue-600'
                          }`}>{meta.icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface tracking-tight">{meta.label}</p>
                            {r.message && (
                              <p className="text-2xs text-on-surface-variant/60 mt-0.5 truncate max-w-[260px]">{r.message}</p>
                            )}
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${sevCls}`}>
                              {r.severity}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest ${catCls}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold border ${platMeta.tone}`}>
                          <span className="material-symbols-outlined text-xs">{platMeta.icon}</span>
                          {platMeta.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <p className={`text-2xs font-bold ${actCls}`}>
                          {r.actor?.type === 'admin' ? r.actor?.name || r.actor?.email || 'admin'
                            : r.actor?.type === 'system' ? 'System'
                            : 'Merchant'}
                        </p>
                        <p className="text-2xs text-on-surface-variant/50 capitalize">{r.actor?.type || 'self'}</p>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                        <p className="text-2xs font-mono text-on-surface-variant/80 truncate max-w-[120px]">{r.ip || '—'}</p>
                        <p className="text-2xs text-on-surface-variant/40 truncate max-w-[140px]">{r.userAgent ? r.userAgent.split(' ')[0] : '—'}</p>
                      </td>
                      <td className="py-2 px-3 border-b border-outline-variant/5 text-right align-middle">
                        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          <div className="px-4 py-2 bg-surface text-2xs text-on-surface-variant/50 font-body border-t border-outline-variant/10">
            Showing {rows.length} of {total} events
          </div>
        </div>
      </div>

      {drawerEntry && <EntryDrawer entry={drawerEntry} onClose={() => setDrawerEntry(null)} />}
    </Layout>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────
const Th = ({ children, className = '' }) => (
  <th className={`py-3 px-3 border-b border-outline-variant/10 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 ${className}`}>
    {children}
  </th>
);

const KPI_TONE = {
  primary: { bg: 'bg-primary/10',     text: 'text-primary' },
  red:     { bg: 'bg-red-50',         text: 'text-red-700' },
  amber:   { bg: 'bg-amber-50',       text: 'text-amber-700' },
  emerald: { bg: 'bg-emerald-50',     text: 'text-emerald-700' },
  violet:  { bg: 'bg-violet-50',      text: 'text-violet-700' },
};

const KpiCard = ({ label, value, tone = 'primary', icon = null }) => {
  const t = KPI_TONE[tone] || KPI_TONE.primary;
  return (
    <div className={`p-3 rounded-xl border border-outline-variant/20 ${t.bg}`}>
      <div className="flex items-center gap-1">
        {icon && <span className={`material-symbols-outlined text-sm ${t.text}`}>{icon}</span>}
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight mt-0.5 ${t.text}`}>
        {value == null ? '—' : value}
      </p>
    </div>
  );
};

const FilterSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0"
  >
    {options.map((o) => (
      <option key={o.v} value={o.v}>{o.l}</option>
    ))}
  </select>
);

const EntryDrawer = ({ entry, onClose }) => {
  const meta = ACTION_META[entry.action] || { label: entry.action, icon: 'history' };
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-outline-variant/10 sticky top-0 bg-white flex items-start justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Audit entry</p>
            <h3 className="text-lg font-bold text-on-surface tracking-tight">{meta.label}</h3>
            <p className="text-xs text-on-surface-variant/60 mt-1">{absTime(entry.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-container-low rounded-lg text-on-surface-variant/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {entry.message && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Summary</p>
              <p className="text-sm text-on-surface leading-relaxed">{entry.message}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Severity" value={entry.severity} mono />
            <DrawerField label="Category" value={entry.category} mono />
            <DrawerField label="Action" value={entry.action} mono />
            <DrawerField label="Actor" value={entry.actor?.type || 'self'} mono />
            <DrawerField label="Platform" value={entry.platform || 'unknown'} mono />
          </div>

          {entry.merchantEmail && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Merchant</p>
              <p className="text-xs font-semibold text-on-surface">{entry.merchantName || '—'}</p>
              <p className="text-xs text-on-surface-variant/60 break-all">{entry.merchantEmail}</p>
            </div>
          )}

          {(entry.ip || entry.userAgent) && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Network</p>
              {entry.ip && <p className="text-xs font-mono text-on-surface break-all">{entry.ip}</p>}
              {entry.userAgent && <p className="text-2xs text-on-surface-variant/60 break-all mt-1">{entry.userAgent}</p>}
            </div>
          )}

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Metadata</p>
              <pre className="text-2xs font-mono bg-surface-container-low p-3 rounded-lg overflow-auto max-h-60">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DrawerField = ({ label, value, mono }) => (
  <div>
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">{label}</p>
    <p className={`text-xs text-on-surface ${mono ? 'font-mono' : 'font-semibold'} break-all`}>{value || '—'}</p>
  </div>
);
