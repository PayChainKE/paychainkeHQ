import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMerchantAuth } from '../context/MerchantAuthContext'

export default function Login() {
  const { login } = useMerchantAuth()
  const [phone, setPhone] = useState('0712345678')
  const [password, setPassword] = useState('Paychain2026')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    const res = await login(phone, password)
    setLoading(false)
    if (res.success) {
      if (res.firstLogin) nav('/set-password')
      else nav('/overview')
    } else {
      setErr(res.error)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFC]">
      {/* Left Branding Side - Hidden on small screens */}
      <div className="hidden lg:flex w-1/2 bg-[#0A2540] p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-emerald-500 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-blue-500 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white font-bold">payments</span>
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white">PayChain<span className="text-emerald-400">.</span></h1>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Merchant Portal</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="font-headline text-7xl text-white tracking-tighter leading-[0.9] mb-8">
            Collect<span className="text-emerald-400">.</span><br/>
            Pay<span className="text-emerald-400">.</span><br/>
            Grow<span className="text-emerald-400">.</span>
          </h2>
          <div className="space-y-6 text-blue-100/60 font-medium text-lg">
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
              Verified M-PESA collections
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
              Working capital, no collateral
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
              Your data builds your credit
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em]">
            Merchant access is by invitation only.
          </p>
        </div>
      </div>

      {/* Right Login Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="max-w-md w-full animate-fade-in-up">
          <div className="lg:hidden mb-12 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">payments</span>
            </div>
            <p className="font-black text-primary tracking-tighter text-lg underline decoration-emerald-500 decoration-4 underline-offset-4">PayChain</p>
          </div>

          <h3 className="font-headline text-4xl lg:text-5xl text-primary tracking-tight mb-3">Sign in</h3>
          <p className="text-on-surface-variant font-medium mb-10 opacity-70">
            Enter your credentials provided during onboarding.
          </p>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">M-PESA Phone Number</label>
              <div className="flex group">
                <div className="bg-surface-container-low border border-outline-variant/15 border-r-0 rounded-l-2xl px-5 flex items-center justify-center text-sm font-black text-primary/40 group-focus-within:border-primary transition-colors">
                  +254
                </div>
                <input 
                  className="flex-1 bg-white border border-outline-variant/15 rounded-r-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="712 345 678"
                  type="tel"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Password</label>
                <a href="mailto:hello@paychainke.co" className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">Forgot Access?</a>
              </div>
              <input 
                type="password" 
                className="w-full bg-white border border-outline-variant/15 rounded-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            {err && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                <span className="material-symbols-outlined text-lg">error_outline</span>
                <p className="text-xs font-bold">{err}</p>
              </div>
            )}

            <button 
              className="w-full bg-[#0A2540] text-white py-5 rounded-2xl font-black text-lg shadow-2xl hover:bg-[#00351D] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group border border-white/5" 
              disabled={loading}
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Sign In to Dashboard
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-12 bg-emerald-50 p-6 rounded-[24px] border border-emerald-100 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-200/50 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700"></div>
            <p className="text-xs font-bold text-emerald-800 leading-relaxed relative z-10">
              <span className="material-symbols-outlined text-lg align-middle mr-2">info</span>
              New to PayChain? Access is exclusively provided by your onboarding officer after physical verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
