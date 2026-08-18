import { useNotification } from '../context/NotificationContext'

export default function SendMoney() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const [step, setStep] = useState(1)
  const [destination, setDestination] = useState('')
  const [showDestDropdown, setShowDestDropdown] = useState(false)

  const steps = [
    { id: 1, label: 'From / To' },
    { id: 2, label: 'Payment Details' },
    { id: 3, label: 'Confirm & Send' }
  ]

  const destinations = [
    { id: 'mpesa-primary', label: 'Send to primary mpesa phone', fee: 'Free' },
    { id: 'bank', label: 'Send to Bank account', fee: 'Ksh 50.00' },
    { id: 'till', label: 'Send to Till', fee: 'Ksh 50.00' },
    { id: 'paybill', label: 'Send to paybill', fee: 'Ksh 50.00' },
    { id: 'mobile', label: 'Send to Mobile phone', fee: 'Ksh 50.00' }
  ]

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
                      <p className="text-lg lg:text-xl font-headline text-emerald-700 mt-0.5">Ksh 10.00</p>
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
                        {destination ? destinations.find(d => d.id === destination)?.label : 'Select destination'}
                      </p>
                      {destination && (
                        <p className="text-[9px] lg:text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">
                          Fee: {destinations.find(d => d.id === destination)?.fee}
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
                          }}
                          className={`w-full text-left p-3 lg:p-4 rounded-xl transition-all flex items-center justify-between group ${destination === d.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                            <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full shrink-0 transition-all ${destination === d.id ? 'bg-emerald-500 scale-125' : 'bg-slate-200 group-hover:bg-slate-300'}`}></div>
                            <span className={`text-[12px] lg:text-[13px] font-bold truncate ${destination === d.id ? 'text-emerald-900' : 'text-slate-600'}`}>{d.label}</span>
                          </div>
                          <span className="text-[9px] lg:text-[10px] font-black text-emerald-600 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest shrink-0 ml-2">
                             {d.fee === 'Free' ? 'Free' : d.fee.split(' ')[1]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step > 1 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <span className="material-symbols-outlined text-4xl text-emerald-600 animate-pulse">settings</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-primary mb-2 whitespace-nowrap overflow-hidden text-ellipsis px-4">Step {step} Implementation in Progress...</h3>
              <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70">The payment details and confirmation logic will be added in the next update.</p>
            </div>
          )}

          <div className="mt-12 flex gap-4">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                Back
              </button>
            )}
            <button 
              onClick={() => {
                if (step === 3) {
                  addNotification({
                    type: 'payment',
                    message: `Sent payment to ${destinations.find(d => d.id === destination)?.label} successfully.`,
                    title: 'Transfer Complete'
                  })
                  navigate('/overview')
                } else {
                  setStep(step + 1)
                }
              }}
              disabled={step === 1 && !destination}
              className={`flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg ${step === 1 && !destination ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-[#00351D] text-white hover:brightness-110'}`}
            >
              {step === 3 ? 'Confirm & Send' : 'Continue'}
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
