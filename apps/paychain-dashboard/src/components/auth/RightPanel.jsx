import React from 'react';

export default function RightPanel({ title = 'Protect Your Business from Inflation' }) {
  return (
    <div className="p-6 card">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">PayChainKE</h2>
        <p className="text-sm text-slate-300 mt-2">{title}</p>
      </div>

      <div className="bg-white/6 p-4 rounded-lg mb-4">
        <div className="h-28 rounded-lg bg-gradient-to-br from-slate-700/40 to-transparent p-4">
          <div className="text-xs text-slate-200">Mock Dashboard Preview</div>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        <li>✦ M-PESA + USDC hybrid balances</li>
        <li>✦ KRA e-TIMS auto-compliance</li>
        <li>✦ Sentinel AI fraud protection</li>
      </ul>
    </div>
  );
}
import React from 'react';

export default function RightPanel() {
  return (
    <div className="hidden md:flex flex-col gap-6 items-start justify-center w-full h-full p-8 bg-gradient-to-br from-[#071028] to-[#091427] rounded-2xl">
      <div className="text-3xl font-bold">PayChainKE <span className="text-[#00C896]">•</span></div>
      <p className="text-slate-300">Protect Your Business from Inflation</p>
      <div className="mt-4 p-4 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 w-full">
        <div className="text-sm text-slate-200">Dashboard preview</div>
        <div className="mt-3 h-24 bg-gradient-to-tr from-[#021022] to-[#032033] rounded-lg" />
      </div>
      <ul className="text-sm text-slate-300 space-y-2">
        <li>✦ M-PESA + USDC hybrid balances</li>
        <li>✦ KRA e-TIMS auto-compliance</li>
        <li>✦ Sentinel AI fraud protection</li>
      </ul>
    </div>
  );
}
