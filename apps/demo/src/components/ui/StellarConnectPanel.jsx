import React, { useState } from 'react'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

// Shown on the Wallet and Inflation Shield pages whenever there's no real
// backend session yet. Logs into one specific real, admin-onboarded "demo
// merchant" (see adminController.js's isDemoMerchant flag) so those two
// pages can show genuine Stellar testnet data instead of mock numbers —
// everything else in this app stays the polished mock walkthrough. Real
// login always requires OTP (no bypass, by design), so this is a real
// two-stage form, not a fake one.
export default function StellarConnectPanel({
  title = 'Connect the demo Stellar wallet',
  subtitle = 'This page shows a real, verifiable Stellar testnet wallet — sign in to the demo merchant account to load it.',
}) {
  const { realLogin, realVerifyOtp, realForgotPassword, realVerifyResetOtp, realResetPassword } = useMerchantAuth()
  // 'creds' -> 'otp' is the normal sign-in. 'forgot-*' is the reset flow,
  // reached via the "Forgot password?" link below — same 3-step shape as
  // merchant-dashboard's own Login.jsx (email -> OTP -> new password),
  // against the same real backend endpoints.
  const [stage, setStage] = useState('creds')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [channel, setChannel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [resetEmail, setResetEmail] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)

  async function handleCreds(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await realLogin(email.trim(), password)
    setLoading(false)
    if (!res.success) return setError(res.error)
    setChannel(res.channel || 'email')
    setStage('otp')
  }

  async function handleOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await realVerifyOtp(email.trim(), otp.trim())
    setLoading(false)
    if (!res.success) return setError(res.error)
  }

  function startForgotPassword() {
    setResetEmail(email.trim())
    setError('')
    setStage('forgot-email')
  }

  async function handleForgotEmail(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await realForgotPassword(resetEmail.trim())
    setLoading(false)
    if (!res.success) return setError(res.error)
    setMaskedEmail(res.maskedEmail || '')
    setStage('forgot-otp')
  }

  async function handleForgotOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await realVerifyResetOtp(resetEmail.trim(), resetOtp.trim())
    setLoading(false)
    if (!res.success) return setError(res.error)
    setResetToken(res.resetToken)
    setStage('forgot-new')
  }

  async function handleForgotNewPassword(e) {
    e.preventDefault()
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    setError('')
    const res = await realResetPassword(resetToken, newPassword)
    setLoading(false)
    if (!res.success) return setError(res.error)
    // Back to the normal sign-in form, pre-filled, so they can log in with
    // the password they just set — matches merchant-dashboard's own
    // "reset then sign in" pattern rather than auto-logging them in here.
    setEmail(resetEmail)
    setPassword('')
    setResetDone(true)
    setStage('creds')
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-[24px] border border-outline-variant/10 shadow-sm max-w-md mx-auto text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
      </div>
      <h3 className="font-headline text-lg text-primary mb-1">{title}</h3>
      <p className="text-[12px] text-on-surface-variant mb-6 leading-relaxed">
        {subtitle}
      </p>

      {resetDone && stage === 'creds' && (
        <p className="mb-3 text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">Password reset. Sign in below with your new password.</p>
      )}

      {stage === 'creds' && (
        <form onSubmit={handleCreds} className="space-y-3 text-left">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="demo merchant email"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-sm outline-none focus:border-primary"
          />
          <div className="text-right">
            <button type="button" onClick={startForgotPassword} className="text-[11px] font-bold text-primary/60 hover:text-primary">Forgot password?</button>
          </div>
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Connecting…' : 'Continue'}
          </button>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={handleOtp} className="space-y-3 text-left">
          <p className="text-[11px] text-on-surface-variant mb-1">
            Enter the 6-digit code sent via {channel === 'sms' ? 'SMS' : 'email'}.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-center text-lg tracking-[0.4em] font-bold outline-none focus:border-primary"
          />
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading || otp.length < 6}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify & Connect'}
          </button>
        </form>
      )}

      {stage === 'forgot-email' && (
        <form onSubmit={handleForgotEmail} className="space-y-3 text-left">
          <p className="text-[11px] text-on-surface-variant mb-1">Enter the demo merchant's email or phone — we'll send a 6-digit code.</p>
          <input
            type="text"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="email or phone"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
          <button type="button" onClick={() => { setError(''); setStage('creds') }} className="w-full text-[11px] font-bold text-on-surface-variant/60 hover:text-primary">Back to sign in</button>
        </form>
      )}

      {stage === 'forgot-otp' && (
        <form onSubmit={handleForgotOtp} className="space-y-3 text-left">
          <p className="text-[11px] text-on-surface-variant mb-1">
            Enter the 6-digit code sent to {maskedEmail || 'the account on file'}.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={resetOtp}
            onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-center text-lg tracking-[0.4em] font-bold outline-none focus:border-primary"
          />
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading || resetOtp.length < 6}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
          <button type="button" onClick={() => { setError(''); setStage('creds') }} className="w-full text-[11px] font-bold text-on-surface-variant/60 hover:text-primary">Back to sign in</button>
        </form>
      )}

      {stage === 'forgot-new' && (
        <form onSubmit={handleForgotNewPassword} className="space-y-3 text-left">
          <p className="text-[11px] text-on-surface-variant mb-1">Set a new password (min. 8 characters).</p>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="new password"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="confirm new password"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
      )}
    </div>
  )
}
