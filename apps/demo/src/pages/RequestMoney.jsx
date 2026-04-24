import { useNotification } from '../context/NotificationContext'

export default function RequestMoney() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const [step, setStep] = useState(1)
  const [selectedOption, setSelectedOption] = useState(null)

  const steps = [
    { id: 1, label: 'Selection' },
    { id: 2, label: 'Payment Details' },
    { id: 3, label: 'Confirm & Request' }
  ]

  const options = [
    {
      id: 'mpesa',
      title: 'Instant M-PESA Prompt',
      description: 'Send prompt to M-PESA phone',
      icon: 'smartphone',
      color: 'bg-[#00351D]',
      textColor: 'text-[#5EFEB3]',
      tag: 'Most Popular'
    },
    {
      id: 'link',
      title: 'Payment Link',
      description: 'Create a shareable payment link',
      icon: 'link',
      color: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      tag: 'Versatile'
    }
  ]

  const handleSelect = (opt) => {
    setSelectedOption(opt)
    setStep(2)
  }

  return (
    <MerchantLayout title="Request Money">
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        {/* Back Button */}
        <button 
          onClick={() => step === 1 ? navigate('/overview') : setStep(step - 1)}
          className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-6 group"
        >
          <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">
            {step === 1 ? 'Back to Dashboard' : 'Previous Step'}
          </span>
        </button>

        {/* Header - Adaptive based on step */}
        <header className="mb-10 text-center lg:text-left">
          <h2 className="font-headline font-bold text-4xl text-primary tracking-tight mb-3">Request Money</h2>
          <p className="text-on-surface-variant font-medium opacity-70 max-w-2xl px-4 lg:px-0 mx-auto lg:mx-0">
            {step === 1 
              ? "Easily request payment from your customers by any of the options below."
              : `Complete your request using the ${selectedOption?.title} option.`}
          </p>
        </header>

        {/* Stepper (Visible after selection) */}
        {step > 1 && (
          <div className="flex items-center justify-between mb-12 px-4 relative max-w-2xl mx-auto lg:mx-0">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-emerald-100 -translate-y-1/2 z-0"></div>
            {steps.map((s) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-500 ${step >= s.id ? 'bg-[#00351D] border-[#00351D] text-white' : 'bg-white border-emerald-100 text-emerald-200'}`}>
                  {s.id}
                </div>
                <p className={`mt-3 text-[10px] uppercase tracking-widest font-black transition-colors duration-500 ${step >= s.id ? 'text-primary' : 'text-emerald-200'}`}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        {step === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {options.map((opt) => (
              <div
                key={opt.id}
                className="bg-white rounded-[32px] border border-slate-100 p-8 text-left transition-all hover:border-emerald-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] group relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-emerald-50 rounded-full opacity-40 blur-3xl group-hover:bg-[#5EFEB3]/20 transition-colors"></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <div className={`w-14 h-14 rounded-2xl ${opt.color} ${opt.textColor} flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform`}>
                      <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-slate-100 text-slate-500 py-1.5 px-3 rounded-full">
                      {opt.tag}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-headline font-bold text-primary mb-2 group-hover:text-emerald-950 transition-colors">
                    {opt.title}
                  </h3>
                  <p className="text-[13px] text-on-surface-variant font-medium opacity-70 mb-8 leading-relaxed">
                    {opt.description}
                  </p>
                  
                  <button 
                    onClick={() => handleSelect(opt)}
                    className="mt-auto py-2.5 px-6 bg-[#5EFEB3] text-[#00351D] rounded-full text-[11px] font-black uppercase tracking-widest self-start hover:brightness-105 hover:scale-105 active:scale-95 transition-all shadow-md group-hover:shadow-emerald-200"
                  >
                    Select Option
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl p-8 lg:p-12 relative max-w-2xl mx-auto lg:mx-0">
            <div className="py-16 text-center">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl ${selectedOption?.color} ${selectedOption?.textColor}`}>
                 <span className="material-symbols-outlined text-4xl animate-pulse">{selectedOption?.icon}</span>
              </div>
              <h3 className="text-2xl font-headline font-bold text-primary mb-3">Step {step}: {steps.find(s => s.id === step)?.label}</h3>
              <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70 leading-relaxed mb-10">
                You're requesting money via <strong>{selectedOption?.title}</strong>. This process is currently being finalized.
              </p>
              
              <div className="flex gap-4">
                 <button 
                   onClick={() => setStep(step - 1)}
                   className="flex-1 py-4 bg-slate-50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all border border-slate-100"
                 >
                   Back
                 </button>
                 <button 
                   onClick={() => {
                     if (step === 3) {
                       addNotification({
                         type: 'notifications',
                         message: `Payment request for ${selectedOption?.title} has been sent.`,
                         title: 'Request Sent'
                       })
                       navigate('/overview')
                     } else {
                       setStep(step + 1)
                     }
                   }}
                   className="flex-1 py-4 bg-[#00351D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
                 >
                   {step === 3 ? 'Confirm & Request' : 'Continue'}
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info/cta */}
        {step === 1 && (
          <div className="mt-16 p-8 rounded-[32px] bg-[#00351D] text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-80 h-80 bg-[#5EFEB3]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-[#5EFEB3]/20 transition-colors"></div>
             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#5EFEB3] mb-1 opacity-80">Developer Friendly</p>
                  <h4 className="text-2xl font-headline font-bold tracking-tight">Integrate our Request API</h4>
                  <p className="text-emerald-100/60 text-sm mt-1">Automate collections with our REST endpoints.</p>
                </div>
                <button className="py-4 px-10 bg-[#5EFEB3] text-[#00351D] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-2xl">
                  View API Docs
                </button>
             </div>
          </div>
        )}
        
        <p className="mt-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
           Payments handled securely by PayChain Global Network
        </p>
      </div>
    </MerchantLayout>
  )
}
