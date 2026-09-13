import React from 'react';
import api from '../../api/api';

// OTP-gated bulk re-sync of every existing merchant's frozen tariffLock to
// today's live rates — mirrors ConfirmTariffChangeModal.jsx's stage machine
// (review -> otp -> done), wrapping POST /api/admin/tariffs/request-merchant-
// resync + confirm-merchant-resync (see controllers/tariffController.js).
// Needed because a tariff edit alone only reaches merchants signing up
// afterward (migrations/backfillMerchantTariffLocks.js, 2026-09-03) —
// everyone who already exists stays on whatever they were last frozen to
// until this is run.
export default function ResyncMerchantTariffsModal({ onClose }) {
  const [stage, setStage] = React.useState('review'); // review | otp | done
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [merchantCount, setMerchantCount] = React.useState(null);
  const [resyncedCount, setResyncedCount] = React.useState(0);

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/tariffs/request-merchant-resync', {});
      if (res.data?.success) {
        setMerchantCount(res.data.merchantCount ?? null);
        setStage('otp');
      } else {
        setError(res.data?.error || 'Could not send code.');
      }
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
      const res = await api.post('/api/admin/tariffs/confirm-merchant-resync', { otp });
      if (res.data?.success) {
        setResyncedCount(res.data.resyncedCount || 0);
        setStage('done');
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
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">sync</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Re-sync existing merchants?</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              This re-prices <strong>every existing merchant</strong> to today's live tariff sheet — including anyone frozen to an older rate. It doesn't touch the rates themselves, only which merchants they apply to. New signups already track live rates and aren't affected.
            </p>
            {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={requestOtp} disabled={busy} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-amber-600 hover:bg-amber-700">
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
            <p className="text-sm text-on-surface-variant mb-5">
              We sent a 6-digit code to your admin email. It expires in 5 minutes.
              {merchantCount != null && <> This will re-sync <strong>{merchantCount}</strong> merchant{merchantCount === 1 ? '' : 's'}.</>}
            </p>
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
              <button onClick={confirmOtp} disabled={busy || otp.length !== 6} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-amber-600 hover:bg-amber-700">
                {busy ? 'Verifying…' : 'Re-sync Merchants'}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Merchants re-synced</h3>
            <p className="text-sm text-on-surface-variant mb-5">{resyncedCount} merchant{resyncedCount === 1 ? '' : 's'} now track today's live rates. Future tariff edits will again only reach new signups until you re-sync again.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
