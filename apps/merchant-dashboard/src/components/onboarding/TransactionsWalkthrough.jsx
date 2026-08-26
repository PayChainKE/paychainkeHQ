import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

const STEPS = [
  {
    icon: 'receipt_long',
    title: 'Your Transaction History',
    body: 'Every payment in and out of your account lands here, searchable and filterable by date, type, or status.',
  },
  {
    icon: 'description',
    title: 'Export a Statement',
    body: 'Tap Export Statement, pick a period — last 7 days, 30 days, this month, this year, or a custom range — and download an official PDF. A copy is also emailed to you automatically.',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Shows exactly once, on a merchant's first visit to Transactions — same
// server-gated one-time pattern as the other walkthroughs.
export default function TransactionsWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenTransactionsWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenTransactionsWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    setSaving(true)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/transactions-walkthrough`)
    } catch (err) {
      console.error('Failed to save transactions walkthrough completion', err)
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
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
