import React, { useState } from 'react'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

// In-page password reset for the sign-in screen: phone number or email →
// 6-digit code (sent by SMS and email) → new password. Uses the same real
// backend endpoints as the Stellar connect panel's reset flow.
const inputCls = 'w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40'
const labelCls = 'text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1'
const buttonCls = 'w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-40'

export default function ForgotPasswordPanel({ initialIdentifier = '', onDone, onCancel }) {
  const { realForgotPassword, realVerifyResetOtp, realResetPassword } = useMerchantAuth()
  const [stage, setStage] = useState('identifier') // identifier | otp | password
  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [sentTo, setSentTo] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendCode(e) {
    e?.preventDefault()
    if (!identifier.trim()) return setErr('Enter your phone number or email.')
    setLoading(true); setErr('')
    const res = await realForgotPassword(identifier.trim())
    setLoading(false)
    if (!res.success) return setErr(res.error)
    const masked = [res.maskedPhone, res.maskedEmail].filter(Boolean).join(' and ')
    setSentTo(masked)
    setStage('otp')
  }

  async function verifyCode(e) {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp.trim())) return setErr('Enter the 6-digit code.')
    setLoading(true); setErr('')
    const res = await realVerifyResetOtp(identifier.trim(), otp.trim())
    setLoading(false)
    if (!res.success || !res.resetToken) return setErr(res.error || 'Invalid or expired code.')
    setResetToken(res.resetToken)
    setStage('password')
  }

  async function savePassword(e) {
    e.preventDefault()
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    if (password !== confirm) return setErr('Passwords do not match.')
    setLoading(true); setErr('')
    const res = await realResetPassword(resetToken, password)
    setLoading(false)
    if (!res.success) return setErr(res.error)
    onDone(identifier.trim())
  }

  const title = { identifier: 'Reset password', otp: 'Enter code', password: 'New password' }[stage]
  const subtitle = {
    identifier: 'Enter the phone number or email on your PayChain account. We’ll send you a 6-digit code.',
    otp: sentTo ? `We sent a 6-digit code to ${sentTo}.` : 'If an account matches, we sent a 6-digit code to its phone and email.',
    password: 'Choose a new password of at least 8 characters.',
  }[stage]

  return (
    <div className="animate-fade-in-up duration-500">
      <div className="mb-8 lg:mb-10">
        <h3 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight font-black">{title}</h3>
        <p className="text-on-surface-variant font-medium mt-2 opacity-70">{subtitle}</p>
      </div>

      <form onSubmit={stage === 'identifier' ? sendCode : stage === 'otp' ? verifyCode : savePassword} className="space-y-5 lg:space-y-6">
        {stage === 'identifier' && (
          <div className="space-y-2">
            <label className={labelCls}>Phone Number or Email</label>
            <input className={inputCls} value={identifier} onChange={e => setIdentifier(e.target.value)}
              placeholder="0712 345 678 or you@business.co.ke" type="text" autoComplete="username" autoCapitalize="none" autoFocus />
          </div>
        )}

        {stage === 'otp' && (
          <div className="space-y-2">
            <label className={labelCls}>6-digit code</label>
            <input className={`${inputCls} tracking-[0.5em] text-center`} value={otp} inputMode="numeric" maxLength={6}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoComplete="one-time-code" autoFocus />
            <button type="button" onClick={sendCode} disabled={loading}
              className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/40 hover:text-emerald-600 transition-colors pl-1">
              Resend code
            </button>
          </div>
        )}

        {stage === 'password' && (
          <>
            <div className="space-y-2">
              <label className={labelCls}>New password</label>
              <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" autoFocus />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Confirm new password</label>
              <input className={inputCls} type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" />
            </div>
          </>
        )}

        {err && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700">
            <span className="material-symbols-outlined text-lg">error_outline</span>
            <p className="text-xs font-bold">{err}</p>
          </div>
        )}

        <button className={buttonCls} disabled={loading}>
          {loading
            ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            : <>{stage === 'identifier' ? 'Send code' : stage === 'otp' ? 'Verify code' : 'Save password'}
                <span className="material-symbols-outlined">arrow_forward</span></>}
        </button>

        <button type="button" onClick={onCancel}
          className="w-full text-center text-[10px] uppercase font-black tracking-[0.2em] text-primary/40 hover:text-emerald-600 transition-colors">
          Back to sign in
        </button>
      </form>
    </div>
  )
}
