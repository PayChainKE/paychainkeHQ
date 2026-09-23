import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/config'
import mainLogo from '../assets/signin-logo.png'
import { GetAppCard } from '../components/GetAppCard'

function Strength({ met, children }) {
  return (
    <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${met ? 'text-emerald-600' : 'text-gray-400'}`}>
      <span className="material-symbols-outlined text-[14px]">{met ? 'check_circle' : 'circle'}</span>
      {children}
    </div>
  )
}

export default function SetupPassword() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [phase, setPhase] = useState('validating')
  const [merchant, setMerchant] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Phone verification — required so the link alone (email, or the same
  // link the approval SMS also carries) is never enough for whoever opened
  // it to set the password. The caller must also control the registered
  // phone. Sent automatically once the token validates.
  const otpAutoSentRef = useRef(false)
  const [otp, setOtp] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpError, setOtpError] = useState('')

  const strength = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
  const allMet = Object.values(strength).every(Boolean)
  const matches = password.length > 0 && password === confirm

  useEffect(() => {
    if (!token) {
      setPhase('invalid')
      return
    }
    let cancelled = false
    api.get(`/api/auth/merchant/setup-password/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        if (res.data?.success) {
          setMerchant(res.data.data)
          setPhase('ready')
        } else {
          setPhase('invalid')
        }
      })
      .catch(() => { if (!cancelled) setPhase('invalid') })
    return () => { cancelled = true }
  }, [token])

  const sendOtp = async () => {
    setOtpSending(true)
    setOtpError('')
    try {
      const res = await api.post('/api/auth/merchant/setup-password/send-otp', { token })
      if (res.data?.success) {
        setOtpSent(true)
      } else {
        setOtpError(res.data?.error || 'Could not send the verification code.')
      }
    } catch (e) {
      setOtpError(e?.response?.data?.error || 'Could not send the verification code.')
    } finally {
      setOtpSending(false)
    }
  }

  useEffect(() => {
    if (phase === 'ready' && !otpAutoSentRef.current) {
      otpAutoSentRef.current = true
      sendOtp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!otp.trim()) return setErr('Enter the verification code sent to your phone.')
    if (!allMet) return setErr('Password does not meet all requirements.')
    if (!matches) return setErr('Passwords do not match.')
    setSubmitting(true)
    try {
      const res = await api.post('/api/auth/merchant/setup-password', { token, otp: otp.trim(), password })
      if (res.data?.success) {
        setPhase('done')
      } else {
        setErr(res.data?.error || 'Could not set password.')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not set password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FDFDFC] px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="bg-[#06201B] px-8 py-7 text-center">
          <img src={mainLogo} alt="PayChain" className="h-9 w-auto mx-auto object-contain" />
          <p className="mt-3 text-emerald-300 text-xs font-bold uppercase tracking-[0.2em]">Account Setup</p>
        </div>

        <div className="p-8">
          {phase === 'validating' && (
            <div className="text-center py-10">
              <div className="inline-block w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500 text-sm">Validating your invitation…</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">link_off</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h2>
              <p className="text-sm text-gray-500 mb-6">This setup link is no longer valid. Please contact your PayChain administrator to request a new invitation.</p>
              <a href="mailto:support@paychain.co.ke" className="inline-block text-sm font-bold text-[#06201B] underline">support@paychain.co.ke</a>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">You're all set</h2>
              <p className="text-sm text-gray-500 mb-6">Your password is saved. Sign in to open your dashboard.</p>
              <button
                type="button"
                onClick={() => nav('/login?tab=login')}
                className="w-full py-3 rounded-lg bg-[#06201B] text-white font-bold text-sm tracking-wide hover:bg-[#0a3029] transition-colors mb-5"
              >
                Continue to Log In
              </button>
              <GetAppCard heading="Get the PayChain app" source="setup_password_done" />
            </div>
          )}

          {phase === 'ready' && merchant && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Set your password</h2>
              <p className="mt-1 text-sm text-gray-500">
                Welcome, <strong className="text-gray-700">{merchant.name}</strong>.<br/>
                You're setting up access for <strong className="text-gray-700">{merchant.businessName}</strong>.
              </p>
              <p className="mt-3 text-xs text-gray-400">Account email: {merchant.email}</p>

              <div className="mt-5 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-1">Verify it's you</p>
                {otpSending && !otpSent ? (
                  <p className="text-xs text-emerald-700/80">Sending a code to {merchant.maskedPhone || 'your registered phone'}…</p>
                ) : otpSent ? (
                  <p className="text-xs text-emerald-700/80">
                    Code sent to {merchant.maskedPhone || 'your registered phone'}.{' '}
                    <button type="button" onClick={sendOtp} disabled={otpSending} className="font-bold underline disabled:opacity-50">
                      {otpSending ? 'Resending…' : 'Resend code'}
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700/80">
                    <button type="button" onClick={sendOtp} disabled={otpSending} className="font-bold underline disabled:opacity-50">Send verification code</button> to {merchant.maskedPhone || 'your registered phone'}.
                  </p>
                )}
                {otpError && <p className="mt-1.5 text-[11px] font-semibold text-red-600">{otpError}</p>}
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4" autoComplete="off">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#06201B] focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-medium tracking-[0.3em]"
                    placeholder="6-digit code"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-lg focus:border-[#06201B] focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-medium"
                      placeholder="At least 8 characters"
                    />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                      <span className="material-symbols-outlined text-[18px]">{show ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Confirm Password</label>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#06201B] focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-medium"
                    placeholder="Re-enter password"
                  />
                  {confirm.length > 0 && !matches && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-500">Passwords do not match.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                  <Strength met={strength.length}>8+ characters</Strength>
                  <Strength met={strength.upper}>Uppercase</Strength>
                  <Strength met={strength.number}>Number</Strength>
                  <Strength met={strength.symbol}>Symbol</Strength>
                </div>

                {err && (
                  <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting || otp.trim().length !== 6 || !allMet || !matches}
                  className="w-full py-3 rounded-lg bg-[#06201B] text-white font-bold text-sm tracking-wide hover:bg-[#0a3029] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Setting password…' : 'Set Password & Continue'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">PayChain staff will never ask you for your password.</p>
        </div>
      </div>
    </div>
  )
}
