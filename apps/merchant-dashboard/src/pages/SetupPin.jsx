import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PinBoxes from '../components/PinBoxes'
import { useMerchantAuth } from '../context/MerchantAuthContext'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Landed on immediately after a merchant's first login (see App.jsx's
// Protected wrapper, which redirects here whenever merchant.hasAppPin is
// false, from any route) — this used to only happen lazily, the first
// time a merchant tried to send money (SendMoney.jsx's own embedded step
// 3, still there as a harmless fallback for anyone who somehow reaches it
// with no PIN set). Same backend endpoint, same 4-digit PIN used
// everywhere else in the app (mobile included).
export default function SetupPin() {
  const { merchant, refreshSession } = useMerchantAuth()
  const navigate = useNavigate()
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const token = () => localStorage.getItem('paychain_merchant_token')
  const cfg = () => ({ headers: { Authorization: `Bearer ${token()}` } })

  const handleContinue = () => navigate('/overview', { replace: true })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPin.length < 4) { setError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin) { setError('PINs do not match. Please re-enter.'); return }

    setIsLoading(true)
    try {
      await axios.post(`${API_URL}/api/auth/merchant/set-app-pin`, { pin: newPin }, cfg())
      await refreshSession()
      navigate('/overview', { replace: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save PIN. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#00351D] flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="material-symbols-outlined text-emerald-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
          </div>
          <h3 className="font-headline text-2xl font-bold text-primary mb-2">Set Payment PIN</h3>
          <p className="text-sm text-on-surface-variant opacity-60 leading-relaxed max-w-xs mx-auto">
            Create a 4-digit PIN to authorise all money movements. This PIN is shared with the PayChain mobile app — if you already set one there, it works here too.
          </p>
        </div>

        {/* Reachable directly by URL even once a PIN already exists (the
            route guard only forces a merchant here, it doesn't lock the
            page down afterward) — mirror SendMoney.jsx's own defensive
            handling of this rather than showing a confusing form. */}
        {merchant?.hasAppPin ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-sm text-emerald-800 font-medium">Your payment PIN is already set.</p>
            </div>
            <button
              onClick={handleContinue}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-[#00351D] text-white shadow-xl shadow-emerald-900/20 hover:opacity-90 transition-all"
            >
              Continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">New PIN</p>
              <PinBoxes value={newPin} onChange={setNewPin} autoFocus loading={isLoading} />
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Confirm PIN</p>
              <PinBoxes value={confirmPin} onChange={setConfirmPin} loading={isLoading} />
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-shake">
                <span className="material-symbols-outlined text-red-500 text-base shrink-0">error_outline</span>
                <p className="text-xs font-bold text-red-700">{error}</p>
              </div>
            )}
            <p className="text-center text-[10px] text-slate-400 font-medium">
              This is a one-time setup. Keep your PIN confidential.
            </p>
            <button
              type="submit"
              disabled={newPin.length !== 4 || confirmPin.length !== 4 || isLoading}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-[#00351D] text-white shadow-xl shadow-emerald-900/20 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving…' : 'Save PIN & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
