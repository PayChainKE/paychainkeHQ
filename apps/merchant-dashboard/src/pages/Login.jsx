import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import mainLogo from '../assets/signin-logo.png'

export default function Login() {
  const { login, setNewPassword } = useMerchantAuth()
  const [phone, setPhone] = useState('0712345678')
  const [password, setPassword] = useState('Paychain2026')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  // Reset Flow States
  const [isResetMode, setIsResetMode] = useState(false)
  const [newPassword, setNewPasswordInput] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [strength, setStrength] = useState({ length: false, upper: false, number: false, symbol: false })

  // OTP Flow States
  const [isOTPMode, setIsOTPMode] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  
  // Real-time security validation
  useEffect(() => {
    setStrength({
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword)
    })
  }, [newPassword])

  async function handleLogin(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setErr('')
    const res = await login(phone, password)
    setLoading(false)
    if (res.success) {
      if (res.firstLogin) {
        setIsResetMode(true)
      } else {
        nav('/overview')
      }
    } else {
      setErr(res.error)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!Object.values(strength).every(v => v)) {
      setErr('Please meet all security requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.')
      return
    }

    setLoading(true)
    // Simulate setting password, then move to OTP
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    setIsOTPMode(true)
    setErr('')
  }

  async function handleVerifyOTP(e) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) return
    
    setLoading(true)
    const res = await setNewPassword(newPassword)
    setLoading(false)
    if (res.success) {
      nav('/overview')
    }
  }

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false
    const newOtp = [...otp]
    newOtp[index] = element.value
    setOtp(newOtp)
    if (element.nextSibling && element.value) {
      element.nextSibling.focus()
    }
  }

  const SecurityRequirement = ({ met, label }) => (
    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${met ? 'text-emerald-500' : 'text-primary/30'}`}>
      <span className="material-symbols-outlined text-sm">{met ? 'check_circle' : 'circle'}</span>
      {label}
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#FDFDFC]">
      {/* Left Branding Side */}
      <div className="w-full lg:w-1/2 bg-[#06201B] p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[400px] lg:min-h-screen">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-emerald-500 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-emerald-600 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="relative z-10">
          <img src={mainLogo} alt="PayChain Logo" className="h-10 w-auto object-contain" />
        </div>

        <div className="relative z-10 max-w-lg mt-12 lg:mt-0">
          <h2 className="font-headline text-5xl lg:text-7xl text-white tracking-tighter leading-[0.9] mb-6 lg:mb-8 transition-all">
            {isOTPMode ? (
              <>Verify<br/>OTP<br/>Code<span className="text-emerald-400">.</span></>
            ) : isResetMode ? (
              <>Secure<br/>Your<br/>Access<span className="text-amber-400">.</span></>
            ) : (
              <>Collect<span className="text-emerald-400">.</span><br/>Pay<span className="text-emerald-400">.</span><br/>Grow<span className="text-emerald-400">.</span></>
            )}
          </h2>
          <div className="space-y-4 lg:space-y-6 text-blue-100/60 font-medium text-base lg:text-lg">
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">shield_locked</span>
              {isOTPMode ? 'Two-factor authentication' : isResetMode ? 'Encrypted credential storage' : 'Verified M-PESA collections'}
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">key_visualizer</span>
              {isOTPMode ? 'One-time secure token' : isResetMode ? 'Advanced hashing protection' : 'Working capital, no collateral'}
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">verified_user</span>
              {isOTPMode ? 'Instant verification' : isResetMode ? 'Global security standards' : 'Your data builds your credit'}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 lg:mt-0">
          <div className="flex items-center gap-2.5 opacity-40">
            <p className="text-[10px] text-white uppercase font-black tracking-[0.2em]">
              Powered by
            </p>
            <img src={mainLogo} alt="PayChain Logo" className="h-4 w-auto object-contain" />
          </div>
        </div>
      </div>

      {/* Right Login/Reset/OTP Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-white lg:bg-transparent -mt-10 lg:mt-0 rounded-t-[40px] lg:rounded-none relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] lg:shadow-none transition-all">
        <div className="max-w-md w-full animate-fade-in-up">
          {!isResetMode ? (
            /* LOGIN FORM */
            <>
              <div className="mb-8 lg:mb-10">
                 <h3 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight">Sign in</h3>
                 <p className="text-on-surface-variant font-medium mt-2 opacity-70">
                   Enter credentials provided during onboarding.
                 </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 lg:space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">M-PESA Phone Number</label>
                  <div className="flex group">
                    <div className="bg-surface-container-low border border-outline-variant/15 border-r-0 rounded-l-2xl px-4 lg:px-5 flex items-center justify-center text-sm font-black text-primary/40 group-focus-within:border-primary transition-colors">
                      +254
                    </div>
                    <input 
                      className="flex-1 bg-white border border-outline-variant/15 rounded-r-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40"
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
                    <a href="mailto:hello@paychainke.co" className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">Forgot?</a>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                    <span className="material-symbols-outlined text-lg">error_outline</span>
                    <p className="text-xs font-bold">{err}</p>
                  </div>
                )}

                <button 
                  className="w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group border border-white/5" 
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
            </>
          ) : isOTPMode ? (
            /* OTP VERIFICATION VIEW */
            <div className="animate-fade-in-up duration-500">
              <div className="mb-6 lg:mb-10">
                 <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-3 lg:mb-4">
                   <span className="material-symbols-outlined text-xs text-emerald-600" style={{fontVariationSettings: "'FILL' 1"}}>mail</span>
                   <span className="text-[9px] uppercase font-black tracking-widest text-emerald-600">Verification Required</span>
                 </div>
                 <h3 className="font-headline text-2xl lg:text-5xl text-primary tracking-tight">Security Code</h3>
                 <p className="text-on-surface-variant font-medium mt-1.5 text-sm lg:text-base lg:mt-2 opacity-70 leading-relaxed">
                   Enter the 6-digit code sent to your phone ending in <span className="text-primary font-black">...{phone.slice(-3)}</span>
                 </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6 lg:space-y-8">
                <div className="flex justify-between gap-1.5 sm:gap-3">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      className="w-full aspect-square bg-slate-50 border-2 border-outline-variant/10 rounded-xl lg:rounded-2xl text-center text-xl lg:text-2xl font-black text-primary focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                      value={data}
                      onChange={e => handleOtpChange(e.target, index)}
                      onFocus={e => e.target.select()}
                    />
                  ))}
                </div>

                {err && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700">
                    <span className="material-symbols-outlined text-lg">error_outline</span>
                    <p className="text-xs font-bold">{err}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <button 
                    className="w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/10 disabled:opacity-30" 
                    disabled={loading || otp.some(v => !v)}
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Verify & Activate Account
                        <span className="material-symbols-outlined">verified_user</span>
                      </>
                    )}
                  </button>
                  <button type="button" className="w-full text-center text-[10px] uppercase font-black tracking-[0.2em] text-primary/40 hover:text-emerald-600 transition-colors">
                    Resend Code (59s)
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* RESET PASSWORD FORM */
            <div className="animate-fade-in-up duration-500">
              <div className="mb-6 lg:mb-10">
                 <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-3 lg:mb-4">
                   <span className="material-symbols-outlined text-xs text-emerald-600" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
                   <span className="text-[9px] uppercase font-black tracking-widest text-emerald-600">Identity Verified</span>
                 </div>
                 <h3 className="font-headline text-2xl lg:text-5xl text-primary tracking-tight">Set Custom Access</h3>
                 <p className="text-on-surface-variant font-medium mt-1.5 text-sm lg:text-base lg:mt-2 opacity-70 leading-relaxed">
                   To complete onboarding, please create a high-security password.
                 </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">New Secure Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                      value={newPassword} 
                      onChange={e => setNewPasswordInput(e.target.value)} 
                      placeholder="••••••••••••"
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 p-1"
                    >
                      <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                  
                  {/* Strength Meter Bar */}
                  <div className="flex gap-1 h-1.5 px-1">
                    {[1, 2, 3, 4].map((step) => {
                      const score = Object.values(strength).filter(Boolean).length
                      const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500']
                      return (
                        <div 
                          key={step} 
                          className={`flex-1 rounded-full transition-all duration-500 ${step <= score ? colors[score - 1] : 'bg-slate-100'}`}
                        />
                      )
                    })}
                  </div>

                  {/* Security Indicators Grid */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 p-4 sm:p-5 bg-[#F0FDF4]/30 rounded-2xl mt-4 border border-emerald-500/5">
                    <SecurityRequirement met={strength.length} label="Minimum 8 Characters" />
                    <SecurityRequirement met={strength.upper} label="Uppercase letters" />
                    <SecurityRequirement met={strength.number} label="Numerical digits" />
                    <SecurityRequirement met={strength.symbol} label="Special Symbols" />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Verify Custom Password</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="Verify password"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 p-1"
                    >
                      <span className="material-symbols-outlined text-xl">{showConfirmPassword ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                    <span className="material-symbols-outlined text-lg">error_outline</span>
                    <p className="text-xs font-bold">{err}</p>
                  </div>
                )}

                <div className="pt-4">
                  <button 
                    className="w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/10 disabled:opacity-30 disabled:grayscale" 
                    disabled={loading || !Object.values(strength).every(v=>v) || !confirmPassword || newPassword !== confirmPassword}
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Verify password
                        <span className="material-symbols-outlined">verified</span>
                      </>
                    )}
                  </button>
                  <p className="text-[8px] lg:text-[9px] text-center text-on-surface-variant font-bold uppercase tracking-widest mt-6 opacity-40">
                    <span className="material-symbols-outlined text-[10px] align-middle mr-1">lock</span>
                    Session is secured with AES-256 encryption
                  </p>
                </div>
              </form>
            </div>
          )}

          <div className="mt-8 lg:mt-12 bg-emerald-50 p-6 rounded-[24px] border border-emerald-100 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-200/50 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700"></div>
            <p className="text-xs font-bold text-emerald-800 leading-relaxed relative z-10">
              <span className="material-symbols-outlined text-lg align-middle mr-2 text-emerald-600">info</span>
              New to PayChain? Access is exclusively provided by your onboarding officer after physical verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
