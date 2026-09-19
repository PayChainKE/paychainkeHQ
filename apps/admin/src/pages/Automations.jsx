import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const DAYS = [
  { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }, { id: 0, label: 'Sun' },
];

const labelCls = 'block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5';
const fieldCls = 'px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

function fmtWhenEAT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' }) + ' EAT';
}

const STATUS_STYLE = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  skipped: 'bg-gray-100 text-gray-600 border-gray-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

const Toggle = ({ checked, onChange, disabled, label, hint }) => (
  <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-outline-variant/60'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
    <span>
      <span className="block text-sm font-bold text-on-surface">{label}</span>
      {hint && <span className="block text-xs text-on-surface-variant/60 mt-0.5">{hint}</span>}
    </span>
  </label>
);

export default function Automations() {
  const { admin } = useAuth();
  const canMutate = admin?.role === 'owner' || admin?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [others, setOthers] = useState([]);   // every other automation
  const [digest, setDigest] = useState(null); // server state
  const [form, setForm] = useState(null);      // editable copy
  const [options, setOptions] = useState({ businessTypes: [], counties: [] });
  const [audienceCount, setAudienceCount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); }, []);

  const hydrate = useCallback((row) => {
    setDigest(row);
    setForm({
      enabled: row.enabled,
      autoSend: row.autoSend,
      days: row.config?.days || [],
      time: row.config?.time || '09:00',
      audience: { source: 'subscribers', activity: 'all', businessType: '', county: '', ...(row.config?.audience || {}) },
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/automations');
      const all = res.data?.data || [];
      const row = all.find((a) => a.key === 'newsletter_digest');
      if (row) hydrate(row);
      setOthers(all.filter((a) => a.key !== 'newsletter_digest'));
      setError('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load automations.');
    } finally { setLoading(false); }
  }, [hydrate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/api/newsletter/audience-options')
      .then((res) => setOptions({ businessTypes: res.data?.businessTypes || [], counties: res.data?.counties || [] }))
      .catch(() => {});
  }, []);

  // Live recipient count for the chosen audience.
  useEffect(() => {
    if (!form) return undefined;
    let cancelled = false;
    api.post('/api/newsletter/audience-count', { audience: form.audience })
      .then((res) => { if (!cancelled) setAudienceCount(res.data?.count ?? null); })
      .catch(() => { if (!cancelled) setAudienceCount(null); });
    return () => { cancelled = true; };
  }, [form?.audience]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = digest && form && (
    form.enabled !== digest.enabled || form.autoSend !== digest.autoSend ||
    form.time !== digest.config?.time ||
    JSON.stringify([...form.days].sort()) !== JSON.stringify([...(digest.config?.days || [])].sort()) ||
    JSON.stringify(form.audience) !== JSON.stringify({ source: 'subscribers', activity: 'all', businessType: '', county: '', ...(digest.config?.audience || {}) })
  );

  async function save() {
    setSaving(true);
    try {
      const res = await api.put('/api/automations/newsletter_digest', {
        enabled: form.enabled,
        autoSend: form.autoSend,
        config: { days: form.days, time: form.time, audience: form.audience },
      });
      if (res.data?.success) { hydrate(res.data.data); showToast('Saved.'); }
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not save.');
    } finally { setSaving(false); }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await api.post('/api/automations/newsletter_digest/run-now');
      showToast(res.data?.message || 'Digest prepared.');
      if (res.data?.data) setDigest(res.data.data);
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not prepare a digest.');
    } finally { setRunning(false); }
  }

  const toggleDay = (id) => setForm((f) => ({
    ...f, days: f.days.includes(id) ? f.days.filter((d) => d !== id) : [...f.days, id],
  }));
  const setAudience = (patch) => setForm((f) => ({ ...f, audience: { ...f.audience, ...patch } }));

  return (
    <Layout>
      <div className="space-y-6 pb-12 max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 p-5 md:p-8">
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-2">Automations</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Let PayChain run the routine work</h1>
          <p className="text-sm text-emerald-100/70 mt-2 max-w-2xl">
            Everything here is off until you switch it on, and runs on its own after that, on East Africa Time.
            The newsletter digest waits for your approval unless you turn Auto-send on. Alerts about automations are emailed to all admins.
          </p>
        </div>

        {loading && <div className="h-48 bg-surface-container animate-pulse rounded-2xl" />}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

        {form && digest && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">Newsletter</p>
                <h2 className="text-lg font-bold text-on-surface tracking-tight">{digest.label}</h2>
                <p className="text-sm text-on-surface-variant/70 mt-1">{digest.description}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-black uppercase tracking-widest border ${digest.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${digest.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {digest.enabled ? 'On' : 'Off'}
              </span>
            </div>

            <div className="p-6 space-y-6">
              <Toggle
                checked={form.enabled} disabled={!canMutate}
                onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                label="Run this automation"
                hint="When on, a digest is prepared at every slot below, from blog posts published since the last one. If nothing new was published, that slot is skipped."
              />

              <div>
                <span className={labelCls}>Days</span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.id} type="button" disabled={!canMutate} onClick={() => toggleDay(d.id)}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-colors ${form.days.includes(d.id) ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/70 border-outline-variant/40 hover:border-primary'}`}
                    >{d.label}</button>
                  ))}
                </div>
                <p className="text-2xs text-on-surface-variant/50 mt-2">For example Tue · Thu · Sat for three sends a week.</p>
              </div>

              <div className="flex flex-wrap gap-4">
                <label>
                  <span className={labelCls}>Time (East Africa Time)</span>
                  <input type="time" value={form.time} disabled={!canMutate} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className={fieldCls} />
                </label>
                <label>
                  <span className={labelCls}>Send to</span>
                  <select value={form.audience.source} disabled={!canMutate} onChange={(e) => setAudience({ source: e.target.value })} className={fieldCls}>
                    <option value="subscribers">Newsletter subscribers</option>
                    <option value="merchants">Merchants</option>
                  </select>
                </label>
                {form.audience.source === 'merchants' && (
                  <>
                    <label>
                      <span className={labelCls}>Activity</span>
                      <select value={form.audience.activity} disabled={!canMutate} onChange={(e) => setAudience({ activity: e.target.value })} className={fieldCls}>
                        <option value="all">All merchants</option>
                        <option value="active">Active</option>
                        <option value="dormant">Dormant (60+ days)</option>
                      </select>
                    </label>
                    <label>
                      <span className={labelCls}>Business type</span>
                      <select value={form.audience.businessType} disabled={!canMutate} onChange={(e) => setAudience({ businessType: e.target.value })} className={fieldCls}>
                        <option value="">Any</option>
                        {options.businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className={labelCls}>County</span>
                      <select value={form.audience.county} disabled={!canMutate} onChange={(e) => setAudience({ county: e.target.value })} className={fieldCls}>
                        <option value="">Any</option>
                        {options.counties.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
              <p className="text-xs text-on-surface-variant/60 -mt-3">
                {audienceCount === null ? 'Counting recipients…' : <>Currently <strong className="text-on-surface">{audienceCount}</strong> recipient{audienceCount === 1 ? '' : 's'}.</>}
              </p>

              <div className={`rounded-xl border p-4 ${form.autoSend ? 'border-amber-300 bg-amber-50/60' : 'border-outline-variant/30 bg-surface-container-low/40'}`}>
                <Toggle
                  checked={form.autoSend} disabled={!canMutate}
                  onChange={(v) => setForm((f) => ({ ...f, autoSend: v }))}
                  label="Auto-send without approval"
                  hint={form.autoSend
                    ? 'Digests will be emailed to the audience automatically at each slot. Nobody reviews them first.'
                    : 'Off (recommended): each digest waits as a draft on the Newsletter page and every admin is emailed to review and send it.'}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-surface-container-low/50 p-4">
                  <p className={labelCls}>Next digest</p>
                  <p className="font-bold text-on-surface">{digest.enabled ? fmtWhenEAT(digest.nextRunAt) : 'Off'}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low/50 p-4">
                  <p className={labelCls}>Last run</p>
                  {digest.lastRunAt ? (
                    <>
                      <p className="font-bold text-on-surface flex items-center gap-2 flex-wrap">
                        {fmtWhenEAT(digest.lastRunAt)}
                        {digest.lastRunStatus && <span className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-widest border ${STATUS_STYLE[digest.lastRunStatus] || STATUS_STYLE.skipped}`}>{digest.lastRunStatus}</span>}
                      </p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">{digest.lastRunSummary}</p>
                    </>
                  ) : <p className="font-bold text-on-surface">Never</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-outline-variant/10">
                <div className="flex items-center gap-3 text-xs">
                  <button type="button" onClick={runNow} disabled={!canMutate || running}
                    className="px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-50">
                    {running ? 'Preparing…' : 'Prepare a digest now'}
                  </button>
                  <Link to="/newsletter" className="text-primary font-bold hover:underline">Open Newsletter →</Link>
                </div>
                {canMutate ? (
                  <button type="button" onClick={save} disabled={saving || !dirty || form.days.length === 0}
                    className="px-6 py-2.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                ) : <span className="text-xs text-on-surface-variant/50">View only — your role can't change automations.</span>}
              </div>
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="pt-2">
            <p className="text-2xs font-bold uppercase tracking-[0.3em] text-on-surface-variant/50 mb-1">More automations</p>
            <p className="text-sm text-on-surface-variant/70">Everything here is off until you switch it on. Use “Preview” first to see what it would do right now, without sending anything.</p>
          </div>
        )}
        {others.map((a) => (
          <AutomationCard
            key={a.key}
            automation={a}
            canMutate={canMutate}
            showToast={showToast}
            onSaved={(row) => setOthers((list) => list.map((x) => (x.key === row.key ? row : x)))}
          />
        ))}
      </div>

      {toast && <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>}
    </Layout>
  );
}


// A generic card, driven entirely by the `fields` the server describes for
// each automation.
function AutomationCard({ automation, canMutate, showToast, onSaved }) {
  const [form, setForm] = useState(() => ({ enabled: automation.enabled, config: { ...(automation.config || {}) } }));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState('');

  const dirty = form.enabled !== automation.enabled || JSON.stringify(form.config) !== JSON.stringify(automation.config || {});
  const setField = (key, value) => { setPreview(''); setForm((f) => ({ ...f, config: { ...f.config, [key]: value } })); };
  const customerFacing = Array.isArray(automation.copy) && automation.copy.length > 0;

  async function save() {
    const turningOn = form.enabled && !automation.enabled;
    if (turningOn && customerFacing && !window.confirm(`Switching this on will start messaging real merchants and applicants (${automation.channel}) on its next run.\n\nHave you checked the message wording above${'\u2014'}and used Preview to see who it would reach?`)) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/automations/${automation.key}`, { enabled: form.enabled, config: form.config });
      if (res.data?.success) { onSaved(res.data.data); showToast('Saved.'); }
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not save.');
    } finally { setSaving(false); }
  }

  async function runPreview() {
    setPreviewing(true); setPreview('');
    try {
      const res = await api.post(`/api/automations/${automation.key}/preview`, { config: form.config });
      setPreview(res.data?.summary || 'Nothing to do right now.');
    } catch (e) {
      setPreview(e?.response?.data?.error || 'Could not run the preview.');
    } finally { setPreviewing(false); }
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
      <div className="px-6 py-5 border-b border-outline-variant/10 flex items-start justify-between gap-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">{automation.channel}</p>
          <h2 className="text-lg font-bold text-on-surface tracking-tight">{automation.label}</h2>
          <p className="text-sm text-on-surface-variant/70 mt-1">{automation.description}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-black uppercase tracking-widest border ${automation.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${automation.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {automation.enabled ? 'On' : 'Off'}
        </span>
      </div>

      <div className="p-6 space-y-5">
        <Toggle checked={form.enabled} disabled={!canMutate} onChange={(v) => { setPreview(''); setForm((f) => ({ ...f, enabled: v })); }} label="Run this automation" />

        {(automation.fields || []).map((f) => {
          const value = form.config[f.key];
          if (f.type === 'toggle') {
            return <Toggle key={f.key} checked={value !== false} disabled={!canMutate} onChange={(v) => setField(f.key, v)} label={f.label} />;
          }
          if (f.type === 'number') {
            return (
              <label key={f.key} className="block">
                <span className={labelCls}>{f.label}</span>
                <input type="number" min={f.min} max={f.max} value={value ?? ''} disabled={!canMutate}
                  onChange={(e) => setField(f.key, e.target.value === '' ? '' : Number(e.target.value))} className={`${fieldCls} w-28`} />
              </label>
            );
          }
          if (f.type === 'select') {
            return (
              <label key={f.key} className="block">
                <span className={labelCls}>{f.label}</span>
                <select value={value ?? f.options[0].value} disabled={!canMutate} onChange={(e) => setField(f.key, e.target.value)} className={fieldCls}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            );
          }
          if (f.type === 'days') {
            const days = value || [];
            return (
              <div key={f.key}>
                <span className={labelCls}>{f.label}</span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button key={d.id} type="button" disabled={!canMutate}
                      onClick={() => setField(f.key, days.includes(d.id) ? days.filter((x) => x !== d.id) : [...days, d.id])}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-colors ${days.includes(d.id) ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/70 border-outline-variant/40 hover:border-primary'}`}>{d.label}</button>
                  ))}
                </div>
              </div>
            );
          }
          if (f.type === 'time') {
            return (
              <label key={f.key} className="block">
                <span className={labelCls}>{f.label}</span>
                <input type="time" value={value || ''} disabled={!canMutate} onChange={(e) => setField(f.key, e.target.value)} className={fieldCls} />
              </label>
            );
          }
          return null;
        })}

        {customerFacing && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4 space-y-3">
            <p className={labelCls}>Exactly what people will receive</p>
            {automation.copy.map((c) => (
              <div key={c.label}>
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-0.5">{c.label}</p>
                <p className="text-sm text-on-surface">{c.text}</p>
              </div>
            ))}
            {automation.channel.includes('SMS') && <p className="text-2xs text-on-surface-variant/50">Texts are never sent between 8pm and 7am East Africa Time — they wait until morning.</p>}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-surface-container-low/50 p-4">
            <p className={labelCls}>Next run</p>
            <p className="font-bold text-on-surface">{automation.enabled && automation.nextRunAt ? fmtWhenEAT(automation.nextRunAt) : 'Off'}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low/50 p-4">
            <p className={labelCls}>Last run</p>
            {automation.lastRunAt ? (
              <>
                <p className="font-bold text-on-surface flex items-center gap-2 flex-wrap">
                  {fmtWhenEAT(automation.lastRunAt)}
                  {automation.lastRunStatus && <span className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-widest border ${STATUS_STYLE[automation.lastRunStatus] || STATUS_STYLE.skipped}`}>{automation.lastRunStatus}</span>}
                </p>
                <p className="text-xs text-on-surface-variant/60 mt-1">{automation.lastRunSummary}</p>
              </>
            ) : <p className="font-bold text-on-surface">Never</p>}
          </div>
        </div>

        {preview && <div className="text-sm text-on-surface bg-blue-50 border border-blue-100 rounded-xl px-4 py-3"><strong>Preview:</strong> {preview}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-outline-variant/10">
          <button type="button" onClick={runPreview} disabled={!canMutate || previewing}
            className="px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-50">
            {previewing ? 'Checking…' : 'Preview — send nothing'}
          </button>
          {canMutate ? (
            <button type="button" onClick={save} disabled={saving || !dirty}
              className="px-6 py-2.5 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          ) : <span className="text-xs text-on-surface-variant/50">View only — your role can't change automations.</span>}
        </div>
      </div>
    </div>
  );
}
