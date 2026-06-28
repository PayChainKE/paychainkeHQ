import { useState, useEffect, useCallback } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Storage key — once set the modal never shows again on this browser.
const PROMPTED_KEY = 'paychain_biometric_setup_done'

// Fingerprint SVG icon
function FingerprintIcon({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 1C6.477 1 2 5.477 2 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M22 11c0 4.418-3.582 8-8 8"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M5 11c0-3.866 3.134-7 7-7"   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M19 11a7 7 0 0 1-7 7"         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 8a3 3 0 0 1 3 3c0 3.5-2 7-3 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M9 11a3 3 0 0 1 3-3"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 11c0 2.5-1 5.5-1.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

// ─── BiometricOnboardingModal ─────────────────────────────────────────────────
// Shows exactly once after a merchant's first successful login/signup on this
// browser. Handled entirely client-side via localStorage so it never re-appears
// across sessions, even if the merchant logs out and back in.
//
// Conditions to show:
//   1. Device supports platform authenticator (Touch ID / Face ID / Windows Hello)
//   2. localStorage does not have PROMPTED_KEY
//   3. merchant.biometricsEnabled is false (not already set up on another device)
// ─────────────────────────────────────────────────────────────────────────────
export default function BiometricOnboardingModal() {
  const { merchant, token } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const [phase, setPhase]     = useState('idle') // idle | scanning | success | error
  const [errMsg, setErrMsg]   = useState('')

  // Check eligibility once the merchant object is available
  useEffect(() => {
    if (!merchant) return
    if (merchant.biometricsEnabled) return
    if (localStorage.getItem(PROMPTED_KEY)) return

    const check = async () => {
      if (!window.PublicKeyCredential) return
      try {
        const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        if (ok) setVisible(true)
      } catch {
        // Unsupported — stay hidden
      }
    }
    check()
  }, [merchant])

  const dismiss = useCallback(() => {
    localStorage.setItem(PROMPTED_KEY, 'true')
    setVisible(false)
  }, [])

  const handleSetup = useCallback(async () => {
    setPhase('scanning')
    setErrMsg('')
    try {
      // 1 — Get options
      const optRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/register-options`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const optData = await optRes.json()
      if (!optRes.ok) throw new Error(optData.error || 'Failed to start registration.')

      // 2 — Trigger native biometric prompt
      const regResponse = await startRegistration({ optionsJSON: optData.options })

      // 3 — Verify
      const verifyRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/verify-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(regResponse),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok || !result.success) throw new Error(result.error || 'Registration failed.')

      setPhase('success')
      setTimeout(dismiss, 2000)
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        // User cancelled the native prompt — go back to idle silently
        setPhase('idle')
        return
      }
      if (err?.name === 'InvalidStateError') {
        setErrMsg('This device is already registered. You can sign in with biometrics next time.')
        setPhase('error')
        setTimeout(dismiss, 3000)
        return
      }
      setErrMsg(err?.message || 'Setup failed. You can try again from Settings.')
      setPhase('error')
    }
  }, [token, dismiss])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={phase === 'idle' ? dismiss : undefined} />

      {/* Card — slides up on mobile, centred on desktop */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl overflow-hidden animate-fade-in-up">

        {/* Green accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />

        <div className="p-7 sm:p-8">
          {phase === 'success' ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5 border-4 border-emerald-200/60">
                <svg width="38" height="38" viewBox="0 0 24 24" className="text-emerald-600" fill="none">
                  <path d="M9 12l2 2 4-4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="font-headline text-2xl text-primary font-black tracking-tight mb-2">All set!</h3>
              <p className="text-sm text-on-surface-variant/70 font-medium leading-relaxed">
                Fingerprint / Face ID is now active. You can sign in instantly next time.
              </p>
            </div>
          ) : (
            <>
              {/* ── Header ── */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <FingerprintIcon size={30} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-0.5">One-time setup</p>
                    <h3 className="font-headline text-xl lg:text-2xl text-primary font-black tracking-tight leading-tight">
                      Enable Fingerprint<br/>Login
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={phase === 'scanning'}
                  className="p-2 rounded-xl text-primary/30 hover:text-primary/60 hover:bg-slate-100 transition-colors disabled:opacity-0"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* ── Feature list ── */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: 'bolt',       label: 'Sign in instantly — no password needed' },
                  { icon: 'shield',     label: 'Bank-grade FIDO2 / WebAuthn security' },
                  { icon: 'phone_iphone', label: 'Works on this device only — completely private' },
                ].map(f => (
                  <div key={f.icon} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-emerald-600 text-[15px]">{f.icon}</span>
                    </div>
                    <p className="text-sm font-medium text-on-surface-variant/80 leading-snug">{f.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Error banner ── */}
              {phase === 'error' && errMsg && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                  <span className="material-symbols-outlined text-red-500 text-base shrink-0 mt-0.5">error_outline</span>
                  <p className="text-xs font-bold text-red-700 leading-relaxed">{errMsg}</p>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleSetup}
                  disabled={phase === 'scanning'}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#06201B] text-white font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {phase === 'scanning' ? (
                    <>
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"/>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"/>
                      </span>
                      Touch the sensor now…
                    </>
                  ) : (
                    <>
                      <FingerprintIcon size={18} />
                      Set Up Now
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={dismiss}
                  disabled={phase === 'scanning'}
                  className="w-full py-3.5 rounded-2xl text-primary/50 font-black text-xs uppercase tracking-widest hover:text-primary/80 hover:bg-slate-50 transition-colors disabled:opacity-0"
                >
                  Skip — I'll do this later
                </button>
              </div>

              {/* ── Privacy note ── */}
              <p className="text-[9px] text-center text-primary/30 font-bold uppercase tracking-[0.15em] mt-4">
                <span className="material-symbols-outlined text-[9px] align-middle mr-1">lock</span>
                Your biometric data never leaves this device
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
