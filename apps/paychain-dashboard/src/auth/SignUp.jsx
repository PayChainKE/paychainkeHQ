import React from 'react';
import { Link } from 'react-router-dom';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import RightPanel from '@/components/auth/RightPanel';
import { useSignUpForm } from '@/hooks/useAuthForm';
import PasswordStrength from '@/components/auth/PasswordStrength';

export default function SignUp(){
  const { values, errors, handleChange, handleSubmit, loading } = useSignUpForm();

  return (
    <AuthSplitLayout rightContent={<RightPanel title="Join 12,000+ Kenyan businesses on PayChain" />}>
      <div className="card p-6">
        <div className="mb-4">
          <Link to="/signin" className="text-slate-300">← Back</Link>
          <h1 className="text-xl font-bold mt-2">Create your merchant account</h1>
          <p className="text-sm text-slate-300">Join 12,000+ Kenyan businesses on PayChain</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="name" placeholder="Amara Osei" value={values.name} onChange={handleChange} className="input-custom w-full" />
          {errors.name && <div className="text-sm text-red-400">{errors.name}</div>}

          <input name="businessName" placeholder="Osei General Store" value={values.businessName} onChange={handleChange} className="input-custom w-full" />
          {errors.businessName && <div className="text-sm text-red-400">{errors.businessName}</div>}

          <input name="mpesa" placeholder="0712 345 678" value={values.mpesa} onChange={handleChange} className="input-custom w-full" />
          {errors.mpesa && <div className="text-sm text-red-400">{errors.mpesa}</div>}

          <input name="email" placeholder="you@business.com (optional)" value={values.email} onChange={handleChange} className="input-custom w-full" />

          <input name="password" placeholder="Create Password" value={values.password} onChange={handleChange} className="input-custom w-full" />
          <PasswordStrength password={values.password} />
          {errors.password && <div className="text-sm text-red-400">{errors.password}</div>}

          <input name="confirm" placeholder="Confirm Password" value={values.confirm} onChange={handleChange} className="input-custom w-full" />
          {errors.confirm && <div className="text-sm text-red-400">{errors.confirm}</div>}

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="agree" onChange={handleChange} /> I agree to PayChain's <a className="text-emerald-text underline" href="#">Terms</a> and <a className="text-emerald-text underline" href="#">Privacy Policy</a></label>
          {errors.agree && <div className="text-sm text-red-400">{errors.agree}</div>}

          <div>
            <button type="submit" className="btn-primary w-full">{loading? 'Creating...':'Create Account & Start KYC'}</button>
          </div>

          <div className="text-sm text-center">Already have an account? <Link to="/signin" className="text-emerald-text">Sign in</Link></div>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import RightPanel from '@/components/auth/RightPanel';
import { useSignUpForm } from '@/hooks/useAuthForm';
import PasswordStrength from '@/components/auth/PasswordStrength';

export default function SignUp(){
  const nav = useNavigate();
  const { values, errors, handleChange, handleSubmit, loading } = useSignUpForm();

  return (
    <AuthSplitLayout
      leftChildren={(
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
          <Link to="/signin" className="text-sm text-slate-300">← Back</Link>
          <h2 className="text-2xl font-semibold mt-2">Create your merchant account</h2>
          <p className="text-sm text-slate-300 mb-4">Join 12,000+ Kenyan businesses on PayChain</p>
          <input name="name" placeholder="Amara Osei" value={values.name} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          {errors.name && <div className="text-red-500 text-xs">{errors.name}</div>}
          <input name="businessName" placeholder="Osei General Store" value={values.businessName} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          {errors.businessName && <div className="text-red-500 text-xs">{errors.businessName}</div>}
          <input name="mpesa" placeholder="0712 345 678" value={values.mpesa} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          {errors.mpesa && <div className="text-red-500 text-xs">{errors.mpesa}</div>}
          <input name="email" placeholder="you@business.com" value={values.email} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <input name="password" type="password" placeholder="Create password" value={values.password} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <PasswordStrength password={values.password} />
          <input name="confirm" type="password" placeholder="Confirm password" value={values.confirm} onChange={handleChange} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <label className="flex items-center gap-2 mt-3"><input type="checkbox" name="agree" onChange={handleChange} /> I agree to <a className="text-[#00C896] underline">Terms of Service</a> and <a className="text-[#00C896] underline">Privacy Policy</a></label>
          {errors.agree && <div className="text-red-500 text-xs">{errors.agree}</div>}
          <button onClick={() => handleSubmit(() => nav('/kyc'))} className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-[#041427] font-semibold rounded-xl px-5 py-3 w-full">{loading? 'Creating...':'Create Account & Start KYC'}</button>
          <div className="mt-3 text-sm">Already have an account? <Link to="/signin" className="text-[#00C896]">Sign in</Link></div>
        </div>
      )}
      rightContent={<RightPanel />}
    />
  );
}
