import React from 'react';
import api from '../../api/api';
import { formatKES } from '../../utils/formatCurrency';

// OTP-gated confirmation for a batch of Transaction Tariff edits — mirrors
// ResetContactModal.jsx's stage machine (here: review -> otp -> done),
// wrapping POST /api/admin/tariffs/request-update + confirm-update (see
// controllers/tariffController.js). One code covers the whole batch,
// however many rails/bands were edited in this session.
export default function ConfirmTariffChangeModal({ changes, onClose, onSuccess }) {
  const [stage, setStage] = React.useState('review'); // review | otp | done
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [updatedCount, setUpdatedCount] = React.useState(0);

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/tariffs/request-update', {
        changes: changes.map((c) => ({ key: c.key, max: c.max, newFee: c.newFee })),
      });
      if (res.data?.success) setStage('otp');
      else setError(res.data?.error || 'Could not send code.');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not send code.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/tariffs/confirm-update', { otp });
      if (res.data?.success) {
        setUpdatedCount(changes.length);
        setStage('done');
        onSuccess?.(res.data.data);
      } else {
        setError(res.data?.error || 'Verification failed.');
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={stage === 'done' ? onClose : undefined}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {stage === 'review' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">fact_check</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Confirm {changes.length} tariff change{changes.length === 1 ? '' : 's'}</h3>
            <p className="text-sm text-on-surface-variant mb-4">These take effect platform-wide the moment you verify — every transaction on the affected rail(s) prices at the new rate immediately.</p>
            <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto custom-scrollbar">
              {changes.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-surface-container-low/60 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-on-surface truncate pr-2">{c.label}</span>
                  <span className="text-xs font-mono shrink-0">
                    <span className="text-on-surface-variant/60 line-through">{formatKES(c.oldFee)}</span>
                    {' → '}
                    <span className="font-bold text-emerald-700">{formatKES(c.newFee)}</span>
                  </span>
                </div>
              ))}
            </div>
            {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={requestOtp} disabled={busy} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-600 hover:bg-emerald-700">
                {busy ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </div>
        )}

        {stage === 'otp' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Enter verification code</h3>
            <p className="text-sm text-on-surface-variant mb-5">We sent a 6-digit code to your admin email. It expires in 5 minutes.</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-4 border-2 border-outline-variant/40 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none mb-3"
            />
            {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={confirmOtp} disabled={busy || otp.length !== 6} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-600 hover:bg-emerald-700">
                {busy ? 'Verifying…' : 'Confirm Changes'}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Tariffs updated</h3>
            <p className="text-sm text-on-surface-variant mb-5">{updatedCount} change{updatedCount === 1 ? '' : 's'} are live now — every new transaction on these rails prices at the new rate.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
