import React from 'react';

const Tills: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">My Tills</h1>
    <p className="text-gray-600 mb-6">Programmatic issuance and management of merchant tills. Spawn new tills, view till details, and manage payments.</p>
    <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold mb-4">Spawn New One Equity Till</button>
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-2">Active Tills</h2>
      <ul className="space-y-2">
        <li className="flex items-center justify-between border-b py-2">
          <span>Equity Till #123456</span>
          <span className="text-xs text-gray-500">KES 12,400</span>
        </li>
        <li className="flex items-center justify-between border-b py-2">
          <span>Equity Till #654321</span>
          <span className="text-xs text-gray-500">KES 8,750</span>
        </li>
      </ul>
    </div>
  </div>
);

export default Tills;
