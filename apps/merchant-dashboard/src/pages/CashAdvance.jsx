import React, { useEffect, useState } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { ValidatedInput } from '../components/ValidatedInput'
import { formatKES } from '../utils/formatCurrency'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNotification } from '../context/NotificationContext'
import { ShieldCheck, X, ArrowRight, ArrowLeft, CheckCircle2, Clock, XCircle, Sparkles } from 'lucide-react'

const CASH_ADVANCE_LEARN_MORE_URL = 'https://www.paychain.co.ke/products/cash-advance'
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
const TENOR_OPTIONS = [7, 14, 21, 30, 45, 60]
const ACTIVE_STATUSES = ['pending', 'reviewing', 'approved']

const STEPS = [
  { id: 1, label: 'Advance Details' },
  { id: 2, label: 'Business Snapshot' },
  { id: 3, label: 'Review & Submit' },
]

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('paychain_merchant_token')}` }
}

function UnavailableNotice() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 lg:mb-8">
      <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">info</span>
      <p className="text-[13px] text-amber-900 font-medium leading-relaxed flex-1">
        Cash advance is not available at this time. Keep using your PayChain account and check for your loan limit updates.{' '}
        <a
          href={CASH_ADVANCE_LEARN_MORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline hover:text-amber-950"
        >
          Learn more about cash advance
        </a>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification"
        className="shrink-0 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-full p-1 transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-6 lg:mb-10">
      <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">Cash Advance</h2>
      <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed max-w-2xl">
        Get extra cash for your business today. We take back a small bit from your daily sales until it's paid — no paperwork needed.
      </p>
    </div>
  )
}

const STATUS_META = {
  pending: {
    label: 'Application Submitted',
    sub: "We've received your application and our credit team is reviewing it. This usually takes 1–2 business days.",
    icon: Clock,
    tone: 'bg-white/10 text-[#5EFEB3]',
  },
  reviewing: {
    label: 'Under Review',
    sub: 'Your application is being actively reviewed by our credit team. We may reach out for a quick verification call.',
    icon: Clock,
    tone: 'bg-white/10 text-[#5EFEB3]',
  },
  approved: {
    label: "You're Approved!",
    sub: 'Congratulations — your cash advance has been approved. Funds will be disbursed to your PayChain balance shortly.',
    icon: CheckCircle2,
    tone: 'bg-white/10 text-[#5EFEB3]',
  },
}

function StatusCard({ application, celebratory }) {
  const meta = STATUS_META[application.status] || STATUS_META.pending
  const Icon = meta.icon

  return (
    <div className="bg-[#00351D] text-white p-8 lg:p-12 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden border border-white/5">
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
      <div className="relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md mb-6 ${meta.tone}`}>
            <Icon className="w-9 h-9" strokeWidth={1.75} />
          </div>
          {celebratory && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#5EFEB3] mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Application submitted
            </span>
          )}
          <h3 className="font-headline font-bold text-2xl lg:text-3xl text-white mb-2">{meta.label}</h3>
          <p className="text-sm text-white/70 font-medium max-w-md mx-auto">{meta.sub}</p>
        </div>

        {application.status === 'approved' && application.approvedLimit ? (
          <div className="bg-white/10 border border-white/10 rounded-2xl p-6 mb-6 text-center backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Approved Credit Limit</p>
            <p className="font-headline font-bold text-3xl lg:text-4xl text-[#5EFEB3]">{formatKES(application.approvedLimit)}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Requested</p>
            <p className="text-sm font-bold text-white">{formatKES(application.requestedAmount)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Repayment Period</p>
            <p className="text-sm font-bold text-white">{application.tenorDays} days</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Submitted</p>
            <p className="text-sm font-bold text-white">{new Date(application.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {application.reviewNotes ? (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1.5">Note from our team</p>
            <p className="text-sm text-white/80 leading-relaxed">{application.reviewNotes}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DeclinedBanner({ application, onApplyAgain }) {
  return (
    <div className="bg-white p-6 lg:p-8 rounded-[28px] border border-rose-100 shadow-sm mb-6 lg:mb-8">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
          <XCircle className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <h4 className="font-headline font-bold text-lg text-primary mb-1">Your previous application wasn't approved</h4>
          <p className="text-[13px] text-on-surface-variant font-medium opacity-80 leading-relaxed mb-1">
            {application.reviewNotes || 'Keep building your transaction history and trust score, then feel free to apply again.'}
          </p>
          <button
            onClick={onApplyAgain}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-primary hover:text-emerald-700 transition-colors"
          >
            Apply again <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DisabledState() {
  return (
    <MerchantLayout title="Cash Advance">
      <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
        <UnavailableNotice />
        <PageHeader />
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mb-6 border border-outline-variant/20 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">lock</span>
          </div>
          <h3 className="text-2xl font-headline font-bold text-primary mb-3">Applications Are Currently Paused</h3>
          <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80 mb-6">
            Cash advance applications aren't open for your account right now. Reach out to your PayChain account manager for details.
          </p>
          <a href="mailto:support@paychain.co.ke?subject=Cash%20Advance%20Application" className="bg-[#0B0E14] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-black active:scale-95 transition-all">
            Contact Support
          </a>
        </div>
      </div>
    </MerchantLayout>
  )
}

export default function CashAdvance() {
  const { merchant } = useMerchantAuth()
  const { addNotification } = useNotification()

  const [trustData, setTrustData] = useState(null)
  const [applications, setApplications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(null)

  const [requestedAmount, setRequestedAmount] = useState('')
  const [tenorDays, setTenorDays] = useState(30)
  const [purpose, setPurpose] = useState('')
  const [monthlyRevenueEstimate, setMonthlyRevenueEstimate] = useState('')
  const [yearsInOperation, setYearsInOperation] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const formDisabled = !!(merchant?.features && merchant.features.cashAdvanceForm === false)

  useEffect(() => {
    if (!merchant) {
      setIsLoading(false)
      return
    }
    if (contactPhone === '' && merchant.phone) setContactPhone(merchant.phone)

    async function load() {
      try {
        const [trustRes, appsRes] = await Promise.allSettled([
          axios.get(`${API_URL}/api/trust-score`, { headers: authHeaders() }),
          axios.get(`${API_URL}/api/cash-advance/my-applications`, { headers: authHeaders() }),
        ])

        if (trustRes.status === 'fulfilled') {
          setTrustData(trustRes.value.data)
        } else {
          console.error('Failed to fetch trust score', trustRes.reason)
          setTrustData({ eligibleForAdvance: false })
        }

        if (appsRes.status === 'fulfilled') {
          setApplications(appsRes.value.data?.applications || [])
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant])

  const latestApplication = applications[0] || null
  const activeApplication = latestApplication && ACTIVE_STATUSES.includes(latestApplication.status) ? latestApplication : null

  function startForm() {
    setShowForm(true)
    setFormStep(1)
    setJustSubmitted(null)
  }

  function resetFormFields() {
    setRequestedAmount('')
    setTenorDays(30)
    setPurpose('')
    setMonthlyRevenueEstimate('')
    setYearsInOperation('')
    setBusinessAddress('')
  }

  function validateStep1() {
    const amount = Number(requestedAmount)
    if (!Number.isFinite(amount) || amount < 1000) {
      addNotification({ title: 'Invalid Amount', message: 'Enter a requested amount of at least KES 1,000.', type: 'error' })
      return false
    }
    if (purpose.trim().length < 10) {
      addNotification({ title: 'Tell Us More', message: 'Describe what the funds are for (at least 10 characters).', type: 'error' })
      return false
    }
    return true
  }

  function goNext() {
    if (formStep === 1 && !validateStep1()) return
    setFormStep((s) => Math.min(3, s + 1))
  }

  function goBack() {
    setFormStep((s) => Math.max(1, s - 1))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      const res = await axios.post(`${API_URL}/api/cash-advance/apply`, {
        requestedAmount: Number(requestedAmount),
        tenorDays: Number(tenorDays),
        purpose: purpose.trim(),
        monthlyRevenueEstimate: monthlyRevenueEstimate === '' ? null : Number(monthlyRevenueEstimate),
        yearsInOperation: yearsInOperation === '' ? null : Number(yearsInOperation),
        businessAddress: businessAddress.trim() || null,
        contactPhone: contactPhone.trim() || null,
      }, { headers: authHeaders() })

      const application = res.data?.application
      setApplications((prev) => [application, ...prev])
      setJustSubmitted(application)
      setShowForm(false)
      resetFormFields()
      addNotification({ title: 'Application Submitted', message: 'Our credit team will review it shortly.', type: 'success' })
    } catch (err) {
      addNotification({ title: 'Submission Failed', message: err.response?.data?.error || 'Could not submit your application. Please try again.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || !trustData) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MerchantLayout>
    )
  }

  if (formDisabled) {
    return <DisabledState />
  }

  if (!trustData.eligibleForAdvance) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
          <UnavailableNotice />
          <PageHeader />
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mb-6 border border-outline-variant/20 shadow-sm">
              <ShieldCheck className="w-10 h-10 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-headline font-bold text-primary mb-3">Keep building your Trust Score</h3>
            <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80 mb-6">
              Your Trust Score needs to reach 60 before you can get a Cash Advance. Keep transacting through your PayChain account and your score will keep going up!
            </p>
            <a href={CASH_ADVANCE_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer" className="bg-[#0B0E14] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-black active:scale-95 transition-all">
              Learn More
            </a>
          </div>
        </div>
      </MerchantLayout>
    )
  }

  if (justSubmitted) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
          <PageHeader />
          <StatusCard application={justSubmitted} celebratory />
        </div>
      </MerchantLayout>
    )
  }

  if (activeApplication && !showForm) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
          <PageHeader />
          <StatusCard application={activeApplication} />
        </div>
      </MerchantLayout>
    )
  }

  if (showForm) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="px-1 lg:px-0 max-w-3xl mx-auto w-full">
          <button
            onClick={() => (formStep === 1 ? setShowForm(false) : goBack())}
            className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {formStep === 1 ? 'Cancel' : 'Previous Step'}
            </span>
          </button>

          <header className="mb-10 text-center">
            <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight mb-3">Cash Advance Application</h2>
            <p className="text-on-surface-variant font-medium opacity-70 max-w-xl mx-auto">
              A quick, three-step application. Based on your Trust Score of {trustData.current}, our credit team will review and respond within 1–2 business days.
            </p>
          </header>

          <div className="flex items-center justify-between mb-12 px-4 relative max-w-xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-emerald-100 -translate-y-1/2 z-0"></div>
            {STEPS.map((s) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-500 ${formStep >= s.id ? 'bg-[#00351D] border-[#00351D] text-white' : 'bg-white border-emerald-100 text-emerald-200'}`}>
                  {formStep > s.id ? <CheckCircle2 className="w-5 h-5" /> : s.id}
                </div>
                <p className={`mt-3 text-[10px] uppercase tracking-widest font-black text-center transition-colors duration-500 max-w-[90px] ${formStep >= s.id ? 'text-primary' : 'text-emerald-200'}`}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl p-8 lg:p-12">
            {formStep === 1 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">How much do you need? (KES)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="50,000"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-5 px-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Preferred repayment period</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {TENOR_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setTenorDays(days)}
                        className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wide border transition-all ${tenorDays === days ? 'bg-[#00351D] border-[#00351D] text-white shadow-lg' : 'bg-surface-container-low border-outline-variant/10 text-primary/70 hover:border-primary/30'}`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">What's this advance for?</label>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={4}
                    placeholder="e.g. Restocking inventory ahead of the festive season..."
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-5 px-6 text-sm font-medium text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {formStep === 2 && (
              <div className="space-y-8">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Avg. monthly revenue (KES)</label>
                    <input
                      type="number"
                      min="0"
                      value={monthlyRevenueEstimate}
                      onChange={(e) => setMonthlyRevenueEstimate(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-4 px-6 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Years in operation</label>
                    <input
                      type="number"
                      min="0"
                      value={yearsInOperation}
                      onChange={(e) => setYearsInOperation(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-4 px-6 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Business address</label>
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-4 px-6 text-sm font-medium text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Best contact number</label>
                  <ValidatedInput
                    kind="phoneKE"
                    optional
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-4 px-6 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {formStep === 3 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center mb-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-2xl">fact_check</span>
                  </div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-1">Review your application</h3>
                  <p className="text-[13px] text-on-surface-variant font-medium opacity-70">Double-check the details below before submitting.</p>
                </div>

                <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 divide-y divide-outline-variant/10">
                  <SummaryRow label="Requested amount" value={requestedAmount ? formatKES(Number(requestedAmount)) : '—'} />
                  <SummaryRow label="Repayment period" value={`${tenorDays} days`} />
                  <SummaryRow label="Purpose" value={purpose || '—'} />
                  {monthlyRevenueEstimate && <SummaryRow label="Avg. monthly revenue" value={formatKES(Number(monthlyRevenueEstimate))} />}
                  {yearsInOperation && <SummaryRow label="Years in operation" value={yearsInOperation} />}
                  {businessAddress && <SummaryRow label="Business address" value={businessAddress} />}
                  {contactPhone && <SummaryRow label="Contact number" value={contactPhone} />}
                  <SummaryRow label="Current Trust Score" value={`${trustData.current} / 100`} />
                </div>

                <p className="text-[11px] text-on-surface-variant/60 font-medium text-center leading-relaxed px-4">
                  By submitting, you confirm the information above is accurate. Our credit team will review your application and get back to you within 1–2 business days.
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-10">
              {formStep > 1 && (
                <button
                  onClick={goBack}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-slate-50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-40"
                >
                  Back
                </button>
              )}
              {formStep < 3 ? (
                <button
                  onClick={goNext}
                  className="flex-1 py-4 bg-[#00351D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-[#5EFEB3] text-[#00351D] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-105 transition-all shadow-xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#00351D]/30 border-t-[#00351D] rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : 'Submit Application'}
                </button>
              )}
            </div>
          </div>
        </div>
      </MerchantLayout>
    )
  }

  return (
    <MerchantLayout title="Cash Advance">
      <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
        <PageHeader />

        {latestApplication?.status === 'declined' && (
          <DeclinedBanner application={latestApplication} onApplyAgain={startForm} />
        )}

        <div className="bg-[#00351D] text-white p-8 lg:p-12 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5 text-center">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md mb-6">
              <span className="material-symbols-outlined text-4xl text-[#5EFEB3]">verified</span>
            </div>
            <h3 className="font-headline font-bold text-2xl lg:text-3xl text-white mb-2">You are Eligible!</h3>
            <p className="text-sm text-white/70 font-medium max-w-md mx-auto mb-8">
              Based on your Trust Score of {trustData.current}, you are eligible to apply for a cash advance. Complete a short application and our lending team will review it within 1–2 business days.
            </p>
            <button onClick={startForm} className="bg-[#5EFEB3] text-[#00351D] px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-white transition-all active:scale-95">
              Start Application
            </button>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="px-5 py-4 flex items-start justify-between gap-4">
      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-bold text-primary text-right break-words">{value}</span>
    </div>
  )
}
