import React from 'react';

export default function Overview(){
  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-slate-300 mt-2">Welcome to the PayChain dashboard overview (mock).</p>
        <div className="mt-6 bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/3">Balance • KES 120,000</div>
            <div className="p-4 rounded-xl bg-white/3">USDC Vault • $1,200</div>
            <div className="p-4 rounded-xl bg-white/3">Recent Txns • 12</div>
          </div>
        </div>
      </div>
    </div>
  );
}
