import React from 'react';
import api from '../../api/api';

// Self-contained OTP-gated email/phone reset flow — wraps the existing
// backend endpoints (POST .../request-action + confirm-action with
// action:'reset_contact', see adminController.js) which already existed
// but had no frontend entry point anywhere. Shared between the Merchants
// page drawer and the KYC/KYB detail page rather than duplicated, since
// both need the same 3-stage input -> otp -> done flow.
export default function ResetContactModal({ merchant, onClose, onSuccess }) {
  const [stage, setStage] = React.useState('input'); // input | otp | done
  const [email, setEmail] = React.useState(merchant.email || '');
  const [phone, setPhone] = React.useState(merchant.phone || '');
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const emailChanged = email.trim().toLowerCase() !== (merchant.email || '').toLowerCase();
  const phoneChanged = phone.trim() !== (merchant.phone || '');

  async function requestOtp() {
    if (!emailChanged && !phoneChanged) {
      setError('Change the email and/or phone number first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/admin/merchants/${merchant._id}/request-action`, {
        action: 'reset_contact',
        ...(emailChanged ? { email: email.trim() } : {}),
        ...(phoneChanged ? { phone: phone.trim() } : {}),
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
      const res = await api.post(`/api/admin/merchants/${merchant._id}/confirm-action`, {
        action: 'reset_contact',
        otp,
      });
      if (res.data?.success) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {stage === 'input' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">contact_mail</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Reset Primary Contact</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Update <strong>{merchant.businessName}</strong>'s login email and/or phone. This resets their active sessions — they'll need to sign in again.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Phone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm" />
              </div>
            </div>
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
            <p className="text-sm text-on-surface-variant mb-5">We sent a 6-digit code to your admin email. It expires in 10 minutes.</p>
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
                {busy ? 'Verifying…' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Contact updated</h3>
            <p className="text-sm text-on-surface-variant mb-5">{merchant.businessName}'s primary contact has been reset and their sessions signed out.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
