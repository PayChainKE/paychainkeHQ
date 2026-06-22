import React, { useState } from 'react';
import axios from 'axios';
import { useMerchantAuth } from '../../context/MerchantAuthContext';
import { useToast } from '../../context/NotificationContext';

export default function FundAccountModal({ method, onClose }) {
  const { merchant, refreshSession } = useMerchantAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');

  // Mobile Money State
  const [phone, setPhone] = useState(merchant?.phone || '');

  // Card State
  const [cardName, setCardName] = useState(merchant?.name || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const handleSimulatedPayment = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      addToast({ title: 'Invalid Amount', message: 'Please enter a valid amount.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      // Simulate external API network latency for payment gateway
      await new Promise(r => setTimeout(r, 2000));

      const token = localStorage.getItem('paychain_merchant_token');
      
      // We hit the existing /api/transactions/simulate endpoint which credits KES balance
      await axios.post(`${API_URL}/api/transactions/simulate`, {
        accountNumber: merchant.paybillAccount,
        amount: Number(amount),
        senderName: method === 'card' ? cardName : 'Mobile Money Top-up',
        senderPhone: method === 'mobile' ? phone : 'CARD_PAYMENT'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      addToast({ title: 'Payment Successful', message: `Successfully funded ${amount} KES to your account!`, type: 'success' });
      await refreshSession();
      onClose();
    } catch (err) {
      addToast({ title: 'Payment Failed', message: err.response?.data?.error || 'Failed to process payment.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 16);
    const parts = val.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
      val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    setExpiry(val);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#001D10]/40 backdrop-blur-sm z-[200] animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
          
          {/* Header */}
          <div className="bg-[#00351D] px-6 py-5 text-white flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="relative z-10">
              <h3 className="font-headline text-xl font-bold tracking-tight">
                {method === 'mobile' && 'Mobile Money Top-up'}
                {method === 'card' && 'Secure Card Payment'}
                {method === 'bank' && 'Bank Transfer Details'}
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium opacity-90 mt-0.5">
                Fund Business Account: <span className="font-bold">{merchant?.paybillAccount}</span>
              </p>
            </div>
            
            <button onClick={onClose} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="p-6">
            {/* Mobile Money View */}
            {method === 'mobile' && (
              <form onSubmit={handleSimulatedPayment} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">M-Pesa / Airtel Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-lg">smartphone</span>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-11 py-3 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Amount (KES)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">KES</span>
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-headline font-bold rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-14 py-3 outline-none transition-all"
                      required
                      min="10"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#00351D] hover:bg-[#002414] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 mt-4 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Send STK Push
                      <span className="material-symbols-outlined text-sm">send</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 font-medium mt-3">You will receive a prompt on your phone to confirm.</p>
              </form>
            )}

            {/* Card View */}
            {method === 'card' && (
              <form onSubmit={handleSimulatedPayment} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cardholder Name</label>
                  <input 
                    type="text" 
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="JOHN DOE"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 outline-none transition-all uppercase"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Card Number</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 material-symbols-outlined text-xl">credit_card</span>
                    <input 
                      type="text" 
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="0000 0000 0000 0000"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 outline-none transition-all tracking-widest"
                      required
                      minLength="19"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expiry</label>
                    <input 
                      type="text" 
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 outline-none transition-all text-center tracking-widest"
                      required
                      maxLength="5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">CVV</label>
                    <input 
                      type="password" 
                      value={cvv}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                        setCvv(val);
                      }}
                      placeholder="***"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 outline-none transition-all text-center tracking-widest"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 mt-2">Amount to Fund (KES)</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-headline font-bold rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 px-4 py-3 outline-none transition-all"
                    required
                    min="10"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#0D2444] hover:bg-[#071324] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">lock</span>
                      Pay Securely
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-slate-400">
                  <span className="material-symbols-outlined text-[10px]">verified</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest">Secured by PayChain Gateway</span>
                </div>
              </form>
            )}

            {/* Bank Transfer View */}
            {method === 'bank' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 shrink-0">info</span>
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    Transfer funds directly to your dedicated PayChain settlement account. Funds will reflect automatically once cleared.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bank Name</span>
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-sm font-bold text-slate-800">PayChain Kenya Bank Ltd</span>
                      <button className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" onClick={() => navigator.clipboard.writeText('PayChain Kenya Bank Ltd')}>
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Account Name</span>
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-sm font-bold text-slate-800">{merchant?.businessName}</span>
                      <button className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" onClick={() => navigator.clipboard.writeText(merchant?.businessName)}>
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Account Number</span>
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-lg font-headline font-bold text-slate-800">{merchant?.paybillAccount}</span>
                      <button className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors" onClick={() => navigator.clipboard.writeText(merchant?.paybillAccount)}>
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-sm transition-all mt-4"
                >
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
