import React from 'react';

const Escrow: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">Supplier Escrow</h1>
    <p className="text-gray-600 mb-6">Manage supplier payments and global goods spending. Secure escrow for business transactions and pay with USDC.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold mb-4">Create New Escrow</button>
      <ul className="space-y-2">
        <li className="flex items-center justify-between border-b py-2">
          <span>Supplier: Nairobi Textiles</span>
          <span className="text-xs text-gray-500">USDC $2,000</span>
        </li>
        <li className="flex items-center justify-between border-b py-2">
          <span>Supplier: Global Electronics</span>
          <span className="text-xs text-gray-500">USDC $5,500</span>
        </li>
      </ul>
    </div>
  </div>
);

export default Escrow;
