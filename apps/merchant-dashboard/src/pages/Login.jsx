import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { useNotification } from '../context/NotificationContext'
import mainLogo from '../assets/signin-logo.png'
import footerBrandsLogo from '../assets/signin-footer-logo.png'
import poweredByLogo from '../assets/poweredby-logo.png'
import { ValidatedInput } from '../components/ValidatedInput'

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", 
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", 
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", 
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", 
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", 
  "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", 
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
]

export default function Login() {
  const { login, biometricLogin, signup, verifyOTP, resendOTP, forgotPassword, verifyResetOTP, resetPassword, isAuthenticated } = useMerchantAuth()
  const { addNotification } = useNotification()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      nav('/overview')
    }
  }, [isAuthenticated, nav])

  // Signup Flow States
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupBusinessName, setSignupBusinessName] = useState('')
  const [signupEcommerce, setSignupEcommerce] = useState('yes')
  const [signupCounty, setSignupCounty] = useState('')
  const [countySearch, setCountySearch] = useState('')

  // Reset Flow States
  const [isResetMode, setIsResetMode] = useState(false)
  const [newPassword, setNewPasswordInput] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [strength, setStrength] = useState({ length: false, upper: false, number: false, symbol: false })
  // Reset step 2 → 3 hands off a short-lived single-use server token. We only
  // ever hold the raw token in component state — never localStorage.
  const [resetToken, setResetToken] = useState('')
  const [maskedResetEmail, setMaskedResetEmail] = useState('')
  // Renders a final confirmation card after a successful reset, with a CTA
  // back to the login tab. Avoids the user being silently dumped to login.
  const [resetSuccess, setResetSuccess] = useState(false)

  // OTP Flow States
  const [isOTPMode, setIsOTPMode] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('login')
  const [isSignupPasswordStep, setIsSignupPasswordStep] = useState(false)
  const [isSignupBiometricStep, setIsSignupBiometricStep] = useState(false)
  const [otpFlowType, setOtpFlowType] = useState('') // 'login' or 'reset'
  const [authEmail, setAuthEmail] = useState('') // Captured from backend for OTP verification
  const [hasBiometrics, setHasBiometrics] = useState(!!localStorage.getItem('last_biometric_user'))
  const [resendTimer, setResendTimer] = useState(59)
  const [hasAccount, setHasAccount] = useState(() => localStorage.getItem('hasAccount') === 'true')
  
  // Real-time security validation
  useEffect(() => {
    setStrength({
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword)
    })
  }, [newPassword])

  // Countdown Timer Logic
  useEffect(() => {
    if (isOTPMode && resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isOTPMode, resendTimer])

  async function handleLogin(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setErr('')
    const res = await login(phone, password)
    setLoading(false)
    if (res.success) {
      setAuthEmail(res.email)
      if (res.mfaRequired) {
        setOtpFlowType('login')
        setIsOTPMode(true)
        setResendTimer(59)
      } else {
        nav('/overview')
      }
    } else {
      setErr(res.error)
    }
  }

  async function handleBiometricSignIn() {
    setErr('')
    try {
      if (!window.PublicKeyCredential) {
        setErr("Biometrics are not supported on this device.")
        return
      }

      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)

      // Physically triggers OS-level Face ID / Touch ID prompt
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required"
        }
      })

      if (assertion) {
        // OS verified the user physically. 
        // We log them in bypassing the password check on the backend for demo purposes.
        const userEmail = localStorage.getItem('last_biometric_user')
        if (!userEmail) {
          setErr("No registered biometric user found.")
          return
        }

        setLoading(true)
        const res = await biometricLogin(userEmail)
        setLoading(false)

        if (res.success) {
          nav('/overview')
        } else {
          setErr(res.error)
        }
      }
    } catch (error) {
      console.error(error)
      setErr("Biometric authentication cancelled or failed.")
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setErr('')
    if (!Object.values(strength).every(v => v)) {
      setErr('Please meet all security requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.')
      return
    }
    if (!resetToken) {
      setErr('Your reset session has expired. Start over.')
      setIsResetMode(false)
      setActiveTab('reset')
      return
    }

    setLoading(true)
    const res = await resetPassword(resetToken, newPassword)
    setLoading(false)

    if (res.success) {
      setResetSuccess(true)
      setResetToken('')
      setOtp(['', '', '', '', '', ''])
      setNewPasswordInput('')
      setConfirmPassword('')
      setPassword('')
      addNotification({
        title: 'Password Reset',
        message: 'A confirmation email has been sent to your inbox.',
        type: 'success',
      })
    } else {
      setErr(res.error)
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault()
    setErr('')
    const code = otp.join('')
    if (code.length < 6) return

    // Reset flow has its own verify endpoint that mints a short-lived
    // reset token. Sign-in / signup verification still uses verifyOTP.
    if (otpFlowType === 'reset') {
      setLoading(true)
      const res = await verifyResetOTP(authEmail, code)
      setLoading(false)
      if (res.success) {
        setResetToken(res.resetToken)
        setIsOTPMode(false)
        setIsResetMode(true)
      } else {
        setErr(res.error)
      }
      return
    }

    setLoading(true)
    const res = await verifyOTP(authEmail, code)
    setLoading(false)

    if (res.success) {
      setIsOTPMode(false)
      localStorage.setItem('hasAccount', 'true')
      setHasAccount(true)
      nav('/overview')
    } else {
      setErr(res.error)
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setErr('')
    const loginInput = e.target[0].value.trim()
    if (!loginInput) {
      setErr('Enter your email or registered phone number.')
      return
    }
    setLoading(true)
    const res = await forgotPassword(loginInput)
    setLoading(false)
    if (res.success) {
      setAuthEmail(loginInput)
      setMaskedResetEmail(res.maskedEmail || '')
      setOtpFlowType('reset')
      setIsOTPMode(true)
      setResendTimer(59)
      setActiveTab('login')
      addNotification({
        title: 'Verification Code Sent',
        message: res.maskedEmail
          ? `We sent a 6-digit code to ${res.maskedEmail}. It expires in 10 minutes.`
          : 'If an account exists, a 6-digit code is on its way.',
        type: 'success',
      })
    } else {
      setErr(res.error)
    }
  }

  // Bail-out used by the success card / "Start over" affordances to scrub
  // any in-progress reset state before we route the user somewhere else.
  function exitResetFlow(targetTab = 'login') {
    setIsResetMode(false)
    setIsOTPMode(false)
    setResetToken('')
    setMaskedResetEmail('')
    setResetSuccess(false)
    setOtp(['', '', '', '', '', ''])
    setNewPasswordInput('')
    setConfirmPassword('')
    setErr('')
    setActiveTab(targetTab)
  }

  async function handleResendOTP() {
    if (resendTimer > 0) return
    setLoading(true)
    const res = await resendOTP(authEmail)
    setLoading(false)
    if (res.success) {
      setResendTimer(59)
      addNotification({
        title: 'Code Sent',
        message: 'A new security code has been dispatched.',
        type: 'success'
      })
    } else {
      setErr(res.error)
    }
  }

  const handleOtpChange = (element, index) => {
    const val = element.value.replace(/\D/g, '')
    if (element.value !== '' && val === '') return // Reject if they typed a non-number
    
    const newOtp = [...otp]
    newOtp[index] = val
    setOtp(newOtp)
    if (element.nextSibling && val) {
      element.nextSibling.focus()
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setIsSignupPasswordStep(true)
  }

  async function handleSignupCreateAccount(e) {
    e.preventDefault()
    if (!Object.values(strength).every(v => v)) {
      setErr('Please meet all security requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.')
      return
    }

    const formData = new FormData()
    formData.append('name', signupName)
    formData.append('email', signupEmail)
    formData.append('phone', signupPhone)
    formData.append('businessName', signupBusinessName)
    formData.append('password', newPassword)
    formData.append('ecommerce', signupEcommerce)

    setLoading(true)
    const res = await signup(formData)
    setLoading(false)
    
    if (res.success) {
      setIsSignupPasswordStep(false)
      if (window.PublicKeyCredential) {
        setIsSignupBiometricStep(true)
      } else {
        finishSignup()
      }
    } else {
      setErr(res.error)
    }
  }

  function finishSignup() {
    setIsSignupBiometricStep(false)
    setActiveTab('login')
    setPassword('')
    addNotification({
      title: 'Account Created',
      message: 'Sign in with your new credentials to access your dashboard.',
      type: 'success',
    })
  }

  async function handleSetupBiometric() {
    try {
      setLoading(true)
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)
      const userId = new Uint8Array(16)
      window.crypto.getRandomValues(userId)

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "PayChain Merchant", id: window.location.hostname },
          user: {
            id: userId,
            name: signupEmail,
            displayName: signupName
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000
        }
      })

      if (credential) {
        localStorage.setItem('last_biometric_user', signupEmail)
        setHasBiometrics(true)
        addNotification({ title: 'Biometrics Enabled', message: 'You can now log in using Face ID or Touch ID.', type: 'success' })
      }
    } catch (e) {
      console.error(e)
      setErr('Biometric setup failed or was cancelled.')
    } finally {
      setLoading(false)
      finishSignup()
    }
  }

  function skipBiometric() {
    finishSignup()
  }

  const SecurityRequirement = ({ met, label }) => (
    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${met ? 'text-emerald-500' : 'text-primary/30'}`}>
      <span className="material-symbols-outlined text-[8px]">{met ? 'check_circle' : 'circle'}</span>
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
            Collect<span className="text-emerald-400">.</span><br/>
            Pay<span className="text-emerald-400">.</span><br/>
            Grow<span className="text-emerald-400">.</span>
          </h2>
          <div className="space-y-4 lg:space-y-6 text-blue-100/60 font-medium text-base lg:text-lg">
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">shield_locked</span>
              Verified M-PESA collections
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">key_visualizer</span>
              Working capital, no collateral
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">verified_user</span>
              Your data builds your credit
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 lg:mt-0">
        </div>
      </div>

      {/* Right Login/Reset/OTP Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-white lg:bg-transparent -mt-10 lg:mt-0 rounded-t-[40px] lg:rounded-none relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] lg:shadow-none transition-all">
        <div className="max-w-md w-full animate-fade-in-up">
          {/* Navigation Tabs */}
          <div className="flex bg-surface-container-low p-1.5 rounded-2xl mb-8 lg:mb-12 border border-outline-variant/10 shadow-inner">
            {['signup', 'login', 'reset'].filter(t => t !== 'signup' || !hasAccount).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab)
                  setIsOTPMode(false)
                  setIsResetMode(false)
                  setIsSignupPasswordStep(false)
                  setNewPasswordInput('')
                  setConfirmPassword('')
                  setErr('')
                }}
                className={`flex-1 py-3 px-2 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-primary/40 hover:text-primary/70 hover:bg-white/50'
                }`}
              >
                {tab === 'signup' ? 'Sign Up' : tab === 'login' ? 'Login' : 'Reset Password'}
              </button>
            ))}
          </div>

          {activeTab === 'signup' ? (
            /* SIGN UP FORM */
            <div className="animate-fade-in-up">
              {isSignupBiometricStep ? (
                /* BIOMETRIC SETUP STEP */
                <div className="flex flex-col items-center justify-center text-center py-10 px-4 animate-fade-in-up">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <span className="material-symbols-outlined text-4xl text-emerald-500">fingerprint</span>
                  </div>
                  <h3 className="font-headline text-3xl text-primary tracking-tight font-black mb-3">Enable Biometrics</h3>
                  <p className="text-on-surface-variant font-medium opacity-80 mb-8 max-w-sm leading-relaxed">
                    Set up Face ID or Touch ID for instant, secure access to your merchant dashboard without needing a password.
                  </p>
                  <div className="flex flex-col w-full gap-4 max-w-xs mx-auto">
                    <button 
                      onClick={handleSetupBiometric}
                      disabled={loading}
                      className="bg-[#06201B] text-white py-4 rounded-xl font-black text-sm shadow-xl hover:bg-[#0a3029] transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Set Up Now'}
                    </button>
                    <button 
                      onClick={skipBiometric}
                      disabled={loading}
                      className="text-primary/60 font-bold text-sm py-2 hover:text-primary transition-all"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              ) : isSignupPasswordStep ? (
                /* SIGN UP PASSWORD STEP */
                <div className="animate-fade-in-up">
                  <div className="mb-6 lg:mb-10 flex flex-col items-center text-center">
                     <img src={footerBrandsLogo} alt="PayChain Logo" className="h-10 mb-6 w-auto object-contain" />
                     <h3 className="font-headline text-2xl lg:text-5xl text-primary tracking-tight font-black">Set Custom Access</h3>
                     <p className="text-on-surface-variant font-medium mt-1.5 text-sm lg:text-base lg:mt-2 opacity-70 leading-relaxed max-w-sm">
                       To complete onboarding, please create a high-security password.
                     </p>
                  </div>
                  <form onSubmit={handleSignupCreateAccount} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">New Secure Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                          value={newPassword} 
                          onChange={e => setNewPasswordInput(e.target.value)} 
                          placeholder="••••••••••••"
                          autoComplete="new-password"
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

                      {/* Security Indicators Vertical List */}
                      <div className="flex flex-col gap-3 p-5 bg-[#F0FDF4]/40 rounded-3xl mt-5 border border-emerald-500/5 shadow-inner">
                        <SecurityRequirement met={strength.length} label="Minimum 8 Characters" />
                        <SecurityRequirement met={strength.upper} label="Uppercase letters (A, B, C)" />
                        <SecurityRequirement met={strength.number} label="Numerical digits (1, 2, 3)" />
                        <SecurityRequirement met={strength.symbol} label="Special Symbols (@, #, $)" />
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
                          autoComplete="new-password"
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

                    <div className="pt-4">
                      {err && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake mb-4">
                          <span className="material-symbols-outlined text-lg">error_outline</span>
                          <p className="text-xs font-bold">{err}</p>
                        </div>
                      )}
                      <button 
                        className="w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/10 disabled:opacity-30 disabled:grayscale" 
                        disabled={loading || !Object.values(strength).every(v=>v) || !confirmPassword || newPassword !== confirmPassword}
                      >
                        {loading ? (
                          <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>
                            Create Account
                            <span className="material-symbols-outlined">arrow_forward</span>
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
              ) : (
                <>
                  <div className="mb-6 lg:mb-8">
                     <h3 className="font-headline text-3xl lg:text-4xl text-primary tracking-tight font-black">Get started with us</h3>
                     <p className="text-on-surface-variant font-medium mt-2 opacity-70 text-sm">
                       Fill out the form below and we will connect you with the right person.
                     </p>
                  </div>
                  <form onSubmit={handleSignup} className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-outline-variant/20 scrollbar-track-transparent">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Your Name *</label>
                    <ValidatedInput kind="personName" required value={signupName} onChange={e => setSignupName(e.target.value)} placeholder="John Doe"
                      className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 px-4 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Your Email *</label>
                    <ValidatedInput kind="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="john@example.com"
                      className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 px-4 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Your Phone *</label>
                    <div className="flex group">
                      <div className="bg-surface-container-low border border-outline-variant/15 border-r-0 rounded-l-xl px-3 flex items-center justify-center text-primary/40 group-focus-within:border-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">smartphone</span>
                      </div>
                      <ValidatedInput kind="phoneKE" required value={signupPhone} onChange={e => setSignupPhone(e.target.value)} placeholder="0712 345 678"
                        className="flex-1 w-full bg-white border border-outline-variant/15 rounded-r-xl py-3 px-3 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Business Name *</label>
                    <ValidatedInput kind="businessName" required value={signupBusinessName} onChange={e => setSignupBusinessName(e.target.value)} placeholder="Acme Corp"
                      className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 px-4 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Business Type *</label>
                  <div className="relative">
                    <select required className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 pl-4 pr-10 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                      <option value="">—Please choose an option—</option>
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="services">Services</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="other">Other</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">County *</label>
                  <div className="bg-white border border-outline-variant/15 rounded-2xl p-2 lg:p-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                    <div className="relative mb-3">
                       <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none text-sm">search</span>
                       <input 
                         className="w-full bg-slate-50 rounded-xl py-2 pl-9 pr-4 text-xs font-headline text-primary outline-none placeholder:text-outline-variant/40"
                         placeholder="Search your county..."
                         value={countySearch}
                         onChange={e => setCountySearch(e.target.value)}
                       />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-outline-variant/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {KENYAN_COUNTIES.filter(c => c.toLowerCase().includes(countySearch.toLowerCase())).map(county => (
                        <button
                          key={county}
                          type="button"
                          onClick={() => setSignupCounty(county)}
                          className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-left truncate flex items-center justify-between group ${
                            signupCounty === county 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                            : 'bg-white border-outline-variant/10 text-primary hover:border-emerald-200 hover:bg-emerald-50/30'
                          }`}
                        >
                          <span className="truncate">{county}</span>
                          {signupCounty === county && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Area/Location *</label>
                  <input required className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 px-4 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" placeholder="Westlands" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Employees *</label>
                  <div className="relative">
                    <select required className="w-full bg-white border border-outline-variant/15 rounded-xl py-3 pl-4 pr-10 text-sm font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                      <option value="">—Please choose an option—</option>
                      <option value="1-5">1 - 5</option>
                      <option value="6-20">6 - 20</option>
                      <option value="21-50">21 - 50</option>
                      <option value="50+">50+</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 pl-1">Is this an eCommerce business?</label>
                  <div className="flex gap-6 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-primary hover:text-emerald-600 transition-colors">
                      <input type="radio" name="ecommerce" value="yes" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" required /> Yes
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-primary hover:text-emerald-600 transition-colors">
                      <input type="radio" name="ecommerce" value="no" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" required /> No
                    </label>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white pt-2 pb-1 z-10">
                  <button disabled={loading} className="w-full bg-[#06201B] text-white py-4 rounded-xl font-black text-sm shadow-xl hover:bg-[#0a3029] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group border border-white/5 disabled:opacity-50">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Submit Application <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-sm">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
              </>
            )}
            </div>
          ) : activeTab === 'reset' ? (
            /* RESET PASSWORD FORM */
            <div className="animate-fade-in-up">
              <div className="mb-8 lg:mb-10">
                 <h3 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight font-black">Reset Password</h3>
                 <p className="text-on-surface-variant font-medium mt-2 opacity-70">
                   Enter your registered phone number or email address to receive a recovery code.
                 </p>
              </div>
               <form onSubmit={handleForgotPassword} className="space-y-5 lg:space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Email or Phone Number</label>
                  <input className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40" placeholder="john@example.com or 0712..." type="text" autoComplete="username" required />
                </div>
                <div className="space-y-4">
                  {err && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                      <span className="material-symbols-outlined text-lg">error_outline</span>
                      <p className="text-xs font-bold">{err}</p>
                    </div>
                  )}
                  <button className="w-full bg-[#06201B] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group border border-white/5 disabled:opacity-50" disabled={loading}>
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Send Recovery Code <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : !isResetMode && !isOTPMode ? (
            /* LOGIN FORM */
            <>
              <div className="mb-8 lg:mb-10">
                 <h3 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight font-black">Sign in</h3>
                 <p className="text-on-surface-variant font-medium mt-2 opacity-70">
                   Enter credentials provided during onboarding.
                 </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 lg:space-y-6">
                
                {hasBiometrics && (
                  <div className="mb-6 animate-fade-in-up">
                    <button 
                      type="button"
                      onClick={handleBiometricSignIn}
                      className="w-full bg-emerald-50 text-emerald-700 py-4 lg:py-5 rounded-2xl font-black text-sm lg:text-base shadow-sm hover:bg-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-emerald-200"
                    >
                      <span className="material-symbols-outlined text-2xl">fingerprint</span>
                      Sign in with Passkey / Biometrics
                    </button>
                    
                    <div className="flex items-center gap-4 my-6 opacity-40">
                      <div className="flex-1 h-px bg-primary"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Or use password</span>
                      <div className="flex-1 h-px bg-primary"></div>
                    </div>
                  </div>
                )}

                {/* Unified Login Field (Email or Phone Number) */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Email or Phone Number</label>
                  <div className="flex group">
                    <div className="bg-surface-container-low border border-outline-variant/15 border-r-0 rounded-l-2xl px-4 lg:px-5 flex items-center justify-center text-primary/40 group-focus-within:border-primary transition-colors">
                      <span className="material-symbols-outlined text-xl">person</span>
                    </div>
                    <input 
                      className="flex-1 w-full bg-white border border-outline-variant/15 rounded-r-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40"
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="john@example.com or 0712..."
                      type="text"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Password</label>
                    <button type="button" onClick={() => setActiveTab('reset')} className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">Forgot?</button>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3 lg:py-4 px-4 lg:px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                      Sign In
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </>
                  )}
                </button>
                
                <div className="flex items-center justify-center gap-2 opacity-50 pt-4">
                  <p className="text-[9px] text-primary/60 uppercase font-black tracking-[0.2em]">
                    Powered by
                  </p>
                  <img src={poweredByLogo} alt="PayChain Logo" className="h-4 w-auto object-contain" />
                </div>
              </form>
            </>
          ) : isOTPMode ? (
            /* OTP VERIFICATION VIEW */
            <div className="animate-fade-in-up duration-500">
              <div className="mb-6 lg:mb-10 text-center flex flex-col items-center">
                 <img src={footerBrandsLogo} alt="PayChain Logo" className="h-10 mb-6 w-auto object-contain" />
                 <h3 className="font-headline text-2xl lg:text-5xl text-primary tracking-tight font-black">
                   {otpFlowType === 'reset' ? 'Verify it’s you' : 'Security Code'}
                 </h3>
                 <p className="text-on-surface-variant font-medium mt-1.5 text-sm lg:text-base lg:mt-2 opacity-70 leading-relaxed max-w-sm">
                   {otpFlowType === 'reset' ? (
                     <>
                       Enter the 6-digit code we sent to {' '}
                       <span className="text-primary font-black">{maskedResetEmail || 'your inbox'}</span>.
                       The code expires in 10 minutes.
                     </>
                   ) : (
                     <>
                       Enter the 6-digit code sent to your phone ending in {' '}
                       <span className="text-primary font-black">...{phone.slice(-3)}</span>
                     </>
                   )}
                 </p>
                 {otpFlowType === 'reset' && (
                   <button
                     type="button"
                     onClick={() => exitResetFlow('reset')}
                     className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 hover:text-emerald-700"
                   >
                     ← Use a different email
                   </button>
                 )}
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6 lg:space-y-8">
                <div className="flex justify-between gap-1.5 sm:gap-3">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
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
                        Verify Account
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleResendOTP}
                    disabled={resendTimer > 0 || loading}
                    className="w-full text-center text-[10px] uppercase font-black tracking-[0.2em] text-primary/40 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:hover:text-primary/40 disabled:cursor-not-allowed"
                  >
                    {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
                  </button>
                </div>
              </form>
            </div>
          ) : resetSuccess ? (
            /* RESET SUCCESS — final confirmation card */
            <div className="animate-fade-in-up duration-500">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 border-4 border-emerald-200/40">
                  <span className="material-symbols-outlined text-emerald-600 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <h3 className="font-headline text-3xl lg:text-5xl text-primary tracking-tight font-black">Password reset</h3>
                <p className="text-on-surface-variant font-medium mt-3 text-sm lg:text-base opacity-70 leading-relaxed max-w-sm">
                  Your new password is active. A security receipt has been emailed to {' '}
                  <span className="text-primary font-black">{maskedResetEmail || 'your inbox'}</span> with the time, IP and device of this change.
                </p>
                <div className="mt-7 w-full max-w-xs space-y-3">
                  <button
                    onClick={() => exitResetFlow('login')}
                    className="w-full bg-[#06201B] text-white py-4 rounded-2xl font-black text-base shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5"
                  >
                    Continue to sign in
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant/40">
                    For your security we never email the actual password.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* SET NEW PASSWORD FORM (covers post-OTP reset AND signup setup) */
            <div className="animate-fade-in-up duration-500">
              <div className="mb-6 lg:mb-10 flex flex-col items-center text-center">
                 <img src={footerBrandsLogo} alt="PayChain Logo" className="h-10 mb-6 w-auto object-contain" />
                 <h3 className="font-headline text-2xl lg:text-5xl text-primary tracking-tight font-black">
                   {otpFlowType === 'reset' ? 'Choose a new password' : 'Set Custom Access'}
                 </h3>
                 <p className="text-on-surface-variant font-medium mt-1.5 text-sm lg:text-base lg:mt-2 opacity-70 leading-relaxed max-w-sm">
                   {otpFlowType === 'reset'
                     ? 'Pick something only you know. Your old password will stop working as soon as you save.'
                     : 'To complete onboarding, please create a high-security password.'}
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
                      autoComplete="new-password"
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
                  {/* Security Indicators Vertical List */}
                  <div className="flex flex-col gap-3 p-5 bg-[#F0FDF4]/40 rounded-3xl mt-5 border border-emerald-500/5 shadow-inner">
                    <SecurityRequirement met={strength.length} label="Minimum 8 Characters" />
                    <SecurityRequirement met={strength.upper} label="Uppercase letters (A, B, C)" />
                    <SecurityRequirement met={strength.number} label="Numerical digits (1, 2, 3)" />
                    <SecurityRequirement met={strength.symbol} label="Special Symbols (@, #, $)" />
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
                      autoComplete="new-password"
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
                        Set password
                        <span className="material-symbols-outlined">arrow_forward</span>
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

        </div>
      </div>
    </div>
  )
}
