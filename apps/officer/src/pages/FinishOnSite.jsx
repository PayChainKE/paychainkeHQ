import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

// Same five checks the reviewer's checklist has — here they are the officer's
// in-person confirmation, and the server re-checks every gate regardless.
const CHECKS = [
  { key: 'legalNameMatch', label: 'Legal business name matches registration documents' },
  { key: 'ubosIdentified', label: 'Directors / Ultimate Beneficial Owners (UBOs) identified' },
  { key: 'kraPinVerified', label: 'KRA PIN verified and active' },
  { key: 'tillVerified', label: 'M-Pesa Till / Paybill number verified against ownership docs' },
  { key: 'businessTypeCompliant', label: 'Business type compliant with PayChain acceptable use policies' },
];

const TIER_STYLE = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
};

const FinishOnSite = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [checks, setChecks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState('');
  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await api.get(`/api/officer/applications/${id}/field-readiness`);
      setState({ loading: false, error: '', data: res.data.data });
    } catch (e) {
      setState({ loading: false, error: e?.response?.data?.error || 'Could not load this application.', data: null });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const d = state.data;
  const allChecked = CHECKS.every((c) => checks[c.key]);
  const blocked = !!d && d.blockers.length > 0;
  const capReached = !!d && d.dailyUsed >= d.dailyCap;

  async function approve() {
    setBusy(true); setError('');
    try {
      const res = await api.post(`/api/officer/applications/${id}/field-approve`, { attestation: checks });
      setResult(res.data.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not approve this application.');
      load();
    } finally { setBusy(false); }
  }

  async function resend() {
    try { await api.post(`/api/officer/applications/${id}/payment-details-sms`); showToast('Text sent to the merchant.'); }
    catch (e) { showToast(e?.response?.data?.error || 'Could not send the text.'); }
  }

  const copy = (text) => { try { navigator.clipboard.writeText(text); showToast('Copied.'); } catch { /* clipboard unavailable */ } };

  if (state.loading) return <Layout><div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading…</div></Layout>;
  if (!d) return <Layout><div className="p-12 text-center text-on-surface-variant/50 text-sm">{state.error}</div></Layout>;

  // ── Success: hand the merchant their details ─────────────────────────
  if (result) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto space-y-5 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-[#06201B] to-[#0f3a30] text-white p-7 text-center shadow-editorial">
            <span className="material-symbols-outlined text-5xl text-emerald-300">check_circle</span>
            <h1 className="text-2xl font-bold mt-2">{d.application.businessName} is approved</h1>
            <p className="text-sm text-emerald-100/70 mt-1">Their PayChain account is active.</p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">Give the merchant these payment details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-surface-container-low p-4 text-center">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Paybill</p>
                <p className="text-3xl font-black tracking-tight text-on-surface tabular-nums">{result.paybill}</p>
                <button onClick={() => copy(result.paybill)} className="mt-2 text-2xs font-bold uppercase tracking-widest text-primary">Copy</button>
              </div>
              <div className="rounded-xl bg-surface-container-low p-4 text-center">
                <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">Account No.</p>
                <p className="text-2xl font-black tracking-tight text-on-surface tabular-nums break-all">{result.accountNumber || '—'}</p>
                <button onClick={() => copy(result.accountNumber)} className="mt-2 text-2xs font-bold uppercase tracking-widest text-primary">Copy</button>
              </div>
            </div>
            <div className="mt-4 text-xs text-on-surface-variant/70 space-y-1.5">
              <p className="flex items-start gap-2"><span className="material-symbols-outlined text-base text-emerald-600">sms</span>
                {result.smsSent ? `These details were texted to ${d.application.phone}.` : 'The details text could not be sent — use Resend below.'}</p>
              <p className="flex items-start gap-2"><span className="material-symbols-outlined text-base text-emerald-600">lock_reset</span>
                They also got a text with a link to set their password. <strong>Ask them to tap it now</strong> while you are with them — it expires in 24 hours.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={resend} className="px-4 py-2 rounded-lg border border-outline-variant/40 text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low">Resend text</button>
            </div>
          </div>

          <p className="text-2xs text-on-surface-variant/50 text-center">An admin will review this approval afterwards. You don't need to do anything further.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/applications/new')} className="flex-1 py-3 rounded-xl bg-primary text-white text-2xs font-bold uppercase tracking-widest">Onboard another business</button>
            <button onClick={() => navigate('/queue')} className="flex-1 py-3 rounded-xl border border-outline-variant/40 text-2xs font-bold uppercase tracking-widest hover:bg-surface-container-low">Back to queue</button>
          </div>
        </div>
        {toast && <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>}
      </Layout>
    );
  }

  // ── Review + confirm ─────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5 pb-16">
        <button onClick={() => navigate(`/applications/${id}`)} className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50 hover:text-primary flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Full application
        </button>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Finish on site</p>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">{d.application.businessName}</h1>
          <p className="text-xs text-on-surface-variant/60 mt-1">{d.application.name} · {d.application.phone} · {d.application.businessType}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-2xs font-bold uppercase tracking-widest">
            <span className={`px-2.5 py-1 rounded-full border ${TIER_STYLE[d.riskTier] || TIER_STYLE.medium}`}>{d.riskTier} risk (automatic)</span>
            <span className={`px-2.5 py-1 rounded-full border ${d.evidence.idProvided ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>ID {d.evidence.idProvided ? 'provided' : 'missing'}</span>
            <span className={`px-2.5 py-1 rounded-full border ${d.evidence.photos > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{d.evidence.photos} site photo{d.evidence.photos === 1 ? '' : 's'}</span>
            <span className="px-2.5 py-1 rounded-full border border-outline-variant/30 text-on-surface-variant/60">{d.dailyUsed}/{d.dailyCap} approved today</span>
          </div>
        </div>

        {blocked && (
          <div className="rounded-2xl p-5 bg-red-50 border border-red-200">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-red-700 mb-3">Fix these before you can approve on site</p>
            <ul className="space-y-2">
              {d.blockers.map((b) => (
                <li key={b.code} className="flex items-start gap-2 text-sm text-on-surface">
                  <span className="material-symbols-outlined text-base text-red-600 mt-0.5">error</span><span>{b.message}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => navigate(`/applications/${id}`)} className="mt-4 px-4 py-2 rounded-lg bg-white border border-red-200 text-2xs font-bold uppercase tracking-widest text-red-700">Open the application to fix</button>
          </div>
        )}

        {d.warnings.length > 0 && (
          <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 text-sm text-on-surface space-y-1">
            {d.warnings.map((w) => <p key={w.code} className="flex items-start gap-2"><span className="material-symbols-outlined text-base text-amber-600">warning</span>{w.message}</p>)}
          </div>
        )}

        {!blocked && (
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-1">I confirm, having met the owner in person</p>
            <p className="text-xs text-on-surface-variant/60 mb-4">Only tick what you have actually checked. This is recorded against your name.</p>
            <div className="space-y-2">
              {CHECKS.map((c) => (
                <label key={c.key} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-surface-container-low">
                  <input type="checkbox" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))} className="w-5 h-5 mt-0.5 accent-primary" />
                  <span className="text-sm text-on-surface">{c.label}</span>
                </label>
              ))}
            </div>
            {capReached && <p className="mt-4 text-xs text-red-600 font-medium">You have reached today's limit of {d.dailyCap} on-site approvals. An admin can approve the rest.</p>}
            {error && <p className="mt-4 text-xs text-red-600 font-medium">{error}</p>}
            <button onClick={approve} disabled={!allChecked || busy || capReached}
              className="mt-5 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-base">verified</span>{busy ? 'Approving…' : 'Approve & issue Paybill'}
            </button>
            <p className="mt-3 text-2xs text-on-surface-variant/50 text-center">The merchant is activated immediately and an admin reviews the approval afterwards.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FinishOnSite;
