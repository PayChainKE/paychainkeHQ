import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

const STEPS = [
  {
    icon: 'waving_hand',
    title: 'Welcome to PayChain',
    body: "A 60-second tour of what you can do here — skip anytime.",
  },
  {
    icon: 'dashboard',
    title: 'Overview',
    body: 'Your home base — balance, recent activity, and quick actions at a glance.',
  },
  {
    icon: 'send',
    title: 'Send & Request Money',
    body: 'Move money to M-Pesa or bank instantly, or request payment from a customer.',
  },
  {
    icon: 'group_add',
    title: 'Bulk Payments',
    body: 'Pay salaries, suppliers, or many recipients at once — upload a list, review, and send.',
  },
  {
    icon: 'receipt_long',
    title: 'Invoices',
    body: 'Create and send professional invoices, then track who has paid.',
  },
  {
    icon: 'payments',
    title: 'Cash Advance',
    body: 'Short-term working capital, made available against your transaction history.',
  },
  {
    icon: 'settings',
    title: 'Settings & Support',
    body: 'Complete your business profile, manage security, and reach support anytime.',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// ─── MerchantWalkthrough ───────────────────────────────────────────────────
// Shows exactly once, on a merchant's first dashboard login after signup —
// gated server-side (Merchant.hasSeenOnboardingWalkthrough) so it never
// reappears on another device or after a re-login, unlike BiometricOnboarding
// Modal's localStorage-only approach.
// ────────────────────────────────────────────────────────────────────────────
export default function MerchantWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenOnboardingWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenOnboardingWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    setSaving(true)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/onboarding-walkthrough`)
    } catch (err) {
      console.error('Failed to save walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  if (!visible) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />

        <div className="p-7 sm:p-8">
          {/* Progress + Skip */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-emerald-500' : 'w-1.5 bg-emerald-100'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="text-[11px] font-black uppercase tracking-widest text-primary/40 hover:text-primary/70 transition-colors disabled:opacity-0"
            >
              Skip
            </button>
          </div>

          {/* Step content */}
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-5 shrink-0">
              <span className="material-symbols-outlined text-[30px]">{current.icon}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1.5">
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 className="font-headline text-xl lg:text-2xl text-primary font-black tracking-tight mb-3">
              {current.title}
            </h3>
            <p className="text-sm text-on-surface-variant/70 font-medium leading-relaxed">
              {current.body}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-7">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl text-primary/60 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              disabled={saving}
              className="flex-[2] py-3.5 rounded-2xl bg-[#06201B] text-white font-black text-xs uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
