import { useState, useEffect, useCallback } from 'react'
import { checkPlatformAuthenticatorSupport, registerPasskey, loginWithPasskey } from '../hooks/useWebauthn'

// Fingerprint SVG — used as the button icon.
function FingerprintIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1C6.477 1 2 5.477 2 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M22 11c0 4.418-3.582 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M5 11c0-3.866 3.134-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M19 11a7 7 0 0 1-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 8a3 3 0 0 1 3 3c0 3.5-2 7-3 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M9 11a3 3 0 0 1 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 11c0 2.5-1 5.5-1.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// Animated scan ring shown while the browser biometric prompt is active.
function ScanRing() {
  return (
    <span className="relative flex h-5 w-5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500" />
    </span>
  )
}

// ─── BiometricLoginButton ────────────────────────────────────────────────────
// Placed on the Login page. Visible only when the device supports platform
// authenticators (Touch ID, Face ID, Windows Hello, Android fingerprint).
//
// Props:
//   email       — the value from the "Email or phone" field
//   onSuccess   — called with { token, merchant } after successful login
//   onError     — called with an error string
// ─────────────────────────────────────────────────────────────────────────────
export function BiometricLoginButton({ email, onSuccess, onError }) {
  const [supported, setSupported] = useState(null) // null = checking
  const [loading, setLoading] = useState(false)
  const [scanPhase, setScanPhase] = useState(false)

  useEffect(() => {
    checkPlatformAuthenticatorSupport().then(setSupported)
  }, [])

  const handleLogin = useCallback(async () => {
    if (!email?.trim()) {
      onError?.('Enter your email or phone number first, then tap this button.')
      return
    }
    setLoading(true)
    setScanPhase(false)
    try {
      const result = await loginWithPasskey(email.trim(), (phase) => setScanPhase(phase === 'prompt'))
      onSuccess?.(result)
    } catch (err) {
      if (!err?.silent) onError?.(err?.message || 'Biometric authentication failed. Try your password.')
    } finally {
      setLoading(false)
      setScanPhase(false)
    }
  }, [email, onSuccess, onError])

  // Don't render until the compatibility check is done
  if (supported === null || !supported) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-4 lg:py-[18px] rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-800 font-black text-[13px] lg:text-sm uppercase tracking-widest hover:bg-[#06201B] hover:text-white hover:border-[#06201B] active:scale-[0.98] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Sign in with fingerprint or Face ID"
      >
        {scanPhase ? (
          <>
            <ScanRing />
            <span>Touch the sensor now…</span>
          </>
        ) : loading ? (
          <div className="w-5 h-5 border-[3px] border-emerald-800/30 border-t-emerald-800 group-hover:border-white/30 group-hover:border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <FingerprintIcon className="shrink-0 group-hover:text-white" />
            <span>Sign in with Fingerprint / Face ID</span>
          </>
        )}
      </button>
    </div>
  )
}

// ─── BiometricRegisterButton ─────────────────────────────────────────────────
// Placed in Settings / Profile when the merchant is already authenticated.
// Registers a new passkey tied to this device's authenticator.
//
// Props:
//   token       — merchant JWT for Authorization header
//   onSuccess   — called with the server response after registration
//   onError     — called with an error string
// ─────────────────────────────────────────────────────────────────────────────
export function BiometricRegisterButton({ token, onSuccess, onError }) {
  const [supported, setSupported] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scanPhase, setScanPhase] = useState(false)
  const [done, setDone] = useState(false)
  const [unsupportedDismissed, setUnsupportedDismissed] = useState(false)

  useEffect(() => {
    checkPlatformAuthenticatorSupport().then(setSupported)
  }, [])

  const handleRegister = useCallback(async () => {
    setLoading(true)
    setScanPhase(false)
    setDone(false)
    try {
      const result = await registerPasskey(token, (phase) => setScanPhase(phase === 'prompt'))
      setDone(true)
      onSuccess?.(result)
    } catch (err) {
      if (!err?.silent) onError?.(err?.message || 'Passkey registration failed. Try again.')
    } finally {
      setLoading(false)
      setScanPhase(false)
    }
  }, [token, onSuccess, onError])

  if (supported === null) {
    return (
      <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
    )
  }

  if (!supported) {
    if (unsupportedDismissed) return null
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-amber-600 shrink-0 mt-0.5">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-xs font-bold text-amber-800 flex-1">
          This device or browser does not support passkeys. Try Chrome, Safari 16+, or Edge on a device with biometrics.
        </p>
        <button
          type="button"
          onClick={() => setUnsupportedDismissed(true)}
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-amber-600/60 hover:text-amber-800 hover:bg-amber-100 transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-600 shrink-0">
          <path d="M9 12l2 2 4-4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <p className="text-xs font-bold text-emerald-800">Passkey registered! You can now sign in with your fingerprint or Face ID.</p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleRegister}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#06201B] text-white font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {scanPhase ? (
        <>
          <ScanRing />
          <span>Touch the sensor now…</span>
        </>
      ) : loading ? (
        <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          <FingerprintIcon />
          <span>Register Fingerprint / Face ID</span>
        </>
      )}
    </button>
  )
}
