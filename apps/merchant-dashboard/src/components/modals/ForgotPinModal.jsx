import React, { useState } from 'react'
import axios from 'axios'
import OtpInput from '../OtpInput'
import PinBoxes from '../PinBoxes'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Same weak-PIN blocklist the mobile app's PinSetup/ForgotPin reject.
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '0123', '1234', '2345', '3456', '4567', '5678', '6789',
  '9876', '8765', '7654', '6543', '5432', '4321', '3210',
])

// "Forgot PIN" for a signed-in merchant — a 6-digit code to the phone and
// email on file, then a new PIN (backend: sendPinResetOtp/resetPinWithOtp in
// merchantAuthController.js). Mirrors apps/mobile-app's ForgotPin.tsx code
// path. Opened from Settings, Send Money and Bulk Pay's PIN prompts.
export default function ForgotPinModal({ onClose, onSuccess }) {
  const [stage, setStage] = useState('send') // send | reset | done
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('paychain_merchant_token')}` } })

  async function sendCode() {
    setBusy(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/forgot-pin/send-otp`, {}, cfg())
      setSentTo([res.data.maskedPhone, res.data.maskedEmail].filter(Boolean).join(' and '))
      setCode('')
      setStage('reset')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send a code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function resetPin() {
    if (code.length !== 6) return setError('Enter the 6-digit code we sent you.')
    if (newPin.length !== 4) return setError('Your new PIN must be 4 digits.')
    if (WEAK_PINS.has(newPin)) return setError('Repeated or sequential digits (like 1234 or 0000) are too easy to guess. Choose a different PIN.')
    if (newPin !== confirmPin) return setError('PINs do not match.')
    setBusy(true)
    setError('')
    try {
      await axios.post(`${API_URL}/api/auth/merchant/forgot-pin/reset`, { otp: code, pin: newPin }, cfg())
      setStage('done')
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your PIN. Please try again.')
      if (err.response?.data?.codeExpired) {
        setCode('')
        setStage('send')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#06201B]/70 backdrop-blur-sm" />
      <div className="relative bg-white rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.35)] w-full max-w-sm max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5 w-full bg-[#00351D]" />
        <div className="p-7">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-[#00351D]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {stage === 'done' ? 'check_circle' : 'key'}
            </span>
          </div>

          {stage === 'send' && (
            <div className="text-center">
              <h2 className="font-headline text-xl font-bold text-primary tracking-tight mb-2">Forgot your PIN?</h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-6">
                We'll send a 6-digit code to the phone number and email on your account. Then you can set a new PIN.
              </p>
              {error && <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}
              <button onClick={sendCode} disabled={busy} className="w-full py-3.5 rounded-2xl bg-[#00351D] text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 mb-3">
                {busy ? 'Sending…' : 'Send Me a Code'}
              </button>
              <button onClick={onClose} disabled={busy} className="w-full py-3 rounded-2xl text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                Cancel
              </button>
            </div>
          )}

          {stage === 'reset' && (
            <div>
              <h2 className="font-headline text-xl font-bold text-primary tracking-tight mb-2 text-center">Set a new PIN</h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-5 text-center">
                Enter the code sent to {sentTo || 'your phone and email'}. It expires in 10 minutes.
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">Verification Code</p>
                  <OtpInput value={code} onChange={setCode} autoFocus disabled={busy} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">New PIN</p>
                  <PinBoxes value={newPin} onChange={setNewPin} loading={busy} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">Confirm New PIN</p>
                  <PinBoxes value={confirmPin} onChange={setConfirmPin} loading={busy} />
                </div>
              </div>
              {error && <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">{error}</p>}
              <button
                onClick={resetPin}
                disabled={busy || code.length !== 6 || newPin.length !== 4 || confirmPin.length !== 4}
                className="w-full mt-5 py-3.5 rounded-2xl bg-[#00351D] text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Reset PIN'}
              </button>
              <button onClick={sendCode} disabled={busy} className="w-full mt-2 py-2.5 text-[#00351D] font-bold text-xs hover:underline disabled:opacity-50">
                Didn't get it? Send a new code
              </button>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center">
              <h2 className="font-headline text-xl font-bold text-primary tracking-tight mb-2">PIN reset</h2>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-6">
                Your new payment PIN is ready. Use it for every payment, on the web and the mobile app.
              </p>
              <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-[#00351D] text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
