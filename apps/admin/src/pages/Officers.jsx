import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const STATUS_META = {
  active:   { label: 'Active',   pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
  inactive: { label: 'Inactive', pill: 'bg-gray-100 text-gray-700 border-gray-200',         dot: 'bg-gray-500' },
};

const generateRandomPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12);
};

const Officers = () => {
  const { admin: currentAdmin } = useAuth();
  const canManage = currentAdmin?.role === 'owner' || currentAdmin?.role === 'admin';

  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [revealModal, setRevealModal] = useState(null); // { email, password, title }
  const [toast, setToast] = useState('');

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/officers');
      if (res.data?.success) setOfficers(res.data.data || []);
      else setError(res.data?.error || 'Could not load officers.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load officers.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOfficers(); }, [fetchOfficers]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); }, []);

  const filtered = useMemo(() => officers.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.email.toLowerCase().includes(s) || (o.name || '').toLowerCase().includes(s);
  }), [officers, search]);

  const stats = useMemo(() => ({
    total: officers.length,
    active: officers.filter((o) => o.status === 'active').length,
    onboarded: officers.reduce((s, o) => s + (o.merchantsOnboarded || 0), 0),
  }), [officers]);

  async function handleToggleStatus(officer) {
    const nextStatus = officer.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await api.patch(`/api/admin/officers/${officer._id}`, { status: nextStatus });
      if (res.data?.success) {
        setOfficers((arr) => arr.map((o) => (o._id === officer._id ? { ...o, status: nextStatus } : o)));
        showToast(nextStatus === 'active' ? 'Officer reactivated.' : 'Officer deactivated.');
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not update officer.');
    }
  }

  async function handleResetPassword(officer) {
    try {
      const res = await api.post(`/api/admin/officers/${officer._id}/reset-password`);
      if (res.data?.success) {
        setRevealModal({ email: officer.email, password: res.data.generatedPassword, title: 'Password reset' });
        showToast('Password reset — credentials emailed.');
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not reset password.');
    }
  }

  async function handleDelete(officer) {
    try {
      const res = await api.delete(`/api/admin/officers/${officer._id}`);
      if (res.data?.success) {
        setOfficers((arr) => arr.filter((o) => o._id !== officer._id));
        showToast('Officer removed.');
      } else throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not remove officer.');
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Onboarding Officers</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">
                Officer Accounts
              </h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Officers can only onboard merchants and verify their KYC in the Officer console. Their login credentials are set here — officers cannot change their own password.
              </p>
            </div>
            {canManage && (
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg">
                <span className="material-symbols-outlined text-base">person_add</span>
                Create Officer
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile icon="badge" label="Total Officers" value={stats.total} />
          <StatTile icon="bolt" label="Active" value={stats.active} tone="emerald" pulse />
          <StatTile icon="storefront" label="Merchants Onboarded" value={stats.onboarded.toLocaleString()} />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">Officer Roster</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{filtered.length} officer{filtered.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Officer</Th>
                  <Th>Status</Th>
                  <Th className="text-center">Merchants Onboarded</Th>
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
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No officers yet.'}</td></tr>
                ) : filtered.map((o) => (
                  <OfficerRow key={o._id} officer={o} canManage={canManage} onToggleStatus={() => handleToggleStatus(o)} onResetPassword={() => handleResetPassword(o)} onDelete={() => handleDelete(o)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-2">
          {loading ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">Loading officers…</div> :
            filtered.length === 0 ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">{error || 'No officers yet.'}</div> :
            filtered.map((o) => (
              <OfficerCard key={o._id} officer={o} canManage={canManage} onToggleStatus={() => handleToggleStatus(o)} onResetPassword={() => handleResetPassword(o)} onDelete={() => handleDelete(o)} />
            ))}
        </div>

        {createOpen && canManage && (
          <CreateOfficerModal
            onClose={() => setCreateOpen(false)}
            onCreated={(officer, password) => {
              setOfficers((arr) => [{ ...officer, merchantsOnboarded: 0 }, ...arr]);
              setCreateOpen(false);
              setRevealModal({ email: officer.email, password, title: 'Officer created' });
            }}
          />
        )}

        {revealModal && (
          <RevealPasswordModal {...revealModal} onClose={() => setRevealModal(null)} />
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
        )}
      </div>
    </Layout>
  );
};

// ── Create modal ────────────────────────────────────────────────────
const CreateOfficerModal = ({ onClose, onCreated }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Enter a valid email.'); return; }
    if (password && password.length < 10) { setErr('Password must be at least 10 characters.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/api/admin/officers', { email: email.trim(), name: name.trim(), password: password || undefined });
      if (res.data?.success) onCreated(res.data.data, res.data.generatedPassword);
      else setErr(res.data?.error || 'Could not create officer.');
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not create officer.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 bg-gradient-to-br from-[#06201B] to-[#0a3029] text-white">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">New onboarding officer</p>
          <h3 className="text-xl font-bold tracking-tight">Create officer account</h3>
          <p className="text-xs text-emerald-100/60 mt-1">Credentials are set here and emailed once. The officer cannot change their password themselves.</p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4" autoComplete="off">
          <Field label="Email" required>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Display Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} />
          </Field>
          <Field label="Password" hint="Leave blank to auto-generate a secure password.">
            <div className="flex gap-2">
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Auto-generate" className={inputClass} minLength={10} />
              <button type="button" onClick={() => setPassword(generateRandomPassword())} className="px-3 py-2 rounded-lg border border-outline-variant/40 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low whitespace-nowrap">
                Generate
              </button>
            </div>
          </Field>
          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">person_add</span>
              {busy ? 'Creating…' : 'Create officer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Reveal-once password modal ──────────────────────────────────────
const RevealPasswordModal = ({ email, password, title, onClose }) => {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold tracking-tight text-on-surface mb-1">{title}</h3>
          <p className="text-xs text-on-surface-variant/60 mb-4">These credentials were also emailed to {email}. This is the only time the password is shown here.</p>
          <div className="bg-surface-container-low rounded-lg p-3 space-y-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">Email</p>
              <p className="text-xs font-bold text-on-surface">{email}</p>
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">Password</p>
              <p className="text-sm font-mono font-bold text-on-surface">{password}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4">
            <button onClick={copy} className="px-4 py-2 rounded-lg border border-outline-variant/40 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low">
              {copied ? 'Copied!' : 'Copy password'}
            </button>
            <button onClick={onClose} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest">
              Done
            </button>
          </div>
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

const StatTile = ({ icon, label, value, tone, pulse }) => {
  const toneMap = { emerald: 'bg-emerald-50 text-emerald-600', primary: 'bg-primary/10 text-primary' };
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

const OfficerRow = ({ officer, canManage, onToggleStatus, onResetPassword, onDelete }) => {
  const statusStyle = STATUS_META[officer.status] || STATUS_META.active;
  const initials = (officer.name || officer.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors group">
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-2xs flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white">
            {initials}
          </div>
          <div>
            <p className="font-bold text-on-surface tracking-tight text-xs">{officer.name || '—'}</p>
            <p className="text-2xs text-on-surface-variant/60">{officer.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
          {statusStyle.label}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center font-bold tabular-nums text-xs">{officer.merchantsOnboarded || '—'}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {officer.createdAt ? new Date(officer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={onResetPassword} title="Reset password" className="text-on-surface-variant/40 hover:text-primary transition-all">
              <span className="material-symbols-outlined text-lg">key</span>
            </button>
            <button onClick={onToggleStatus} title={officer.status === 'active' ? 'Deactivate' : 'Reactivate'} className="text-on-surface-variant/40 hover:text-amber-600 transition-all">
              <span className="material-symbols-outlined text-lg">{officer.status === 'active' ? 'toggle_on' : 'toggle_off'}</span>
            </button>
            {confirmingDelete ? (
              <button onClick={onDelete} className="text-2xs font-bold uppercase tracking-widest text-red-600">Confirm</button>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} title="Delete" className="text-on-surface-variant/40 hover:text-red-600 transition-all">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

const OfficerCard = ({ officer, canManage, onToggleStatus, onResetPassword, onDelete }) => {
  const statusStyle = STATUS_META[officer.status] || STATUS_META.active;
  const initials = (officer.name || officer.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm flex items-center justify-center font-bold uppercase shadow-sm ring-2 ring-white flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-xs">{officer.name || '—'}</p>
          <p className="text-2xs text-on-surface-variant/60 truncate">{officer.email}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
              {statusStyle.label}
            </span>
            <span className="text-2xs text-on-surface-variant/50">{officer.merchantsOnboarded || 0} onboarded</span>
          </div>
          {canManage && (
            <div className="mt-3 flex items-center gap-3">
              <button onClick={onResetPassword} className="text-2xs font-bold uppercase tracking-widest text-primary">Reset Password</button>
              <button onClick={onToggleStatus} className="text-2xs font-bold uppercase tracking-widest text-amber-600">{officer.status === 'active' ? 'Deactivate' : 'Reactivate'}</button>
              <button onClick={onDelete} className="text-2xs font-bold uppercase tracking-widest text-red-600">Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Officers;
