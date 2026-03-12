import React from 'react';

const InflationShield: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">Inflation Shield Vault</h1>
    <p className="text-gray-600 mb-6">Manage your stablecoin savings and protect your wealth from inflation. Auto-swap incoming payments, set liquidity thresholds, and perform emergency swaps.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <span className="font-semibold text-lg">Auto-Swap Incoming Payments</span>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold">On</button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Threshold:</label>
        <input type="number" placeholder="Keep KES liquid, swap excess" className="border rounded px-3 py-2 w-64" />
      </div>
      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Emergency Swap</button>
    </div>
    <a href="/dashboard/escrow" className="text-emerald-600 underline font-medium">Spend USDC on global goods (Supplier Escrow)</a>
  </div>
);

export default InflationShield;
