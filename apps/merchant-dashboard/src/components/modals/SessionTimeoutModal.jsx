import React, { useEffect, useState } from 'react'

/**
 * Shown when the user is about to be logged out due to inactivity.
 * Counts down from `countdownSec` seconds; onStay() resets the idle
 * timer, onLogout() signs out immediately.
 */
export default function SessionTimeoutModal({ countdownSec = 120, onStay, onLogout }) {
  const [remaining, setRemaining] = useState(countdownSec)

  useEffect(() => {
    setRemaining(countdownSec)
    const tick = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(tick); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [countdownSec])

  const mins = Math.floor(remaining / 60)
  const secs = String(remaining % 60).padStart(2, '0')
  const pct  = (remaining / countdownSec) * 100
  const urgent = remaining <= 30

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#06201B]/70 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.35)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-300">

        {/* Top accent bar */}
        <div className={`h-1.5 w-full transition-colors duration-500 ${urgent ? 'bg-red-500' : 'bg-[#00351D]'}`} />

        <div className="p-8 text-center">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 transition-colors duration-500 ${urgent ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <span className={`material-symbols-outlined text-3xl transition-colors duration-500 ${urgent ? 'text-red-500' : 'text-[#00351D]'}`}
              style={{ fontVariationSettings: "'FILL' 1" }}>
              lock_clock
            </span>
          </div>

          <h2 className="font-headline text-2xl font-bold text-primary tracking-tight mb-2">
            Session Expiring
          </h2>
          <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-7">
            Your session will end automatically due to inactivity. Sign back in to keep working.
          </p>

          {/* Countdown ring */}
          <div className="relative w-24 h-24 mx-auto mb-7">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
              <circle
                cx="48" cy="48" r="42" fill="none"
                stroke={urgent ? '#EF4444' : '#00351D'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-headline text-2xl font-black tabular-nums transition-colors ${urgent ? 'text-red-500' : 'text-primary'}`}>
                {mins > 0 ? `${mins}:${secs}` : `${remaining}`}
              </span>
              <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                {mins > 0 ? 'min' : 'sec'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onStay}
              className="w-full py-3.5 bg-[#00351D] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Stay Logged In
            </button>
            <button
              onClick={onLogout}
              className="w-full py-3 text-on-surface-variant/60 font-bold text-sm hover:text-primary transition-colors"
            >
              Log Out Now
            </button>
          </div>
        </div>

        {/* Security footnote */}
        <div className="px-8 pb-6 text-center">
          <p className="text-[10px] text-on-surface-variant/40 font-medium uppercase tracking-widest">
            PayChain auto-logout · 15-minute security policy
          </p>
        </div>
      </div>
    </div>
  )
}
