import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OTPInput from '@/components/auth/OTPInput';

export default function ForgotPassword(){
  const [phase, setPhase] = useState(0);
  const [mpesa, setMpesa] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const navigate = useNavigate();

  function sendOTP(e){
    e.preventDefault();
    setPhase(1);
  }

  function reset(e){
    e.preventDefault();
    // accept any otp for mock
    setPhase(2);
  }

  function finish(e){
    e.preventDefault();
    // success
    navigate('/signin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-md">
        <Link to="/signin" className="text-slate-300">← Back</Link>
        <h1 className="text-xl font-bold mt-2">Reset your password</h1>
        <p className="text-sm text-slate-300">Enter your M-PESA number and we'll send an OTP</p>

        {phase === 0 && (
          <form onSubmit={sendOTP} className="mt-4 space-y-3">
            <input value={mpesa} onChange={(e)=>setMpesa(e.target.value)} placeholder="0712 345 678" className="input-custom w-full" />
            <button className="btn-primary w-full">Send OTP</button>
          </form>
        )}

        {phase === 1 && (
          <form onSubmit={reset} className="mt-4 space-y-3">
            <div className="flex gap-2"><OTPInput onChange={setOtp} /></div>
            <input value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="New password" className="input-custom w-full" />
            <button className="btn-primary w-full">Reset Password</button>
            <div className="text-sm text-slate-400">Resend OTP in 60s</div>
          </form>
        )}

        {phase === 2 && (
          <div className="mt-4">
            <div className="text-green-400">Password reset successful</div>
            <button onClick={finish} className="btn-primary mt-3 w-full">Go to Sign in</button>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import RightPanel from '@/components/auth/RightPanel';
import OTPInput from '@/components/auth/OTPInput';

export default function ForgotPassword(){
  const nav = useNavigate();
  const [phase, setPhase] = useState(0);
  const [mpesa, setMpesa] = useState('');
  const [otp, setOtp] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1628] p-6">
      <div className="w-full max-w-md bg-white/5 p-6 rounded-2xl border border-white/10">
        <Link to="/signin" className="text-sm text-slate-300">← Back</Link>
        <h2 className="text-2xl font-semibold mt-2">Reset your password</h2>
        <p className="text-sm text-slate-300 mb-4">Enter your M-PESA number and we'll send an OTP</p>
        {phase===0 && (
          <>
            <input value={mpesa} onChange={e=>setMpesa(e.target.value)} placeholder="0712 345 678" className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
            <button onClick={()=>setPhase(1)} className="mt-4 bg-emerald-600 w-full rounded-xl py-3">Send OTP</button>
          </>
        )}
        {phase===1 && (
          <>
            <OTPInput value={otp} onChange={setOtp} />
            <input placeholder="New password" className="w-full mt-3 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
            <input placeholder="Confirm password" className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
            <div className="flex justify-between mt-2"><button className="text-sm text-slate-300">Resend OTP (60s)</button></div>
            <button onClick={()=>{nav('/signin');}} className="mt-4 bg-emerald-600 w-full rounded-xl py-3">Reset Password</button>
          </>
        )}
      </div>
    </div>
  );
}
