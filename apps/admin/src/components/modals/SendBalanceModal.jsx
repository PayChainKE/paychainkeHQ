import React from 'react';
import api from '../../api/api';
import { formatKES } from '../../utils/formatCurrency';

// "Send remaining balance" — pays a merchant whatever PayChain still holds
// for them (minus the standard M-PESA withdrawal fee) to their primary phone
// or another number they've given, e.g. when pausing operations. Wraps
// merchantBalancePayoutController.js's preview -> request -> confirm flow;
// the confirm code is 5 letters + 1 digit, emailed to the acting admin.
// Shared by the Merchants drawer and Pool Reconciliation's balances table.
export default function SendBalanceModal({ merchant, onClose, onSuccess }) {
  const [stage, setStage] = React.useState('input'); // input | otp | done
  const [destination, setDestination] = React.useState('primary');
  const [phone, setPhone] = React.useState('');
  const [network, setNetwork] = React.useState('');
  const [quote, setQuote] = React.useState(null);
  const [quoteLoading, setQuoteLoading] = React.useState(true);
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  const loadQuote = React.useCallback(async () => {
    setQuoteLoading(true);
    try {
      const res = await api.get(`/api/admin/merchants/${merchant._id}/balance-payout/preview`, {
        params: { destination, ...(destination === 'other' ? { phone } : {}) },
      });
      setQuote(res.data?.data || null);
      if (res.data?.data?.network && !network) setNetwork(res.data.data.network);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load the balance.');
    } finally {
      setQuoteLoading(false);
    }
    // phone is read at call time; re-quoting on every keystroke isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant._id, destination]);

  React.useEffect(() => { loadQuote(); }, [loadQuote]);

  const otpValid = /^[A-Z0-9]{6}$/.test(otp) && (otp.match(/\d/g) || []).length === 1;

  async function requestOtp() {
    if (destination === 'other' && !phone.trim()) {
      setError('Enter the phone number the merchant gave you.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/admin/merchants/${merchant._id}/balance-payout/request`, {
        destination,
        ...(destination === 'other' ? { phone: phone.trim() } : {}),
        ...(network ? { network } : {}),
      });
      if (res.data?.success) {
        setQuote((q) => ({ ...q, ...res.data.data }));
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
    if (!otpValid) {
      setError('The code is 6 characters: 5 letters and 1 digit.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/admin/merchants/${merchant._id}/balance-payout/confirm`, { otp });
      if (res.data?.success) {
        setResult({ ...res.data.data, message: res.data.message });
        setStage('done');
        onSuccess?.(res.data.data);
      } else {
        setError(res.data?.error || 'Payout failed.');
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Payout failed.');
      // A failed code clears the binding server-side — send them back to
      // re-request rather than letting them keep guessing.
      if (e.response?.status === 401) {
        setOtp('');
        setStage('input');
      }
    } finally {
      setBusy(false);
    }
  }

  const label = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1';
  const row = 'flex items-center justify-between text-sm py-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {stage === 'input' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">payments</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Send Remaining Balance</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Pay out everything PayChain holds for <strong>{merchant.businessName}</strong> to a mobile money number. The standard M-PESA withdrawal fee is deducted.
            </p>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/50 px-4 py-3 mb-5">
              {quoteLoading || !quote ? (
                <div className="text-sm text-on-surface-variant py-3 text-center">Loading balance…</div>
              ) : (
                <>
                  <div className={row}><span className="text-on-surface-variant">Current balance</span><span className="font-semibold tabular-nums">{formatKES(quote.kesBalance)}</span></div>
                  {quote.heldAmount > 0 && (
                    <div className={row}><span className="text-on-surface-variant">Held (credited &lt; 2 min ago)</span><span className="tabular-nums text-amber-700">−{formatKES(quote.heldAmount)}</span></div>
                  )}
                  <div className={row}><span className="text-on-surface-variant">Withdrawal fee</span><span className="tabular-nums">−{formatKES(quote.fee)}</span></div>
                  <div className={`${row} border-t border-outline-variant/40 mt-1 pt-2.5`}><span className="font-bold text-on-surface">Merchant receives</span><span className="font-bold text-emerald-700 tabular-nums">{formatKES(quote.amount)}</span></div>
                  <div className={row}><span className="text-on-surface-variant text-xs">Left on account after</span><span className="text-xs tabular-nums">{formatKES(quote.remainingAfter)}</span></div>
                  {quote.cappedAtMax && (
                    <p className="text-[12px] text-amber-700 mt-2">M-PESA caps a single payout at {formatKES(quote.maxPerPayout)}. Send again after this one to clear the rest.</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <span className={label}>Send to</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'primary', title: 'Primary number', sub: merchant.phone || 'None on file' },
                    { key: 'other', title: 'Another number', sub: 'Given by the merchant' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setDestination(opt.key); setError(''); setNetwork(''); }}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${destination === opt.key ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/10' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}
                    >
                      <div className="font-semibold text-on-surface">{opt.title}</div>
                      <div className="text-[12px] text-on-surface-variant truncate">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              {destination === 'other' && (
                <div>
                  <label className={label}>Phone number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm" />
                </div>
              )}
              <div>
                <label className={label}>Network</label>
                <select value={network} onChange={(e) => setNetwork(e.target.value)} className="w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm bg-white">
                  <option value="">Detect from number</option>
                  <option value="safaricom">Safaricom M-PESA</option>
                  <option value="airtel">Airtel Money</option>
                </select>
              </div>
            </div>

            {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button
                onClick={requestOtp}
                disabled={busy || quoteLoading || !quote || quote.amount <= 0 || (destination === 'primary' && !merchant.phone)}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-700 hover:bg-emerald-800"
              >
                {busy ? 'Sending…' : 'Send Code'}
              </button>
            </div>
            {quote && !quoteLoading && quote.amount <= 0 && (
              <p className="text-[12px] text-on-surface-variant mt-3 text-center">Nothing to send — the balance is below M-PESA's KES 10 minimum after fees.</p>
            )}
          </div>
        )}

        {stage === 'otp' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Confirm payout</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Sending <strong>{formatKES(quote?.amount || 0)}</strong> to <strong>{quote?.phone}</strong> ({quote?.network === 'airtel' ? 'Airtel Money' : 'M-PESA'}).
              Enter the code we emailed you: <strong>5 letters and 1 digit</strong>. It expires in 10 minutes.
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
            {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={confirmOtp} disabled={busy || !otpValid} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-700 hover:bg-emerald-800">
                {busy ? 'Sending…' : 'Send Money'}
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="p-8 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${result.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <span className="material-symbols-outlined text-3xl">{result.status === 'pending' ? 'schedule' : 'check_circle'}</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">{result.status === 'pending' ? 'Payout submitted' : 'Balance sent'}</h3>
            <p className="text-sm text-on-surface-variant mb-1">{result.message}</p>
            <p className="text-xs text-on-surface-variant mb-1">Ref <span className="font-mono">{result.reference}</span></p>
            <p className="text-xs text-on-surface-variant mb-5">Left on account: {formatKES(result.newBalance)}</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
