import React, { useState } from 'react';
import OTPInput from '@/components/auth/OTPInput';
import { MOCK_OTP, MOCK_WALLET } from '@/data/authData';

export default function Step4({ data, setData, next, back }){
  const [kraPhone, setKraPhone] = useState('');
  const [otpPhase, setOtpPhase] = useState(false);
  const [otp, setOtp] = useState('');
  const [wallet, setWallet] = useState(data.wallet || '');

  function sendKra(){ setOtpPhase(true); }
  function verifyKra(){ if(otp === MOCK_OTP){ setData(d=>({ ...d, etims: 'activated', mou: 'KRA-2026-04812' })); } setOtpPhase(false); }

  function generateWallet(){ const mock = MOCK_WALLET; setWallet(mock); setData(d=>({ ...d, wallet: mock })); }

  return (
    <div>
      <h2 className="text-lg font-bold">Activate Your PayChain Features</h2>
      <p className="text-sm text-slate-300">Two powerful tools — set up now or skip and do later</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card p-4">
          <div className="font-medium">KRA e-TIMS Integration</div>
          <div className="text-sm text-slate-300 mt-2">Automatically file every transaction with KRA.</div>
          <input placeholder="KRA PIN Registered Phone Number" className="input-custom w-full mt-3" value={kraPhone} onChange={(e)=>setKraPhone(e.target.value)} />
          {!otpPhase && <button onClick={sendKra} className="btn-primary mt-3">Send KRA OTP</button>}
          {otpPhase && <div className="mt-3"><OTPInput onChange={setOtp} /><button onClick={verifyKra} className="btn-primary mt-3">Verify</button></div>}
        </div>

        <div className="card p-4">
          <div className="font-medium">Inflation Shield Vault</div>
          <div className="text-sm text-slate-300 mt-2">Auto-convert excess KES to USDC on Base L2</div>
          <div className="mt-4">
            <button onClick={generateWallet} className="btn-outline">Generate Non-Custodial Wallet</button>
            {wallet && <div className="text-sm mt-3 text-emerald-text">{wallet} <button className="ml-3 text-xs">Copy & Save</button></div>}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={back} className="btn-outline">Back</button>
        <button onClick={next} className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import OTPInput from '@/components/auth/OTPInput';

export default function Step4({ onNext, onBack }){
  const [kraPhone, setKraPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [activated, setActivated] = useState(false);
  const [wallet, setWallet] = useState('');

  return (
    <div>
      <h3 className="text-xl font-semibold">Activate Your PayChain Features</h3>
      <p className="text-sm text-slate-300">Two powerful tools — set up now or skip and do later</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="p-4 bg-white/5 rounded-2xl">
          <h4 className="font-medium">KRA e-TIMS Integration</h4>
          <input placeholder="KRA PIN Registered Phone" value={kraPhone} onChange={e=>setKraPhone(e.target.value)} className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
          <button onClick={()=>alert('OTP sent (mock)')} className="mt-3 px-4 py-2 rounded-xl border">Send KRA OTP</button>
          <div className="mt-3"><OTPInput value={otp} onChange={setOtp} /></div>
          <div className="mt-3"><button onClick={()=>{ if(otp==='123456'){ setActivated(true); alert('Activated (mock)'); }else alert('Invalid OTP (mock)'); }} className="px-4 py-2 rounded-xl bg-emerald-600">Verify OTP</button></div>
        </div>
        <div className="p-4 bg-white/5 rounded-2xl">
          <h4 className="font-medium">Inflation Shield Vault</h4>
          <div className="mt-2">
            <label className="flex items-center gap-2"><input type="radio" name="wallet" onChange={()=>setWallet('existing')} /> Connect Existing Wallet</label>
            <input placeholder="0x..." className="w-full mt-2 bg-white/5 border border-white/15 rounded-xl px-4 py-3" />
            <label className="flex items-center gap-2 mt-3"><input type="radio" name="wallet" onChange={()=>{ setWallet('new'); setWallet('0xA3f...9c2'); }} /> Generate New Wallet</label>
            {wallet && <div className="mt-2 text-sm text-emerald-400">Mock wallet: 0xA3f...9c2</div>}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-between"><button onClick={onBack} className="px-4 py-2 rounded-xl border">Back</button><button onClick={onNext} className="px-4 py-2 rounded-xl bg-emerald-600">Continue</button></div>
    </div>
  );
}
