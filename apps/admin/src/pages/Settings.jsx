import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { v: 'profile',  label: 'Profile',         icon: 'account_circle' },
  { v: 'security', label: 'Security',        icon: 'lock' },
  { v: 'system',   label: 'System & Data',   icon: 'dns' },
];

const Settings = () => {
  const { admin: ctxAdmin } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/api/admin/auth/me');
      if (res.data?.success) setProfile(res.data.data);
      else setLoadError(res.data?.error || 'Could not load profile.');
    } catch (e) {
      const fallback = ctxAdmin || null;
      if (fallback) setProfile(fallback);
      else setLoadError(e?.response?.data?.error || 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [ctxAdmin]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Console</p>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Settings</h2>
            <p className="text-on-surface-variant/60 mt-1 text-[13px] md:text-[14px] font-body">
              Manage your profile, security credentials, and system-level controls.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-outline-variant/10 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold transition-colors relative whitespace-nowrap ${
                tab === t.v ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
              {tab === t.v && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonCard />
        ) : loadError ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center text-red-700 text-sm">{loadError}</div>
        ) : (
          <>
            {tab === 'profile' && <ProfileSection profile={profile} onUpdated={setProfile} />}
            {tab === 'security' && <SecuritySection profile={profile} />}
            {tab === 'system'   && <SystemSection profile={profile} />}
          </>
        )}
      </div>
    </Layout>
  );
};

// ── Profile ───────────────────────────────────────────────────────────
const ProfileSection = ({ profile, onUpdated }) => {
  const [name, setName] = useState(profile.name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  const dirty = (name !== (profile.name || '')) || (avatarUrl !== (profile.avatarUrl || ''));

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await api.put('/api/admin/auth/me', { name: name.trim(), avatarUrl: avatarUrl.trim() });
      if (res.data?.success) {
        onUpdated(res.data.data);
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2200);
      } else {
        setError(res.data?.error || 'Could not save.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  }

  const displayName = (name || profile.email || 'A').trim();
  const initials = (() => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
    }
    return (profile.email || 'A')[0].toUpperCase();
  })();

  return (
    <Card>
      {/* Identity header */}
      <div className="bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#06201B] px-6 py-7 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="relative flex items-center gap-5">
          <div className="w-20 h-20 rounded-full ring-4 ring-emerald-900/40 bg-emerald-700 text-white flex items-center justify-center overflow-hidden text-2xl font-bold">
            {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 mb-1">Signed in as</p>
            <h3 className="text-xl font-bold text-white tracking-tight truncate">{displayName}</h3>
            <p className="text-[13px] text-emerald-100/70 truncate">{profile.email}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                {(profile.role || 'owner').toUpperCase()}
              </span>
              <span className="text-[11px] text-emerald-100/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Active session
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display Name" hint="Shown in the header and on outgoing replies">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brandon Mutiti"
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field label="Email" hint="Email is the username — contact support to change">
            <input type="email" value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
          </Field>
        </div>
        <Field label="Avatar URL (optional)" hint="Paste a public image URL — leave empty to use your initials">
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            maxLength={500}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <MetaPill label="Last login" value={fmtDate(profile.lastLogin)} />
          <MetaPill label="Total logins" value={(profile.loginCount ?? 0).toLocaleString()} />
          <MetaPill label="Member since" value={fmtDate(profile.createdAt, true)} />
        </div>

        {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/10">
          {savedAt && <span className="text-[12px] text-emerald-600 font-bold">✓ Saved</span>}
          <button
            onClick={save}
            disabled={!dirty || busy}
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[14px]">save</span>
            {busy ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </Card>
  );
};

// ── Security ──────────────────────────────────────────────────────────
const SecuritySection = ({ profile }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const strength = {
    length: next.length >= 10,
    upper: /[A-Z]/.test(next),
    number: /[0-9]/.test(next),
    symbol: /[^A-Za-z0-9]/.test(next),
  };
  const allMet = Object.values(strength).every(Boolean);
  const matches = next.length > 0 && next === confirm;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setDone(false);
    if (!current) return setError('Enter your current password.');
    if (!allMet) return setError('New password does not meet the strength requirements.');
    if (!matches) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const res = await api.put('/api/admin/auth/password', { currentPassword: current, newPassword: next });
      if (res.data?.success) {
        if (res.data.token) localStorage.setItem('paychain_admin_token', res.data.token);
        setCurrent(''); setNext(''); setConfirm('');
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      } else {
        setError(res.data?.error || 'Failed to update password.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update password.');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Change Password</p>
          </div>
          <h3 className="text-base font-bold text-on-surface mt-0.5">Update your sign-in credentials</h3>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4" autoComplete="off">
          <Field label="Current Password" required>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
              placeholder="Enter your existing password"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New Password" required>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
                placeholder="At least 10 characters"
              />
            </Field>
            <Field label="Confirm New Password" required>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
                placeholder="Re-enter new password"
              />
              {confirm.length > 0 && !matches && <p className="text-[11px] text-red-600 font-medium mt-1">Passwords do not match.</p>}
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-container-low rounded-lg">
            <Strength met={strength.length}>10+ chars</Strength>
            <Strength met={strength.upper}>Uppercase</Strength>
            <Strength met={strength.number}>Number</Strength>
            <Strength met={strength.symbol}>Symbol</Strength>
          </div>
          {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}
          {done && <div className="text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-medium">✓ Password updated successfully.</div>}
          <div className="flex justify-end pt-2 border-t border-outline-variant/10">
            <button
              type="submit"
              disabled={busy || !current || !allMet || !matches}
              className="px-5 py-2.5 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[14px]">key</span>
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </Card>

      {/* Security posture summary */}
      <Card>
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Defenses</p>
          <h3 className="text-base font-bold text-on-surface mt-0.5">Account Security Posture</h3>
        </div>
        <div className="p-6 space-y-3">
          <SecurityRow icon="check_circle" tone="emerald" title="Two-factor authentication (OTP)" desc="Every sign-in requires a fresh code emailed to your address." />
          <SecurityRow icon="check_circle" tone="emerald" title="Password hashing (bcrypt, 12 rounds)" desc="Your password is never stored in plaintext or recoverable." />
          <SecurityRow icon="check_circle" tone="emerald" title="Session JWT (12-hour expiry)" desc="Tokens auto-expire so a compromised device can't keep access forever." />
          <SecurityRow icon="check_circle" tone="emerald" title="Rate-limited login (5/15min)" desc="Per-IP throttling prevents credential-stuffing attacks." />
          <SecurityRow icon="check_circle" tone="emerald" title="Sensitive-action OTP gate" desc="Locking, deleting, and other destructive admin actions require an extra OTP." />
        </div>
      </Card>
    </div>
  );
};

// ── System ────────────────────────────────────────────────────────────
const SystemSection = ({ profile }) => {
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState('');

  async function exportData(kind) {
    setExporting(kind);
    setExportError('');
    try {
      let url, filename, headers;
      if (kind === 'merchants') { url = '/api/admin/merchants';        filename = 'paychain-merchants.csv'; }
      else if (kind === 'waitlist') { url = '/api/waitlist';           filename = 'paychain-waitlist.csv'; }
      else if (kind === 'subscribers') { url = '/api/newsletter';      filename = 'paychain-subscribers.csv'; }
      else if (kind === 'messages') { url = '/api/contact';            filename = 'paychain-messages.csv'; }
      else throw new Error('Unknown export');

      const res = await api.get(url);
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if (rows.length === 0) { setExportError('Nothing to export in that dataset.'); return; }

      // Auto-derive headers from first row's top-level keys (skipping mongoose internals)
      const skipKeys = new Set(['__v', 'password', 'otp', 'otpExpires', 'passwordResetToken', 'passwordResetExpires', 'stellarEncryptedSecretKey', 'appPin', 'bulkPayPin']);
      headers = Object.keys(rows[0]).filter((k) => !skipKeys.has(k));
      const escape = (v) => {
        if (v == null) return '';
        if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '""');
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => {
        const v = r[h];
        return /[",\n]/.test(String(v ?? '')) || typeof v === 'object' ? `"${escape(v)}"` : escape(v);
      }).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setExportError(e?.response?.data?.error || e?.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Exports */}
      <Card>
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Audit & Reporting</p>
          <h3 className="text-base font-bold text-on-surface mt-0.5">Data Exports</h3>
        </div>
        <div className="p-5 space-y-2">
          {[
            { k: 'merchants',   label: 'Merchants',          icon: 'storefront', desc: 'Every merchant with status, KYB and account info.' },
            { k: 'waitlist',    label: 'Waitlist',           icon: 'hourglass_empty', desc: 'Pipeline candidates with status + notes.' },
            { k: 'subscribers', label: 'Newsletter list',    icon: 'mail',       desc: 'Active + inactive subscribers.' },
            { k: 'messages',    label: 'Support inquiries',  icon: 'forum',      desc: 'Full inbox including reply threads.' },
          ].map((x) => (
            <button
              key={x.k}
              disabled={exporting === x.k}
              onClick={() => exportData(x.k)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-outline-variant/20 hover:bg-surface-container-low transition-all text-left disabled:opacity-60"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[18px]">{x.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-on-surface tracking-tight">{x.label}</p>
                <p className="text-[11px] text-on-surface-variant/60 truncate">{x.desc}</p>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">
                {exporting === x.k ? 'sync' : 'download'}
              </span>
            </button>
          ))}
          {exportError && <p className="text-[12px] text-red-600 font-medium mt-2">{exportError}</p>}
        </div>
      </Card>

      {/* System info */}
      <Card>
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Infrastructure</p>
          <h3 className="text-base font-bold text-on-surface mt-0.5">Platform Status</h3>
        </div>
        <div className="p-5 space-y-3">
          <InfoRow label="Frontend" value="Vercel" status="online" />
          <InfoRow label="API" value="Render" status="online" />
          <InfoRow label="Database" value="MongoDB Atlas" status="online" />
          <InfoRow label="Stellar Network" value={import.meta.env.VITE_STELLAR_NETWORK || 'Testnet'} status="online" />
          <InfoRow label="Email Provider" value="Resend" status="online" />
          <div className="h-px bg-outline-variant/10 my-2"></div>
          <div className="grid grid-cols-2 gap-3">
            <MetaPill label="Console version" value="v3.0" />
            <MetaPill label="Build" value={import.meta.env.MODE || 'production'} />
          </div>
        </div>
      </Card>

      {/* Session info */}
      <Card className="lg:col-span-2">
        <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">This Session</p>
            <h3 className="text-base font-bold text-on-surface mt-0.5">Your Login Activity</h3>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetaPill label="Email" value={profile.email} />
          <MetaPill label="Role" value={(profile.role || 'owner').toUpperCase()} />
          <MetaPill label="Last login" value={fmtDate(profile.lastLogin)} />
          <MetaPill label="Total logins" value={(profile.loginCount ?? 0).toLocaleString()} />
        </div>
      </Card>
    </div>
  );
};

// ── UI atoms ──────────────────────────────────────────────────────────
const inputClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

const Card = ({ children, className = '' }) => (
  <div className={`bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-editorial ${className}`}>{children}</div>
);

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-on-surface-variant/50 mt-1">{hint}</p>}
  </div>
);

const MetaPill = ({ label, value }) => (
  <div className="px-3 py-2 bg-surface-container-low rounded-lg">
    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{label}</p>
    <p className="text-[13px] font-bold text-on-surface tracking-tight truncate">{value}</p>
  </div>
);

const Strength = ({ met, children }) => (
  <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${met ? 'text-emerald-600' : 'text-on-surface-variant/40'}`}>
    <span className="material-symbols-outlined text-[14px]">{met ? 'check_circle' : 'circle'}</span>
    {children}
  </div>
);

const SecurityRow = ({ icon, tone, title, desc }) => {
  const toneMap = { emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' };
  return (
    <div className="flex items-start gap-3 p-3 bg-surface-container-low/30 rounded-lg">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${toneMap[tone]}`}>
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-on-surface tracking-tight">{title}</p>
        <p className="text-[12px] text-on-surface-variant/60">{desc}</p>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, status }) => (
  <div className="flex items-center justify-between py-2 border-b border-outline-variant/5 last:border-0">
    <span className="text-[12px] font-bold uppercase tracking-tight text-on-surface-variant/60">{label}</span>
    <span className="flex items-center gap-1.5 text-[13px] font-bold text-on-surface tracking-tight">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
      {value}
    </span>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-surface-container-low rounded-2xl h-80 animate-pulse"></div>
);

function fmtDate(iso, dateOnly) {
  if (!iso) return '—';
  const d = new Date(iso);
  return dateOnly ? d.toLocaleDateString() : d.toLocaleString();
}

export default Settings;
