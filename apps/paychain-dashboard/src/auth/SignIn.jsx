import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import RightPanel from '@/components/auth/RightPanel';
import { useSignInForm } from '@/hooks/useAuthForm';

export default function SignIn() {
  const nav = useNavigate();
  const { values, errors, handleChange, handleSubmit, loading } = useSignInForm();
  const [show, setShow] = useState(false);

  return (
    <AuthSplitLayout
      leftChildren={(
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4"><div className="font-bold text-lg">PayChainKE</div><div className="text-[#00C896]">•</div></div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="text-sm text-slate-300 mb-4">Sign in to your merchant account</p>
          <label className="block text-xs">M-PESA Number or Email</label>
          <input name="identity" value={values.identity} onChange={handleChange} className="w-full mt-1 mb-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" placeholder="0712 345 678 or you@business.com" />
          {errors.identity && <div className="text-red-500 text-xs">{errors.identity}</div>}
          <label className="block text-xs mt-3">Password</label>
          <div className="relative">
            <input name="password" type={show? 'text':'password'} value={values.password} onChange={handleChange} className="w-full mt-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3" placeholder="••••••••" />
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-3 text-sm">{show? 'Hide':'Show'}</button>
          </div>
          {errors.password && <div className="text-red-500 text-xs">{errors.password}</div>}
          <div className="flex items-center justify-between mt-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="remember" onChange={handleChange} /> Remember me</label>
            <Link to="/forgot-password" className="text-[#00C896]">Forgot password?</Link>
          </div>
          <button onClick={() => handleSubmit(() => { const k = localStorage.getItem('kyc_complete'); nav(k? '/overview':'/kyc'); })} className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-[#041427] font-semibold rounded-xl px-5 py-3 w-full">{loading? 'Loading...':'Launch Dashboard'}</button>
          <div className="my-3 text-center text-slate-300">or</div>
          <Link to="/signup" className="block border border-white/10 rounded-xl px-5 py-3 text-center">Create merchant account</Link>
          <p className="text-xs text-slate-400 mt-4">Protected by Sentinel AI & 256-bit encryption</p>
        </div>
      )}
      rightContent={<RightPanel />}
    />
  );
}
