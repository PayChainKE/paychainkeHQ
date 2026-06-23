import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useNotification } from '../context/NotificationContext'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatKES } from '../utils/formatCurrency'

export default function SendMoney() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const { merchant, refreshSession } = useMerchantAuth()
  
  const [step, setStep] = useState(1)
  const [destination, setDestination] = useState('')
  const [showDestDropdown, setShowDestDropdown] = useState(false)
  
  // Payment Details State
  const [amount, setAmount] = useState('')
  const [recipientAccount, setRecipientAccount] = useState('')
  const [reference, setReference] = useState('')
  
  // Confirmation State
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const steps = [
    { id: 1, label: 'From / To' },
    { id: 2, label: 'Payment Details' },
    { id: 3, label: 'Confirm & Send' }
  ]

  const destinations = [
    { id: 'mpesa-primary', label: 'Send to primary mpesa phone', fee: 0 },
    { id: 'bank', label: 'Send to Bank account', fee: 50 },
    { id: 'till', label: 'Send to Till', fee: 50 },
    { id: 'paybill', label: 'Send to paybill', fee: 50 },
    { id: 'mobile', label: 'Send to Mobile phone', fee: 50 }
  ]

  const selectedDest = destinations.find(d => d.id === destination)
  const fee = selectedDest?.fee || 0
  const totalAmount = Number(amount || 0) + fee

  return (
    <MerchantLayout title="Send Money">
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        {/* Back Button */}
        <button 
          onClick={() => navigate('/overview')}
          className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-6 group"
        >
          <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
        </button>

        {/* Header */}
        <header className="mb-10 text-center">
          <h2 className="font-headline font-bold text-4xl text-primary tracking-tight mb-2">Send Money</h2>
          <p className="text-on-surface-variant font-medium opacity-70">
            via Bank or M-PESA <button className="text-emerald-700 font-bold hover:underline ml-1">Learn more</button>
          </p>
        </header>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-12 px-4 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-emerald-100 -translate-y-1/2 z-0"></div>
          {steps.map((s, idx) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-500 ${step >= s.id ? 'bg-[#00351D] border-[#00351D] text-white' : 'bg-white border-emerald-100 text-emerald-200'}`}>
                {s.id}
              </div>
              <p className={`mt-3 text-[10px] uppercase tracking-widest font-black transition-colors duration-500 ${step >= s.id ? 'text-primary' : 'text-emerald-200'}`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl p-8 lg:p-10 relative">
          {step === 1 && (
            <div className="space-y-8">
              {/* From Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">From*</label>
                <div className="p-4 lg:p-5 rounded-2xl border border-emerald-100 bg-[#F0FDF4]/30 flex items-center justify-between group hover:border-emerald-300 transition-all cursor-default overflow-hidden">
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-[#00351D] text-[#5EFEB3] flex items-center justify-center shadow-lg shrink-0">
                      <span className="material-symbols-outlined text-lg lg:text-xl">account_balance_wallet</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] lg:text-xs font-black text-primary uppercase tracking-wider truncate">Available balance</p>
                      <p className="text-lg lg:text-xl font-headline text-emerald-700 mt-0.5">{formatKES(merchant?.kesBalance || 0)}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0">check_circle</span>
                </div>
              </div>

              {/* To Selector */}
              <div className="relative">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">To*</label>
                <button 
                  onClick={() => setShowDestDropdown(!showDestDropdown)}
                  className={`w-full p-4 lg:p-5 rounded-2xl border transition-all group flex items-center justify-between text-left ${showDestDropdown ? 'border-emerald-500 bg-white shadow-xl z-[60]' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${destination ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <span className="material-symbols-outlined text-lg lg:text-xl">{destination ? 'stars' : 'ads_click'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[13px] lg:text-sm font-bold truncate ${destination ? 'text-primary' : 'text-slate-400'}`}>
                        {selectedDest?.label || 'Select destination'}
                      </p>
                      {destination && (
                        <p className="text-[9px] lg:text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">
                          Fee: {fee === 0 ? 'Free' : formatKES(fee)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`material-symbols-outlined shrink-0 transition-transform duration-300 ${showDestDropdown ? 'rotate-180 text-emerald-600' : 'text-slate-300'}`}>expand_more</span>
                </button>

                {/* Custom Destination Dropdown */}
                {showDestDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-3 bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.25)] border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
                    <div className="max-h-[300px] overflow-y-auto p-1.5 lg:p-2 space-y-0.5 lg:space-y-1">
                      {destinations.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDestination(d.id)
                            setShowDestDropdown(false)
                            setRecipientAccount(d.id === 'mpesa-primary' ? merchant?.phone || '' : '')
                          }}
                          className={`w-full text-left p-3 lg:p-4 rounded-xl transition-all flex items-center justify-between group ${destination === d.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                            <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full shrink-0 transition-all ${destination === d.id ? 'bg-emerald-500 scale-125' : 'bg-slate-200 group-hover:bg-slate-300'}`}></div>
                            <span className={`text-[12px] lg:text-[13px] font-bold truncate ${destination === d.id ? 'text-emerald-900' : 'text-slate-600'}`}>{d.label}</span>
                          </div>
                          <span className="text-[9px] lg:text-[10px] font-black text-emerald-600 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest shrink-0 ml-2">
                             {d.fee === 0 ? 'Free' : formatKES(d.fee)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-start gap-3">
                 <span className="material-symbols-outlined text-emerald-600">info</span>
                 <p className="text-xs text-emerald-800 font-medium">Please enter the details for your transfer to <span className="font-bold">{selectedDest?.label}</span>. Transfers are processed instantly.</p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Recipient Details*</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">person</span>
                  <input 
                    type={destination.includes('mpesa') || destination === 'mobile' ? 'tel' : 'text'}
                    value={recipientAccount}
                    onChange={(e) => setRecipientAccount(e.target.value)}
                    placeholder={destination.includes('mpesa') || destination === 'mobile' ? "07XX XXX XXX" : "Account or Till Number"}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-12 py-3.5 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Amount to Send (KES)*</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">KES</span>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-headline font-bold rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pl-14 py-3.5 outline-none transition-all"
                    required
                    min="10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Reference / Reason (Optional)</label>
                <input 
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Supplier Payment"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-4 py-3.5 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="text-center">
                <h3 className="font-headline text-2xl font-bold text-primary">Confirm Transfer</h3>
                <p className="text-sm text-on-surface-variant mt-1">Review the details below before authorizing.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">To</span>
                   <span className="text-sm font-bold text-primary text-right">
                     {selectedDest?.label}<br/>
                     <span className="text-xs text-on-surface-variant font-normal">{recipientAccount}</span>
                   </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Amount</span>
                   <span className="text-sm font-bold text-primary">{formatKES(amount || 0)}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Transfer Fee</span>
                   <span className="text-sm font-bold text-primary">{fee === 0 ? 'Free' : formatKES(fee)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                   <span className="text-xs text-primary font-black uppercase tracking-widest">Total Deduction</span>
                   <span className="text-xl font-headline font-black text-emerald-700">{formatKES(totalAmount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 text-center">Enter 4-Digit Security PIN</label>
                <div className="flex justify-center">
                  <input 
                    type="password"
                    maxLength="4"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-32 bg-slate-50 border border-slate-200 text-slate-800 text-2xl tracking-[0.5em] text-center font-bold rounded-xl focus:ring-2 focus:ring-[#00351D]/20 focus:border-[#00351D] px-4 py-3 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-12 flex gap-4">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                disabled={isLoading}
                className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button 
              onClick={async () => {
                if (step === 3) {
                  if (totalAmount > (merchant?.kesBalance || 0)) {
                    addNotification({ title: 'Insufficient Balance', message: 'You do not have enough funds.', type: 'error' });
                    return;
                  }
                  setIsLoading(true);
                  try {
                    const token = localStorage.getItem('paychain_merchant_token');
                    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
                    await axios.post(`${API_URL}/api/callbacks/b2c-request`, {
                      phone: recipientAccount,
                      amount: Number(amount),
                      destination: selectedDest.label,
                      fee,
                      reference
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    
                    addNotification({ title: 'Transfer Complete', message: `Successfully dispatched ${formatKES(amount)} via M-Pesa.`, type: 'success' });
                    await refreshSession();
                    navigate('/overview');
                  } catch (err) {
                    addNotification({ title: 'Transfer Failed', message: err.response?.data?.error || 'Failed to process transfer.', type: 'error' });
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  setStep(step + 1);
                }
              }}
              disabled={(step === 1 && !destination) || (step === 2 && (!amount || !recipientAccount)) || (step === 3 && pin.length < 4) || isLoading}
              className={`flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${((step === 1 && !destination) || (step === 2 && (!amount || !recipientAccount)) || (step === 3 && pin.length < 4) || isLoading) ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-[#00351D] text-white shadow-xl shadow-emerald-900/20 active:scale-[0.98]'}`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                step === 3 ? 'Confirm & Send' : 'Continue'
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
           Transactions are processed securely by PayChain KE
        </p>
      </div>
    </MerchantLayout>
  )
}
