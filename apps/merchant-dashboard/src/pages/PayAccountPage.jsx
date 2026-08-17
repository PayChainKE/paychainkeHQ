import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import paychainLogo from '../../images/logo.png';
import { ValidatedInput } from '../components/ValidatedInput';

// Counterpart to PaymentPage.jsx (/pay/:linkId, one fixed-amount link).
// This is the open-amount flow behind a merchant's static "Settlement QR"
// — the customer picks how much to pay, identified only by the merchant's
// PayChain Account number.
export default function PayAccountPage() {
  const { account } = useParams();
  const [merchantDetails, setMerchantDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollIntervalRef = useRef(null);
  const [feePreview, setFeePreview] = useState(null); // { baseAmount, fee, total } | null

  // The M-PESA prompt itself has no room for a fee breakdown — NCBA's STK
  // Push API only accepts TelephoneNo/Amount/PayBillNo/AccountNo/Network/
  // TransactionType, no free-text field, so the phone just shows one total.
  // This shows the same breakdown here instead, live as the customer types,
  // debounced so we're not hitting the API on every keystroke. Always
  // computed server-side (never duplicated here) so it can never drift from
  // what's actually charged.
  useEffect(() => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeePreview(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/transactions/checkout-preview`, { params: { amount: numericAmount } });
        if (res.data?.success) setFeePreview(res.data);
      } catch {
        setFeePreview(null); // non-critical — the amount is still shown plainly on the button either way
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [amount]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/transactions/pay-account/${account}`);
        if (res.data.success) {
          setMerchantDetails(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Account not found.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMerchant();
  }, [account]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!phone || !amount || Number(amount) <= 0) return;
    setIsPaying(true);
    setPaymentError('');
    setPaymentConfirmed(false);
    setPaymentStatus('Initiating secure STK Push...');

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/transactions/pay-account/${account}`, { phone, amount: Number(amount) });

      if (res.data.success && res.data.checkoutRequestId) {
        setPaymentStatus('Awaiting M-PESA PIN on your phone...');

        let attempts = 0;
        const maxAttempts = 20 // 20 * 3s = 60s
        pollIntervalRef.current = setInterval(async () => {
          attempts++
          try {
            const statusRes = await axios.get(`${API_URL}/api/transactions/public-stk-status/${res.data.checkoutRequestId}`);
            if (statusRes.data.status === 'success') {
              clearInterval(pollIntervalRef.current);
              setPaymentConfirmed(true);
              setPaymentStatus('Payment received. Thank you!');
              setIsPaying(false);
            } else if (statusRes.data.status === 'failed') {
              clearInterval(pollIntervalRef.current);
              setPaymentError(statusRes.data.resultDesc || 'Payment was cancelled or declined.');
              setPaymentStatus('');
              setIsPaying(false);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollIntervalRef.current);
              setPaymentError("We couldn't confirm your payment. If M-PESA deducted your money, it will still reach the merchant — check your M-PESA messages.");
              setPaymentStatus('');
              setIsPaying(false);
            }
          } catch (e) {
            console.error('STK status poll error', e);
          }
        }, 3000)
      }
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Failed to trigger payment on your phone.');
      setIsPaying(false);
      setPaymentStatus('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl max-w-md w-full text-center border border-outline-variant/10">
          <div className="w-20 h-20 mx-auto bg-error/10 rounded-full flex items-center justify-center text-error mb-6">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h2 className="font-headline text-2xl text-on-surface tracking-tight mb-2">Oops! Account not found</h2>
          <p className="text-on-surface-variant font-medium mb-8">{error}</p>
          <Link to="/" className="inline-block px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
      </div>

      <div className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden relative z-10 border border-outline-variant/10">
        <div className="p-8 md:p-10 flex flex-col items-center text-center border-b border-surface-container">
          <div className="mb-6 flex justify-center w-full">
            <img src={paychainLogo} alt="PayChain Logo" className="h-10 object-contain contrast-125 saturate-150" />
          </div>
          <h2 className="font-headline text-2xl text-on-surface mb-1">Pay {merchantDetails.merchantName}</h2>
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-70">
            PayChain Verified Business
          </p>
        </div>

        <div className="bg-surface-container-lowest p-8 md:p-10 flex flex-col items-center">
          <form onSubmit={handlePayment} className="w-full space-y-6">
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1 block text-left">
                Amount (KES)
              </label>
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-lg">KES</span>
                <ValidatedInput
                  kind="amount"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl md:rounded-3xl py-4 md:py-5 pl-16 pr-6 text-xl md:text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
              </div>
              {feePreview && (
                <div className="flex flex-col gap-1 px-1 text-xs font-medium text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Amount</span>
                    <span className="tabular-nums">KES {feePreview.baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {feePreview.fee > 0 && (
                    <div className="flex justify-between">
                      <span>Transaction fee</span>
                      <span className="tabular-nums">KES {feePreview.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-primary pt-1 border-t border-outline-variant/10">
                    <span>Total to pay</span>
                    <span className="tabular-nums">KES {feePreview.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1 block text-left">
                Your M-PESA Number
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">smartphone</span>
                </div>
                <ValidatedInput
                  kind="phoneKE"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl md:rounded-3xl py-4 md:py-5 pl-14 pr-6 text-xl md:text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {paymentStatus && !paymentError && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-sm font-medium text-center border border-emerald-100 flex flex-col items-center gap-2">
                 {isPaying && <div className="w-5 h-5 border-2 border-emerald-800/30 border-t-emerald-800 rounded-full animate-spin"></div>}
                 {paymentConfirmed && <span className="material-symbols-outlined text-2xl">check_circle</span>}
                 {paymentStatus}
              </div>
            )}

            {paymentError && (
              <div className="p-4 bg-error/10 text-error rounded-2xl text-sm font-medium text-center border border-error/20 flex flex-col items-center gap-2">
                 <span className="material-symbols-outlined text-lg">error</span>
                 {paymentError}
              </div>
            )}

            <button
              type="submit"
              disabled={isPaying || !phone || !amount || Number(amount) <= 0}
              className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-[0_10px_30px_rgba(0,53,29,0.3)] hover:shadow-[0_15px_40px_rgba(0,53,29,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50 disabled:grayscale group"
            >
              {!isPaying && <span className="material-symbols-outlined text-emerald-400 group-hover:scale-110 transition-transform">send_to_mobile</span>}
              Pay with M-PESA
            </button>
          </form>

          <div className="mt-8 flex items-center gap-2 text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <p className="text-[9px] font-black uppercase tracking-widest">Secured by PayChain</p>
          </div>
        </div>
      </div>
    </div>
  );
}
