import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { formatKES } from '../utils/formatCurrency';

export default function PaymentPage() {
  const { linkId } = useParams();
  const [linkDetails, setLinkDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [phone, setPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/transactions/payment-link/${linkId}`);
        if (res.data.success) {
          setLinkDetails(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Payment link not found.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLink();
  }, [linkId]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!phone) return;
    setIsPaying(true);
    setPaymentStatus('Initiating secure STK Push...');

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/api/transactions/payment-link/${linkId}/pay`, { phone });
      
      if (res.data.success) {
        setPaymentStatus('Awaiting M-PESA PIN on your phone...');
        // Optionally, we could poll here. For now, we'll just show success message.
        setTimeout(() => {
          setPaymentStatus('Payment triggered successfully. Check your phone.');
          setIsPaying(false);
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process payment.');
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
          <h2 className="font-headline text-2xl text-on-surface tracking-tight mb-2">Oops! Page not found</h2>
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
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
      </div>

      <div className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden relative z-10 border border-outline-variant/10">
        <div className="p-8 md:p-10 flex flex-col items-center text-center border-b border-surface-container">
          <div className="w-16 h-16 bg-primary/5 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-primary/10">
             <span className="material-symbols-outlined text-3xl">shopping_cart_checkout</span>
          </div>
          <h2 className="font-headline text-2xl text-on-surface mb-1">Pay {linkDetails.merchantName}</h2>
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-70">
            Account: {linkDetails.account}
          </p>
        </div>

        <div className="bg-surface-container-lowest p-8 md:p-10 flex flex-col items-center">
          <p className="text-sm font-medium text-on-surface-variant mb-2">Requested Amount</p>
          <h1 className="font-headline text-5xl md:text-6xl text-primary tracking-tighter tabular-nums mb-8">
            {formatKES(linkDetails.amount)}
          </h1>

          <form onSubmit={handlePayment} className="w-full space-y-6">
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1 block text-left">
                Your M-PESA Number
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-sm">
                  +254
                </div>
                <input 
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="712 345 678"
                  className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl md:rounded-3xl py-4 md:py-5 pl-16 pr-6 text-xl md:text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {paymentStatus && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-sm font-medium text-center border border-emerald-100 flex flex-col items-center gap-2">
                 {isPaying && <div className="w-5 h-5 border-2 border-emerald-800/30 border-t-emerald-800 rounded-full animate-spin"></div>}
                 {paymentStatus}
              </div>
            )}

            <button 
              type="submit"
              disabled={isPaying || !phone}
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
