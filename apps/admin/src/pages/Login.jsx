import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(email, password);
    if (!res.success) {
      setError(res.error);
    } else {
      navigate('/overview');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row font-body bg-surface text-on-surface antialiased">
      {/* LEFT PANEL (45% on desktop) */}
      <section className="hidden md:flex md:w-[45%] bg-primary flex-col justify-between p-12 lg:p-16 relative overflow-hidden shadow-editorial">
        {/* Decorative Grain/Texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBkbIVBpVFriiy_rd7YYL4kemDwzYGeTUDO0RQnen84NwsFUQVpuM2241cltNtsgO6TfE7rdw0c7R3x90e9VgVgm_AAmnut033a9zakEyE7J3_ZFmLoVRXqQMYlSF0lR0pLnbjZiisBdueyyOfeh1kz1Vb2Lizj-LZqqEjg11O0KtLBPhTCb9MnC-aDrG3ycp5JAHD6Mgy970j1blU8BlPFWG0KRSlRTSejTWfy_JMYqSmMiV8iBKjlUF3i5rUa-byqmsDRFcgG76U')" }}></div>
        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex flex-col gap-2 items-start">
            <img src={logo} alt="PayChain Logo" className="h-10 max-w-full w-auto object-contain" />
            <span className="text-secondary-fixed-dim text-[11px] font-bold tracking-[0.2em] uppercase font-label opacity-80">Admin Portal</span>
          </div>
        </div>
        {/* Center Content: Feature Lines */}
        <div className="relative z-10 space-y-8 max-w-sm">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-secondary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="feature-line text-[14px] leading-relaxed text-white font-bold">Waitlist management and approvals</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-secondary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="feature-line text-[14px] leading-relaxed text-white font-bold">Live merchant monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-secondary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="feature-line text-[14px] leading-relaxed text-white font-bold">Analytics and growth tracking</p>
          </div>
        </div>
        {/* Bottom Metadata */}
        <div className="relative z-10">
          <p className="legal-text text-[10px] font-semibold tracking-[0.05em] uppercase font-label">
            Admin Portal · Authorized Access Only
          </p>
        </div>
      </section>
      {/* RIGHT PANEL (55% on desktop) */}
      <section className="flex-1 bg-surface-container-lowest flex flex-col justify-center items-center px-6 py-12">
        {/* Content Container */}
        <div className="w-full max-w-[360px] flex flex-col">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="md:hidden flex flex-col items-start mb-12 gap-2 text-left">
            <img src={logo} alt="PayChain Logo" className="h-10 max-w-full w-auto object-contain brightness-0 invert-0" style={{ filter: 'brightness(0) saturate(100%) invert(29%) sepia(94%) traits(80%) hue-rotate(120deg)' }} /> 
            <span className="text-secondary text-[11px] font-bold tracking-[0.2em] uppercase font-label">Admin Portal</span>
          </div>
          {/* Welcome Text */}
          <header className="text-left">
            <h1 className="text-on-surface text-[22px] font-bold font-headline tracking-tighter">Welcome back</h1>
            <p className="text-on-surface-variant text-[14px] mt-1.5 leading-relaxed">Sign in to the PayChain admin portal.</p>
          </header>
          {/* Form */}
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-error-container text-on-error-container rounded-lg text-sm font-medium border border-error/10 animate-shake">
                {error}
              </div>
            )}
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] font-label" htmlFor="email">Email address</label>
              <div className="relative">
                <input
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-black/[0.07] rounded-lg text-[14px] focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all placeholder:text-outline-variant"
                  id="email"
                  placeholder="admin@paychain.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] font-label" htmlFor="password">Password</label>
                <button className="text-[11px] font-bold text-secondary uppercase tracking-[0.05em] font-label hover:underline" type="button">Forgot?</button>
              </div>
              <div className="relative">
                <input
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-black/[0.07] rounded-lg text-[14px] focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all placeholder:text-outline-variant"
                  id="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors" type="button">
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>
            {/* CTA Button */}
            <button
              className="w-full h-12 mt-4 bg-primary-container text-white font-semibold text-[14px] rounded-lg hover:bg-primary transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </button>
          </form>
          {/* Support Footer */}
          <footer className="mt-12 text-center">
            <p className="text-[#9CA3AF] text-[11px] font-medium tracking-tight">
              PayChain · Authorized Personnel Only
            </p>
          </footer>
        </div>
      </section>
      {/* Visual Polish: Subtle Gradient Overlay for Depth */}
      <div className="fixed inset-0 pointer-events-none ring-1 ring-inset ring-black/5 z-50"></div>
    </main>
  );
};

export default Login;
