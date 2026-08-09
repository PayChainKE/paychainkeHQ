import React, { useState } from 'react'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

// Shown on the Wallet and Inflation Shield pages whenever there's no real
// backend session yet. Logs into one specific real, admin-onboarded "demo
// merchant" (see adminController.js's isDemoMerchant flag) so those two
// pages can show genuine Stellar testnet data instead of mock numbers —
// everything else in this app stays the polished mock walkthrough. Real
// login always requires OTP (no bypass, by design), so this is a real
// two-stage form, not a fake one.
export default function StellarConnectPanel() {
  const { realLogin, realVerifyOtp } = useMerchantAuth()
  const [stage, setStage] = useState('creds')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [channel, setChannel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="bg-white p-6 md:p-8 rounded-[24px] border border-outline-variant/10 shadow-sm max-w-md mx-auto text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
      </div>
      <h3 className="font-headline text-lg text-primary mb-1">Connect the demo Stellar wallet</h3>
      <p className="text-[12px] text-on-surface-variant mb-6 leading-relaxed">
        This page shows a real, verifiable Stellar testnet wallet — sign in to the demo merchant account to load it.
      </p>

      {stage === 'creds' ? (
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
          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-[#0A2540] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Connecting…' : 'Continue'}
          </button>
        </form>
      ) : (
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
    </div>
  )
}
