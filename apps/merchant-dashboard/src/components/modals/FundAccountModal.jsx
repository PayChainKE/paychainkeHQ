import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { ValidatedInput } from '../ValidatedInput';
import { useToast } from '../../context/NotificationContext';
import { formatKES } from '../../utils/formatCurrency';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function FundAccountModal({ method, onClose }) {
  const { merchant, refreshSession } = useMerchantAuth();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount]   = useState('');
  // Always start empty — user must enter their own number
  const [phone, setPhone]     = useState('');
  const [statusText, setStatusText] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | sent | success | failed

  // Card State
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleMobileSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      addToast({ title: 'Invalid Amount', message: 'Enter a valid amount greater than 0.', type: 'error' });
      return;
    }
    if (!phone || phone.length < 9) {
      addToast({ title: 'Invalid Number', message: 'Enter a valid Kenyan phone number.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatusText('Sending STK Push...');
    setPhase('idle');

    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const res = await axios.post(`${API_URL}/api/callbacks/stk-push`, {
        phone,
        amount: Number(amount),
        merchantId: merchant?._id,
      }, { headers: { Authorization: `Bearer ${token}` } });

      const checkoutId = res.data.checkoutRequestId;
      setPhase('sent');
      setStatusText('Awaiting PIN on your phone...');

      // Poll for confirmation
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await axios.get(
            `${API_URL}/api/callbacks/stk-status/${checkoutId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (statusRes.data.status === 'success') {
            stopPolling();
            setPhase('success');
            setStatusText('');
            addToast({ title: 'Top-Up Successful', message: `KES ${Number(amount).toLocaleString()} has been added to your account.`, type: 'success' });
            await refreshSession();
            setTimeout(onClose, 1800);
          } else if (statusRes.data.status === 'failed') {
            stopPolling();
            setPhase('failed');
            setStatusText('');
            setIsLoading(false);
            addToast({ title: 'Payment Declined', message: statusRes.data.resultDesc || 'M-PESA PIN was incorrect or request was cancelled.', type: 'error' });
          } else if (attempts >= 20) {
            stopPolling();
            setPhase('idle');
            setStatusText('');
            setIsLoading(false);
            addToast({ title: 'Timed Out', message: 'No response from M-PESA after 60 s. If you entered your PIN, funds will reflect shortly.', type: 'error' });
          }
        } catch { /* silent poll error */ }
      }, 3000);

    } catch (err) {
      const msg = err.response?.data?.error || '';
      setPhase('idle');
      setStatusText('');
      setIsLoading(false);
      // If Safaricom actually sent the prompt (the backend errored AFTER calling Safaricom),
      // tell the user to check their phone anyway.
      if (err.response?.status >= 500) {
        addToast({
          title: 'Check Your Phone',
          message: 'The STK prompt may have been sent. If you see an M-PESA prompt, enter your PIN. Otherwise try again.',
          type: 'error',
        });
      } else {
        addToast({ title: 'Failed to Send', message: msg || 'Could not initiate STK Push. Please try again.', type: 'error' });
      }
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { addToast({ title: 'Invalid Amount', message: 'Enter a valid amount.', type: 'error' }); return; }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      await axios.post(`${API_URL}/api/transactions/simulate`, {
        accountNumber: merchant?.paybillAccount,
        amount: Number(amount),
        senderName: cardName,
        senderPhone: 'CARD_PAYMENT',
      }, { headers: { Authorization: `Bearer ${token}` } });
      addToast({ title: 'Payment Successful', message: `KES ${Number(amount).toLocaleString()} added to your account.`, type: 'success' });
      await refreshSession();
      onClose();
    } catch (err) {
      addToast({ title: 'Payment Failed', message: err.response?.data?.error || 'Failed to process card payment.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const METHOD_TITLE = { mobile: 'Mobile Money Top-up', card: 'Secure Card Payment', bank: 'Bank Transfer Details' };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] animate-in fade-in duration-200" onClick={() => { stopPolling(); onClose(); }} />

      <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl w-full sm:max-w-md pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

          {/* Header */}
          <div className="bg-[#00351D] px-6 py-5 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="font-headline text-xl font-bold tracking-tight">{METHOD_TITLE[method]}</h3>
              <p className="text-[11px] text-emerald-300 font-medium mt-0.5">
                Account: <span className="font-bold text-white">{merchant?.paybillAccount}</span>
              </p>
            </div>
            <button
              onClick={() => { stopPolling(); onClose(); }}
              className="relative z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="p-6">

            {/* ── MOBILE MONEY ── */}
            {method === 'mobile' && (
              <>
                {phase === 'sent' ? (
                  /* Waiting for PIN state */
                  <div className="text-center py-6 space-y-5 animate-in fade-in">
                    <div className="relative mx-auto w-20 h-20">
                      <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
                      <div className="relative w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <span className="material-symbols-outlined text-white text-4xl">send_to_mobile</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-headline text-2xl font-bold text-primary">Check Your Phone</h4>
                      <p className="text-sm text-on-surface-variant mt-1 font-medium">
                        An M-PESA prompt has been sent to <span className="font-bold text-primary">{phone}</span>.<br />
                        Enter your PIN to complete the top-up.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold">Waiting for confirmation...</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Top-up: <strong className="text-primary">{formatKES(amount)}</strong></p>
                    <button
                      onClick={() => { stopPolling(); setPhase('idle'); setIsLoading(false); }}
                      className="text-xs text-slate-400 hover:text-primary underline transition-colors"
                    >
                      Didn't receive it? Try again
                    </button>
                  </div>
                ) : phase === 'success' ? (
                  <div className="text-center py-8 space-y-4 animate-in fade-in">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-emerald-600 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <h4 className="font-headline text-2xl font-bold text-primary">Top-Up Received!</h4>
                    <p className="text-on-surface-variant text-sm">{formatKES(amount)} added to your account.</p>
                  </div>
                ) : (
                  <form onSubmit={handleMobileSubmit} className="space-y-5">
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Enter the amount and the M-PESA number to receive the prompt. We will send an STK Push instantly.
                    </p>

                    {/* Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount (KES)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm font-bold">KES</span>
                        <ValidatedInput
                          kind="amount"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          placeholder="0.00"
                          autoFocus
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-14 pr-4 text-primary font-headline font-bold text-2xl focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                          required
                          errorClassName="text-red-500 text-[11px] font-bold mt-1"
                        />
                      </div>
                    </div>

                    {/* Phone — always empty, user must enter */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">M-PESA / Airtel Number</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">smartphone</span>
                        <ValidatedInput
                          kind="phoneKE"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="0712 345 678"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-primary font-bold text-lg focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                          required
                          errorClassName="text-red-500 text-[11px] font-bold mt-1"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 pl-1">Enter the number that will receive the M-PESA prompt.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !amount || !phone || phone.length < 9}
                      className="w-full bg-[#00351D] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-emerald-400 text-lg">send_to_mobile</span>
                          Send STK Push
                        </>
                      )}
                    </button>

                    <p className="text-center text-[10px] text-slate-300 font-medium">
                      Secured by Safaricom Daraja API · No PIN shared with PayChain
                    </p>
                  </form>
                )}
              </>
            )}

            {/* ── CARD ── */}
            {method === 'card' && (
              <form onSubmit={handleCardSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cardholder Name</label>
                  <ValidatedInput kind="personName" value={cardName} onChange={e => setCardName(e.target.value)}
                    placeholder="JOHN DOE" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-primary font-bold focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all uppercase" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card Number</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-xl">credit_card</span>
                    <ValidatedInput kind="cardNumber" value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                      placeholder="0000 0000 0000 0000" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-primary font-mono font-bold tracking-widest focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiry</label>
                    <ValidatedInput kind="cardExpiry" value={expiry} onChange={e => setExpiry(e.target.value)}
                      placeholder="MM/YY" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-primary font-mono text-center tracking-widest focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CVV</label>
                    <ValidatedInput kind="cardCvv" value={cvv} onChange={e => setCvv(e.target.value)}
                      placeholder="•••" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-primary font-mono text-center tracking-widest focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount (KES)</label>
                  <ValidatedInput kind="amount" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-primary font-headline font-bold text-xl focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all" />
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full bg-[#00351D] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-40">
                  {isLoading
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><span className="material-symbols-outlined text-emerald-400 text-lg">lock</span>Pay Securely</>}
                </button>
              </form>
            )}

            {/* ── BANK TRANSFER ── */}
            {method === 'bank' && (
              <div className="space-y-5">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 shrink-0 text-base">info</span>
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    Transfer to your dedicated PayChain account. Funds reflect automatically once cleared.
                  </p>
                </div>
                {[
                  ['Bank', 'PayChain Kenya Bank Ltd'],
                  ['Account Name', merchant?.businessName],
                  ['Account Number', merchant?.paybillAccount],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{label}</span>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                      <span className="font-bold text-primary text-sm">{value}</span>
                      <button onClick={() => navigator.clipboard.writeText(value)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={onClose}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl font-bold text-sm transition-all mt-2">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
