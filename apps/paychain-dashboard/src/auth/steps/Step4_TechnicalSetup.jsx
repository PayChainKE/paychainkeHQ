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
