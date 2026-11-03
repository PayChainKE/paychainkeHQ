import React from 'react';
import api from '../../api/api';
import { formatKES } from '../../utils/formatCurrency';

// "Credit from PayChain pool" — PayChain pays a merchant from its own unswept
// revenue held in the pooled NCBA account (goodwill / making a merchant
// whole). Wraps poolCreditController.js's request -> confirm flow. Owner
// only; the confirm code is 5 letters + 1 digit, emailed to the owner.
export default function PoolCreditModal({ merchant, onClose, onSuccess }) {
  const [stage, setStage] = React.useState('input'); // input | otp | done
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [refs, setRefs] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  const otpValid = /^[A-Z0-9]{6}$/.test(otp) && (otp.match(/\d/g) || []).length === 1;
  const amountNum = Number(amount);

  async function requestOtp() {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter the amount to credit.');
    if (reason.trim().length < 10) return setError('Give a reason of at least 10 characters.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/admin/merchants/${merchant._id}/pool-credit/request`, {
        amount: amountNum,
        reason: reason.trim(),
        relatedRefs: refs,
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
    if (!otpValid) return setError('The code is 6 characters: 5 letters and 1 digit.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/admin/merchants/${merchant._id}/pool-credit/confirm`, { otp });
      if (res.data?.success) {
        setResult({ ...res.data.data, message: res.data.message });
        setStage('done');
        onSuccess?.(res.data.data);
      } else {
        setError(res.data?.error || 'Credit failed.');
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Credit failed.');
      if (e.response?.status === 401) {
        setOtp('');
        setStage('input');
      }
    } finally {
      setBusy(false);
    }
  }

  const label = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1';
  const input = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm';
  const btnPrimary = 'flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-700 hover:bg-emerald-800';
  const btnCancel = 'flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all';
  const errorBox = error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {stage === 'input' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Credit from PayChain Pool</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Credit <strong>{merchant.businessName}</strong>'s wallet from PayChain's own funds in the pool, like an internal transfer. It comes out of PayChain's unswept revenue, never other merchants' money.
            </p>
            <div className="text-[13px] px-3 py-2.5 rounded-lg mb-5 bg-amber-50 text-amber-800 border border-amber-100">
              If you have the bank reference for a missed payment, use Pool Reconciliation → Credit Missed Collection instead. Never credit the same payment both ways.
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className={label}>Amount (KES)</label>
                <input type="number" min="1" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" className={input} />
              </div>
              <div>
                <label className={label}>Reason (shown on the audit log)</label>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer payments not reflected on the merchant's wallet — compensating from pool." className={input} />
              </div>
              <div>
                <label className={label}>Original M-PESA refs (optional)</label>
                <input type="text" value={refs} onChange={(e) => setRefs(e.target.value.toUpperCase())} placeholder="UHVCT58LFU, UHV…" className={`${input} font-mono`} />
                <p className="text-[11px] text-on-surface-variant/70 mt-1">Recorded so the same payments aren't credited again later.</p>
              </div>
            </div>

            {errorBox}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className={btnCancel}>Cancel</button>
              <button onClick={requestOtp} disabled={busy} className={btnPrimary}>{busy ? 'Sending…' : 'Send Code'}</button>
            </div>
          </div>
        )}

        {stage === 'otp' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Confirm credit</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Crediting <strong>{formatKES(amountNum)}</strong> to <strong>{merchant.businessName}</strong>. Enter the code we emailed you: <strong>5 letters and 1 digit</strong>. It expires in 10 minutes.
            </p>
            <input
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC1DE"
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-4 border-2 border-outline-variant/40 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none mb-3 uppercase"
            />
            {errorBox}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className={btnCancel}>Cancel</button>
              <button onClick={confirmOtp} disabled={busy || !otpValid} className={btnPrimary}>{busy ? 'Crediting…' : 'Credit Merchant'}</button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Merchant credited</h3>
            <p className="text-sm text-on-surface-variant mb-1">{result.message}</p>
            <p className="text-xs text-on-surface-variant mb-1">Ref <span className="font-mono">{result.reference}</span></p>
            <p className="text-xs text-on-surface-variant mb-5">New balance: {formatKES(result.newBalance)}. The merchant has been sent an SMS and email.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
