import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_MOU_REF, MOCK_WALLET } from '@/data/authData';

export default function Step5({ data }){
  const navigate = useNavigate();

  function enter(){
    localStorage.setItem('kyc_complete', 'true');
    navigate('/overview');
  }

  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-emerald-400 text-black flex items-center justify-center text-4xl">✓</div>
      </div>
      <h2 className="text-2xl font-bold">You're all set, {data.name || 'Merchant'}!</h2>
      <p className="text-sm text-slate-300 mt-2">Your PayChain merchant account is active</p>

      <div className="card p-4 mt-6 text-left">
        <div>✓ Personal KYC submitted — Under review (24hrs)</div>
        <div>✓ e-TIMS activated — MOU #{MOCK_MOU_REF}</div>
        <div>✓ Inflation Shield connected — {MOCK_WALLET}</div>
      </div>

      <div className="mt-6">
        <button onClick={enter} className="btn-primary w-full">Enter Dashboard</button>
      </div>
    </div>
  );
}
import React from 'react';
import { MOCK_MOU_REF, MOCK_WALLET } from '@/data/authData';

export default function Step5({ data, onEnter }){
  return (
    <div className="text-center py-10">
      <div className="mx-auto w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white text-4xl">✓</div>
      <h3 className="text-2xl font-semibold mt-4">You're all set, {data.name||'Merchant'}!</h3>
      <p className="text-slate-300 mt-2">Your PayChain merchant account is active</p>
      <div className="mt-4 bg-white/5 p-4 rounded-2xl">
        <div>✓ Personal KYC submitted — Under review (24hrs)</div>
        <div>✓ e-TIMS activated — MOU #{MOCK_MOU_REF}</div>
        <div>✓ Inflation Shield connected — {MOCK_WALLET}</div>
      </div>
      <div className="mt-4 text-amber-400">Our compliance team will verify your documents within 24 hours. You can access the dashboard now with limited features.</div>
      <button onClick={onEnter} className="mt-6 w-full bg-emerald-600 rounded-xl py-3">Enter Dashboard</button>
    </div>
  );
}
