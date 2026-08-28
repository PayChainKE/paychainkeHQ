import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import logo from '../assets/logo.png';

const Strength = ({ met, children }) => (
  <div className={`flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest transition-colors ${met ? 'text-emerald-600' : 'text-on-surface-variant/40'}`}>
    <span className="material-symbols-outlined text-sm">{met ? 'check_circle' : 'circle'}</span>
    {children}
  </div>
);

// Public page for the invite link teamController.js#inviteTeamMember emails
// to a new admin/officer (${ADMIN_DASHBOARD_URL}/setup-password?token=...).
// That link had no matching route in this app at all until now — invited
// team members could not actually set their password. Mirrors
// apps/merchant-dashboard/src/pages/SetupPassword.jsx (the equivalent
// merchant-onboarding flow) — separate Vite apps, ported not imported.
export default function SetupPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [phase, setPhase] = useState('validating');
  const [invitee, setInvitee] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const allMet = Object.values(strength).every(Boolean);
  const matches = password.length > 0 && password === confirm;

  useEffect(() => {
    if (!token) {
      setPhase('invalid');
      return;
    }
    let cancelled = false;
    api.get(`/api/auth/setup-password/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) {
          setInvitee(res.data.data);
          setPhase('ready');
        } else {
          setPhase('invalid');
        }
      })
      .catch(() => { if (!cancelled) setPhase('invalid'); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!allMet) return setErr('Password does not meet all requirements.');
    if (!matches) return setErr('Passwords do not match.');
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/setup-password', { token, password });
      if (res.data?.success) {
        setPhase('done');
        setTimeout(() => nav('/login'), 2200);
      } else {
        setErr(res.data?.error || 'Could not set password.');
      }
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not set password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface px-4 py-10">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-editorial border border-outline-variant/20 overflow-hidden">
        <div className="bg-[#06201B] px-8 py-7 text-center">
          <img src={logo} alt="PayChain" className="h-9 w-auto mx-auto object-contain" />
          <p className="mt-3 text-emerald-300 text-xs font-bold uppercase tracking-[0.2em] font-label">Admin Portal Setup</p>
        </div>

        <div className="p-8">
          {phase === 'validating' && (
            <div className="text-center py-10">
              <div className="inline-block w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-on-surface-variant text-sm">Validating your invitation…</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">link_off</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-2 font-headline">Link expired or invalid</h2>
              <p className="text-sm text-on-surface-variant mb-6">This invite link is no longer valid. Ask whoever added you to PayChain's admin team to send a new one.</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-2 font-headline">Password set</h2>
              <p className="text-sm text-on-surface-variant">Redirecting you to sign in…</p>
            </div>
          )}

          {phase === 'ready' && invitee && (
            <>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Set your password</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Welcome, <strong className="text-on-surface">{invitee.name}</strong>.<br />
                You're setting up your PayChain admin account.
              </p>
              <p className="mt-3 text-xs text-on-surface-variant/60">Account email: {invitee.email}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" autoComplete="off">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5 font-label">New Password</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 bg-surface-container-low border border-outline-variant/20 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm font-medium text-on-surface"
                      placeholder="At least 10 characters"
                    />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface">
                      <span className="material-symbols-outlined text-[18px]">{show ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5 font-label">Confirm Password</label>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm font-medium text-on-surface"
                    placeholder="Re-enter password"
                  />
                  {confirm.length > 0 && !matches && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-500">Passwords do not match.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-surface-container-low/50 rounded-lg">
                  <Strength met={strength.length}>10+ chars</Strength>
                  <Strength met={strength.upper}>Uppercase</Strength>
                  <Strength met={strength.number}>Number</Strength>
                  <Strength met={strength.symbol}>Symbol</Strength>
                </div>

                {err && (
                  <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !allMet || !matches}
                  className="w-full py-3 rounded-lg bg-[#06201B] text-white font-bold text-sm tracking-wide hover:bg-[#0a3029] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-label"
                >
                  {submitting ? 'Setting password…' : 'Set Password & Continue'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="px-8 py-4 bg-surface-container-low/50 border-t border-outline-variant/10 text-center">
          <p className="text-[11px] text-on-surface-variant/50">PayChain staff will never ask you for your password.</p>
        </div>
      </div>
    </div>
  );
}
