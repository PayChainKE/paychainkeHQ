import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { ValidatedInput } from '../components/ValidatedInput'
import { useNotification } from '../context/NotificationContext'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { getAppUrl } from '../utils/appUrl'
import { formatKES } from '../utils/formatCurrency'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export default function RequestMoney() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addNotification } = useNotification()
  const { merchant, refreshSession } = useMerchantAuth()
  const [step, setStep] = useState(1)
  const [selectedOption, setSelectedOption] = useState(null)

  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  // Previously a failed/timed-out STK request only showed a toast and reset
  // back to the same plain amount/phone form — indistinguishable from never
  // having submitted at all, so a merchant glancing back at the screen had
  // no idea what actually happened. Now routes to the same step-3 outcome
  // screen success already uses, just in its failed variant.
  const [requestFailed, setRequestFailed] = useState(false)
  const [failureReason, setFailureReason] = useState('')
  const [feePreview, setFeePreview] = useState(null) // { baseAmount, fee, total } | null
  const pollIntervalRef = useRef(null)

  // The customer on the other end of an M-PESA prompt never sees any
  // PayChain page (unlike Payment Links / Pay Account, which show this same
  // breakdown before the customer submits) — the prompt is a fixed
  // Safaricom template with no room to explain a fee, so a merchant
  // requesting KES 100 has their customer see a prompt for KES 113 with no
  // context. Showing the merchant the true total here, before they send it,
  // means they know to mention it to the customer themselves (a customer
  // also now gets a heads-up SMS — see buildPaymentRequestSms).
  useEffect(() => {
    const numericAmount = Number(amount)
    if (selectedOption?.id !== 'mpesa' || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeePreview(null)
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/transactions/checkout-preview`, { params: { amount: numericAmount } })
        if (res.data?.success) setFeePreview(res.data)
      } catch {
        setFeePreview(null)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [amount, selectedOption])

  // Stop the STK status poll if the merchant navigates away mid-request —
  // without this, the interval kept running after unmount and called
  // setState on stale closures (checkoutId/amount from whatever request was
  // in flight when the component was torn down).
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

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

  const resetForm = () => {
    setAmount('')
    setPhone('')
    setGeneratedLink('')
    setStatusText('')
    setRequestFailed(false)
    setFailureReason('')
  }

  const handleSelect = (opt) => {
    setSelectedOption(opt)
    resetForm()
    setStep(2)
  }

  // Overview's Quick Action tiles link here with { state: { preset: 'mpesa' | 'link' } }
  // to skip the selection step entirely. Runs once on arrival — replacing the
  // history entry drops the state so a manual refresh doesn't re-trigger it.
  useEffect(() => {
    const preset = location.state?.preset
    if (!preset) return
    const opt = options.find(o => o.id === preset)
    if (opt) handleSelect(opt)
    navigate(location.pathname, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('paychain_merchant_token')}`
  })

  const sendMpesaPrompt = async () => {
    if (!amount || Number(amount) <= 0 || !phone) {
      addNotification({ title: 'Missing Details', message: 'Enter a valid amount and phone number.', type: 'error' })
      return
    }

    setIsSubmitting(true)
    setStatusText('Sending M-PESA prompt...')
    try {
      const pushRes = await axios.post(`${API_URL}/api/callbacks/stk-push`, {
        amount: Number(amount),
        phone,
        merchantId: merchant._id,
        purpose: 'request_money'
      }, { headers: authHeaders() })

      const checkoutId = pushRes.data.checkoutRequestId
      setStatusText('Awaiting PIN on their phone...')

      let attempts = 0
      const maxAttempts = 20 // 20 * 3s = 60s
      pollIntervalRef.current = setInterval(async () => {
        attempts++
        try {
          const statusRes = await axios.get(`${API_URL}/api/callbacks/stk-status/${checkoutId}`, { headers: authHeaders() })

          if (statusRes.data.status === 'success') {
            clearInterval(pollIntervalRef.current)
            setIsSubmitting(false)
            setStatusText('')
            await refreshSession()
            addNotification({ title: 'Payment Received', message: `${formatKES(amount)} has been received.`, type: 'success' })
            setStep(3)
          } else if (statusRes.data.status === 'failed') {
            clearInterval(pollIntervalRef.current)
            setIsSubmitting(false)
            setStatusText('')
            setRequestFailed(true)
            setFailureReason(statusRes.data.resultDesc || 'They cancelled or the request failed.')
            addNotification({ title: 'Request Failed', message: statusRes.data.resultDesc || 'They cancelled or the request failed.', type: 'error' })
            setStep(3)
          } else if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current)
            setIsSubmitting(false)
            setStatusText('')
            setRequestFailed(true)
            setFailureReason('The request timed out waiting for a response.')
            addNotification({ title: 'Timeout', message: 'The request timed out. Please try again.', type: 'error' })
            setStep(3)
          }
        } catch (e) {
          console.error('STK status poll error', e)
        }
      }, 3000)
    } catch (err) {
      setIsSubmitting(false)
      setStatusText('')
      if (err.response?.status >= 500) {
        setRequestFailed(true)
        setFailureReason('The prompt may have been sent. If they see an M-PESA popup, they can still enter their PIN — check your transaction history shortly.')
        addNotification({ title: 'Check Their Phone', message: 'The prompt may have been sent. If they see an M-PESA popup, they can still enter their PIN.', type: 'error' })
      } else {
        setRequestFailed(true)
        setFailureReason(err.response?.data?.error || 'Could not send M-PESA prompt.')
        addNotification({ title: 'Request Failed', message: err.response?.data?.error || 'Could not send M-PESA prompt.', type: 'error' })
      }
      setStep(3)
    }
  }

  const createPaymentLink = async () => {
    if (!amount || Number(amount) <= 0) {
      addNotification({ title: 'Invalid Amount', message: 'Please enter a valid amount.', type: 'error' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await axios.post(`${API_URL}/api/transactions/payment-link`, {
        amount: Number(amount)
      }, { headers: authHeaders() })

      if (res.data?.success) {
        setGeneratedLink(`${getAppUrl()}/pay/${res.data.linkId}`)
        addNotification({ title: 'Link Generated', message: 'Secure payment link created. Expires in 48 hours.', type: 'success' })
        setStep(3)
      }
    } catch (err) {
      addNotification({ title: 'Generation Failed', message: err.response?.data?.error || 'Failed to generate payment link.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrimaryAction = () => {
    if (selectedOption?.id === 'mpesa') return sendMpesaPrompt()
    if (selectedOption?.id === 'link') return createPaymentLink()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    addNotification({ title: 'Link Copied', message: 'Payment link copied to clipboard.', type: 'success' })
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pay ${merchant?.businessName || 'PayChain'}`, url: generatedLink })
      } catch (err) {
        // user cancelled share sheet — nothing to do
      }
    } else {
      copyLink()
    }
  }

  return (
    <MerchantLayout title="Request Money">
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        {/* Back Button */}
        <button
          onClick={() => step === 1 ? navigate('/overview') : setStep(step - 1)}
          disabled={isSubmitting}
          className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-6 group disabled:opacity-40 disabled:cursor-not-allowed"
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
        ) : step === 2 ? (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl p-8 lg:p-12 relative max-w-2xl mx-auto lg:mx-0">
            <div className="flex flex-col items-center text-center mb-10">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${selectedOption?.color} ${selectedOption?.textColor}`}>
                <span className="material-symbols-outlined text-3xl">{selectedOption?.icon}</span>
              </div>
              <h3 className="text-2xl font-headline font-bold text-primary mb-2">Payment Details</h3>
              <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70 leading-relaxed">
                {selectedOption?.id === 'mpesa'
                  ? "We'll send an M-PESA prompt to this number for them to complete."
                  : 'Set an amount and we\'ll generate a secure, shareable link.'}
              </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount (KES)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1,000"
                  className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-5 px-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
                {feePreview && (
                  <div className="flex flex-col gap-1 px-1 text-xs font-medium text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>They'll be asked to pay</span>
                      <span className="tabular-nums font-black text-primary">{formatKES(feePreview.total)}</span>
                    </div>
                    {feePreview.fee > 0 && (
                      <span className="text-[11px] opacity-70">Includes a {formatKES(feePreview.fee)} transaction fee on top of your {formatKES(feePreview.baseAmount)} request.</span>
                    )}
                  </div>
                )}
              </div>

              {selectedOption?.id === 'mpesa' && (
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Customer's M-PESA Number</label>
                  <ValidatedInput
                    kind="phoneKE"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-5 px-6 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-slate-50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  onClick={handlePrimaryAction}
                  disabled={isSubmitting || !amount || (selectedOption?.id === 'mpesa' && !phone)}
                  className="flex-1 py-4 bg-[#00351D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {statusText || 'Processing...'}
                    </>
                  ) : selectedOption?.id === 'mpesa' ? 'Send Prompt' : 'Generate Link'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl p-8 lg:p-12 relative max-w-2xl mx-auto lg:mx-0">
            <div className="py-10 text-center">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl text-white ${selectedOption?.id === 'mpesa' && requestFailed ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                <span className="material-symbols-outlined text-4xl">{selectedOption?.id === 'mpesa' && requestFailed ? 'error' : 'check_circle'}</span>
              </div>

              {selectedOption?.id === 'mpesa' ? (
                requestFailed ? (
                  <>
                    <h3 className="text-2xl font-headline font-bold text-rose-600 mb-3">Request Failed</h3>
                    <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70 leading-relaxed mb-10">
                      {failureReason}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-headline font-bold text-primary mb-3">Payment Received</h3>
                    <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70 leading-relaxed mb-10">
                      {formatKES(amount)} has been credited to your PayChain balance.
                    </p>
                  </>
                )
              ) : (
                <>
                  <h3 className="text-2xl font-headline font-bold text-primary mb-3">Link Ready to Share</h3>
                  <p className="text-on-surface-variant font-medium max-w-sm mx-auto opacity-70 leading-relaxed mb-6">
                    Share this link with your customer to collect {formatKES(amount)}.
                  </p>
                  <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 mb-6 break-all text-sm font-medium text-primary">
                    {generatedLink}
                  </div>
                  <div className="flex gap-3 justify-center mb-4">
                    <button onClick={copyLink} className="px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-primary hover:bg-slate-100 transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">content_copy</span> Copy
                    </button>
                    <button onClick={shareLink} className="px-5 py-3 bg-[#5EFEB3] text-[#00351D] rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-105 transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">share</span> Share
                    </button>
                  </div>
                </>
              )}

              <button
                // Retry keeps the amount/phone already entered — no reason to
                // make the merchant retype the same details for a second
                // attempt, just clear the failed state so the form re-enables.
                onClick={selectedOption?.id === 'mpesa' && requestFailed ? () => { setRequestFailed(false); setFailureReason(''); setStep(2) } : () => navigate('/overview')}
                className="mt-4 py-4 px-10 bg-[#00351D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
              >
                {selectedOption?.id === 'mpesa' && requestFailed ? 'Try Again' : 'Back to Dashboard'}
              </button>
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
                <a
                  href="mailto:support@paychain.co.ke?subject=API%20Documentation%20Request"
                  className="py-4 px-10 bg-[#5EFEB3] text-[#00351D] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-2xl"
                >
                  Contact Us
                </a>
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
