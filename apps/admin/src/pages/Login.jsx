import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

// Human-readable banner shown when the API forced us back to /login.
const REASON_COPY = {
  'session-expired':  { tone: 'amber', text: 'Your session expired. Please sign in again.' },
  'account-missing':  { tone: 'red',   text: 'Your admin account is no longer active. Sign in with a current account.' },
  'session-invalid':  { tone: 'amber', text: 'Your session is no longer valid. Please sign in again.' },
};

// Mask an email for display so observers can't read it off the OTP screen.
// "admin@paychain.co.ke" → "a•••n@p••••••.co.ke"
function maskEmail(raw) {
  if (!raw || typeof raw !== 'string' || !raw.includes('@')) return '';
  const [local, domain] = raw.split('@');
  const maskLocal = local.length <= 2
    ? local[0] + '•'
    : local[0] + '•'.repeat(Math.max(1, local.length - 2)) + local[local.length - 1];
  const dotIdx = domain.lastIndexOf('.');
  const domainBase = dotIdx === -1 ? domain : domain.slice(0, dotIdx);
  const tld = dotIdx === -1 ? '' : domain.slice(dotIdx);
  const maskDomain = domainBase.length <= 2
    ? domainBase[0] + '•' + tld
    : domainBase[0] + '•'.repeat(Math.max(1, domainBase.length - 1)) + tld;
  return `${maskLocal}@${maskDomain}`;
}

const Login = () => {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Password, 2: OTP

  // Surface the reason the API interceptor sent us here (token expired, etc.)
  const reasonBanner = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const key = params.get('reason') || sessionStorage.getItem('paychain_login_reason');
    if (!key || !REASON_COPY[key]) return null;
    sessionStorage.removeItem('paychain_login_reason');
    return REASON_COPY[key];
  }, [location.search]);

  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await login(email, password);
    if (res.mfaRequired) {
      // Wipe the password from React state as soon as it's no longer needed.
      // The PII still lives in the network call but at least it's out of the
      // component tree before the OTP screen renders.
      setPassword('');
      setStep(2);
    } else if (!res.success) {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const res = await verifyOtp(email, otpCode);
    if (res.success) {
      navigate('/overview');
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#FDFDFC] font-body text-on-surface antialiased">
      {/* Left Branding Side */}
      <div className="w-full md:w-[45%] bg-[#162723] p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[400px] md:min-h-screen shadow-editorial">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-emerald-500 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-emerald-600 rounded-full blur-[120px]"></div>
          {/* Grain Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBkbIVBpVFriiy_rd7YYL4kemDwzYGeTUDO0RQnen84NwsFUQVpuM2241cltNtsgO6TfE7rdw0c7R3x90e9VgVgm_AAmnut033a9zakEyE7J3_ZFmLoVRXqQMYlSF0lR0pLnbjZiisBdueyyOfeh1kz1Vb2Lizj-LZqqEjg11O0KtLBPhTCb9MnC-aDrG3ycp5JAHD6Mgy970j1blU8BlPFWG0KRSlRTSejTWfy_JMYqSmMiV8iBKjlUF3i5rUa-byqmsDRFcgG76U')" }}></div>
        </div>
        
        <div className="relative z-10 flex flex-col gap-2 items-start">
          <img src={logo} alt="PayChain Logo" className="h-10 w-auto object-contain" />
          <span className="text-secondary-fixed-dim text-[11px] font-bold tracking-[0.2em] uppercase font-label opacity-80">Admin Portal</span>
        </div>

        <div className="relative z-10 max-w-lg mt-12 md:mt-0">
          <h2 className="font-headline text-5xl lg:text-7xl text-white tracking-tighter leading-[0.9] mb-8 lg:mb-12 transition-all">
            Access<span className="text-emerald-400">.</span><br/>
            Monitor<span className="text-emerald-400">.</span><br/>
            Approve<span className="text-emerald-400">.</span>
          </h2>
          <div className="space-y-6 text-emerald-100/60 font-medium text-base lg:text-lg">
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">shield_locked</span>
              Waitlist management & approvals
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">monitoring</span>
              Live merchant oversight
            </p>
            <p className="flex items-center gap-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">analytics</span>
              Strategic growth tracking
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 md:mt-0">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">
            Professional Enterprise Grade
          </p>
        </div>
      </div>

      {/* Right Login Side */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-6 lg:p-16 bg-white md:bg-transparent -mt-10 md:mt-0 rounded-t-[40px] md:rounded-none relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] md:shadow-none transition-all">
        <div className="max-w-[400px] w-full space-y-10">
          {/* Header */}
          <div className="text-left">
            <h3 className="font-headline text-4xl lg:text-6xl text-primary tracking-tight font-black">
              {step === 1 ? 'Sign in' : 'Verify Identity'}
            </h3>
            <p className="text-on-surface-variant font-medium mt-2 opacity-70">
              {step === 1
                ? 'Authorized access for PayChain administrators.'
                : `We've sent a 6-digit code to ${maskEmail(email)}`}
            </p>
          </div>

          <form
            onSubmit={step === 1 ? handleLogin : handleVerifyOtp}
            className="space-y-6"
            autoComplete="off"
            spellCheck={false}
          >
            {reasonBanner && !error && (
              <div className={`${reasonBanner.tone === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'} border p-3 rounded-xl flex items-center gap-3`}>
                <span className="material-symbols-outlined text-lg">info</span>
                <p className="text-xs font-semibold">{reasonBanner.text}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 animate-shake">
                <span className="material-symbols-outlined text-lg">error_outline</span>
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}

            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    name="admin_login_id"
                    className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3.5 lg:py-4 px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1" htmlFor="password">Password</label>
                    <button type="button" className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">Forgot?</button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="admin_login_secret"
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-white border border-outline-variant/15 rounded-2xl py-3.5 lg:py-4 px-5 text-lg font-headline text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/40 pr-14"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
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
              </>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1" htmlFor="otp">Verification Code</label>
                  <input
                    id="otp"
                    name="admin_otp_code"
                    className="w-full bg-white border border-outline-variant/15 rounded-2xl py-4 px-5 text-3xl font-headline text-primary text-center tracking-[0.5em] focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/20"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back to credentials
                </button>
              </div>
            )}

            <button
              className="w-full bg-[#162723] text-white py-4 lg:py-5 rounded-2xl font-black text-lg shadow-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {step === 1 ? 'Enter Dashboard' : 'Verify & Unlock'}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
            
            <div className="flex items-center justify-center gap-2 opacity-50 pt-8">
              <p className="text-[9px] text-primary/60 uppercase font-black tracking-[0.2em]">
                {step === 1 ? 'Secure Administrator Portal' : 'Two-Factor Authentication Active'}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
