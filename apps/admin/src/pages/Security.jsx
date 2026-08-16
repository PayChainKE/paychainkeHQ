import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import TablePagination from '../components/ui/TablePagination';

const PAGE_SIZE = 25;

const ALERT_TYPE_META = {
  otp_lockout:         { label: 'OTP Lockout',            icon: 'lock_clock' },
  pin_lockout:          { label: 'PIN Lockout',            icon: 'pin' },
  large_transaction:    { label: 'Large Transaction',      icon: 'payments' },
  new_admin_account:    { label: 'New Admin Account',      icon: 'admin_panel_settings' },
  new_officer_account:  { label: 'New Officer Account',    icon: 'how_to_reg' },
  developer_live_access_requested: { label: 'Developer Live Access Requested', icon: 'api' },
};

const SEVERITY_TONE = {
  info:     'bg-blue-50    text-blue-700   border-blue-200',
  warning:  'bg-amber-50   text-amber-700  border-amber-200',
  critical: 'bg-red-50     text-red-700    border-red-200',
};

const TYPE_OPTIONS = [
  { v: 'all',                  l: 'All Types' },
  { v: 'otp_lockout',          l: 'OTP Lockout' },
  { v: 'pin_lockout',          l: 'PIN Lockout' },
  { v: 'large_transaction',    l: 'Large Transaction' },
  { v: 'new_admin_account',    l: 'New Admin Account' },
  { v: 'new_officer_account',  l: 'New Officer Account' },
  { v: 'developer_live_access_requested', l: 'Developer Live Access Requested' },
];

const SEVERITY_OPTIONS = [
  { v: 'all',      l: 'All Severities' },
  { v: 'critical', l: 'Critical' },
  { v: 'warning',  l: 'Warning' },
  { v: 'info',     l: 'Info' },
];

const STATUS_OPTIONS = [
  { v: 'all',    l: 'All Statuses' },
  { v: 'false',  l: 'Needs review' },
  { v: 'true',   l: 'Acknowledged' },
];

const SENTRY_LEVEL_TONE = {
  fatal:   'bg-red-100    text-red-800',
  error:   'bg-red-50     text-red-700',
  warning: 'bg-amber-50   text-amber-700',
  info:    'bg-blue-50    text-blue-700',
  debug:   'bg-gray-100   text-gray-600',
};

function relTime(iso) {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const days = Math.floor(sec / 86400);
  if (days < 30)   return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function absTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Security() {
  const [view, setView] = useState('alerts');

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8 pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary">Security</p>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">
              Security Operations
            </h2>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1">
              Account lockouts, large transfers, new privileged accounts — and live error monitoring across every PayChain surface.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-1">
            <TabButton active={view === 'alerts'}     onClick={() => setView('alerts')}     icon="notifications_active" label="Alerts" />
            <TabButton active={view === 'monitoring'} onClick={() => setView('monitoring')} icon="monitor_heart"        label="Monitoring" />
          </div>
        </div>

        {view === 'alerts' ? <AlertsPanel /> : <MonitoringPanel />}
      </div>
    </Layout>
  );
}

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest transition-colors ${
      active ? 'bg-primary text-white shadow-editorial' : 'text-on-surface-variant/60 hover:text-on-surface'
    }`}
  >
    <span className="material-symbols-outlined text-base">{icon}</span>
    {label}
  </button>
);

// ── Alerts panel ────────────────────────────────────────────────────────
function AlertsPanel() {
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('all');
  const [drawerEntry, setDrawerEntry] = useState(null);
  const [acking, setAcking] = useState(null);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (search.trim()) p.q = search.trim();
    if (type !== 'all') p.type = type;
    if (severity !== 'all') p.severity = severity;
    if (status !== 'all') p.acknowledged = status;
    return p;
  }, [page, search, type, severity, status]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/security-alerts', { params });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setTotal(res.data.total || 0);
        setKpis(res.data.kpis || null);
      } else {
        setError(res.data?.error || 'Could not load security alerts.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load security alerts.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { setPage(1); }, [search, type, severity, status]);

  async function acknowledge(id) {
    setAcking(id);
    try {
      const res = await api.patch(`/api/admin/security-alerts/${id}/acknowledge`);
      if (res.data?.success) {
        setRows((prev) => prev.map((r) => (r._id === id ? res.data.data : r)));
        setDrawerEntry((prev) => (prev && prev._id === id ? res.data.data : prev));
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'Could not acknowledge alert.');
    } finally {
      setAcking(null);
    }
  }

  function clearFilters() {
    setSearch(''); setType('all'); setSeverity('all'); setStatus('all');
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="24h Alerts"      value={kpis?.total}          tone="primary" icon="notifications" />
        <KpiCard label="Critical"        value={kpis?.critical}       tone="red"     icon="report" />
        <KpiCard label="Warnings"        value={kpis?.warnings}       tone="amber"   icon="warning" />
        <KpiCard label="Needs Review"    value={kpis?.unacknowledged} tone="violet"  icon="visibility" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-3 md:p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center mt-6">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-lg">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, heading, details…"
            className="w-full pl-10 pr-3 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40"
          />
        </div>
        <FilterSelect value={type}     onChange={setType}     options={TYPE_OPTIONS} />
        <FilterSelect value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
        <FilterSelect value={status}   onChange={setStatus}   options={STATUS_OPTIONS} />
        {(search || type !== 'all' || severity !== 'all' || status !== 'all') && (
          <button onClick={clearFilters} className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-error px-2">
            Clear
          </button>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-editorial mt-4">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse font-body">
            <thead>
              <tr className="bg-surface-container-low/60">
                <Th>When</Th>
                <Th>Alert</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}><td colSpan="5" className="px-3 py-3"><div className="h-5 bg-on-surface/5 rounded animate-pulse" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan="5" className="py-10 text-center text-error text-sm">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5" className="py-10 text-center text-on-surface-variant/40 text-sm">No security alerts match the current filters.</td></tr>
              ) : rows.map((r) => {
                const meta = ALERT_TYPE_META[r.type] || { label: r.type, icon: 'notifications' };
                const sevCls = SEVERITY_TONE[r.severity] || SEVERITY_TONE.info;
                return (
                  <tr key={r._id} onClick={() => setDrawerEntry(r)} className="hover:bg-secondary-container/5 transition-colors cursor-pointer">
                    <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                      <p className="text-xs font-bold text-on-surface tracking-tight">{relTime(r.createdAt)}</p>
                      <p className="text-2xs text-on-surface-variant/50 mt-0.5">{absTime(r.createdAt)}</p>
                    </td>
                    <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                      <div className="flex items-start gap-2">
                        <span className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 ${
                          r.severity === 'critical' ? 'text-red-600' : r.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                        }`}>{meta.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface tracking-tight">{r.subject}</p>
                          <p className="text-2xs text-on-surface-variant/60 mt-0.5 truncate max-w-[360px]">{r.heading}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest border ${sevCls}`}>{r.severity}</span>
                    </td>
                    <td className="py-2 px-3 border-b border-outline-variant/5 align-top">
                      {r.acknowledged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                          <span className="material-symbols-outlined text-xs">check_circle</span>Reviewed
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); acknowledge(r._id); }}
                          disabled={acking === r._id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                        >
                          <span className={`material-symbols-outlined text-xs ${acking === r._id ? 'animate-spin' : ''}`}>{acking === r._id ? 'progress_activity' : 'radio_button_unchecked'}</span>
                          Needs review
                        </button>
                      )}
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
          Showing {rows.length} of {total} alerts
        </div>
      </div>

      {drawerEntry && <AlertDrawer entry={drawerEntry} onClose={() => setDrawerEntry(null)} onAcknowledge={acknowledge} acking={acking} />}
    </>
  );
}

const AlertDrawer = ({ entry, onClose, onAcknowledge, acking }) => {
  const meta = ALERT_TYPE_META[entry.type] || { label: entry.type, icon: 'notifications' };
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-outline-variant/10 sticky top-0 bg-white flex items-start justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{meta.label}</p>
            <h3 className="text-lg font-bold text-on-surface tracking-tight">{entry.subject}</h3>
            <p className="text-xs text-on-surface-variant/60 mt-1">{absTime(entry.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-container-low rounded-lg text-on-surface-variant/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Details</p>
            <p className="text-sm text-on-surface leading-relaxed" dangerouslySetInnerHTML={{ __html: entry.details }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Severity" value={entry.severity} mono />
            <DrawerField label="Type" value={meta.label} mono />
          </div>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Context</p>
              <pre className="text-2xs font-mono bg-surface-container-low p-3 rounded-lg overflow-auto max-h-60">{JSON.stringify(entry.metadata, null, 2)}</pre>
            </div>
          )}
          <div className="pt-2 border-t border-outline-variant/10">
            {entry.acknowledged ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Reviewed by {entry.acknowledgedBy?.name || entry.acknowledgedBy?.email || 'an admin'} · {absTime(entry.acknowledgedAt)}
              </div>
            ) : (
              <button
                onClick={() => onAcknowledge(entry._id)}
                disabled={acking === entry._id}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <span className={`material-symbols-outlined text-base ${acking === entry._id ? 'animate-spin' : ''}`}>{acking === entry._id ? 'progress_activity' : 'check_circle'}</span>
                Mark as reviewed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Monitoring panel (Sentry) ───────────────────────────────────────────
function MonitoringPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/monitoring/sentry');
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.error || 'Could not load monitoring data.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load monitoring data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-on-surface/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="mt-6 py-10 text-center text-error text-sm">{error}</div>;
  }

  if (!data?.configured) {
    return (
      <div className="mt-6 bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-10 text-center shadow-editorial">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">cloud_off</span>
        <h3 className="text-lg font-bold text-on-surface mt-3">Sentry isn't connected yet</h3>
        <p className="text-sm text-on-surface-variant/70 mt-1 max-w-md mx-auto">
          Set <code className="px-1.5 py-0.5 bg-surface-container-low rounded font-mono text-2xs">SENTRY_AUTH_TOKEN</code> and{' '}
          <code className="px-1.5 py-0.5 bg-surface-container-low rounded font-mono text-2xs">SENTRY_ORG_SLUG</code> on the backend (Render) to switch on live error monitoring here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex justify-end mb-3">
        <button
          onClick={fetchOverview}
          className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/20"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.projects.map((p) => <SentryProjectCard key={p.key} project={p} />)}
      </div>
    </div>
  );
}

const PROJECT_ICON = { web: 'desktop_windows', backend: 'dns', mobile: 'smartphone' };

const SentryProjectCard = ({ project }) => (
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-editorial overflow-hidden flex flex-col">
    <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-lg">{PROJECT_ICON[project.key] || 'apps'}</span>
        <p className="text-xs font-bold text-on-surface">{project.label}</p>
      </div>
      {project.ok ? (
        <span className={`text-2xl font-bold tabular-nums ${project.unresolvedCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {project.unresolvedCount}
        </span>
      ) : (
        <span className="material-symbols-outlined text-amber-500 text-lg" title={project.error}>warning</span>
      )}
    </div>
    <div className="flex-1 divide-y divide-outline-variant/10 max-h-80 overflow-y-auto custom-scrollbar">
      {!project.ok ? (
        <p className="p-4 text-2xs text-on-surface-variant/50">{project.error || 'Could not reach Sentry for this project.'}</p>
      ) : project.issues.length === 0 ? (
        <p className="p-4 text-2xs text-on-surface-variant/40 text-center">No unresolved issues. Clean.</p>
      ) : (
        project.issues.map((issue) => (
          <a
            key={issue.id}
            href={issue.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 hover:bg-secondary-container/5 transition-colors"
          >
            <div className="flex items-start gap-2">
              <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-widest flex-shrink-0 mt-0.5 ${SENTRY_LEVEL_TONE[issue.level] || SENTRY_LEVEL_TONE.error}`}>
                {issue.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-bold text-on-surface truncate">{issue.title}</p>
                {issue.culprit && <p className="text-2xs text-on-surface-variant/50 truncate">{issue.culprit}</p>}
                <div className="flex items-center gap-2 mt-1 text-2xs text-on-surface-variant/40">
                  <span className="tabular-nums font-semibold">{issue.count}x</span>
                  <span>·</span>
                  <span>{relTime(issue.lastSeen)}</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant/30 text-sm flex-shrink-0">open_in_new</span>
            </div>
          </a>
        ))
      )}
    </div>
  </div>
);

// ── Shared bits ─────────────────────────────────────────────────────────
const Th = ({ children, className = '' }) => (
  <th className={`py-3 px-3 border-b border-outline-variant/10 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/40 ${className}`}>{children}</th>
);

const KPI_TONE = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700' },
};

const KpiCard = ({ label, value, tone = 'primary', icon = null }) => {
  const t = KPI_TONE[tone] || KPI_TONE.primary;
  return (
    <div className={`p-3 rounded-xl border border-outline-variant/20 ${t.bg}`}>
      <div className="flex items-center gap-1">
        {icon && <span className={`material-symbols-outlined text-sm ${t.text}`}>{icon}</span>}
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight mt-0.5 ${t.text}`}>{value == null ? '—' : value}</p>
    </div>
  );
};

const FilterSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-xs font-semibold bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-0"
  >
    {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const DrawerField = ({ label, value, mono }) => (
  <div>
    <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">{label}</p>
    <p className={`text-xs text-on-surface ${mono ? 'font-mono' : 'font-semibold'} break-all`}>{value || '—'}</p>
  </div>
);
