import React from 'react';

const PayrollUtilities: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">Payroll & Utilities</h1>
    <p className="text-gray-600 mb-6">Manage payroll, pay bills, and handle business utilities. Upload employee lists, pay KPLC, Nairobi Water, and more.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold mb-4">Upload Employee CSV</button>
      <ul className="space-y-2">
        <li className="flex items-center justify-between border-b py-2">
          <span>Payroll for March</span>
          <span className="text-xs text-gray-500">KES 120,000</span>
        </li>
        <li className="flex items-center justify-between border-b py-2">
          <span>KPLC Bill</span>
          <span className="text-xs text-gray-500">KES 8,500</span>
        </li>
      </ul>
    </div>
    <div className="bg-green-100 border-l-4 border-green-500 p-4 mt-6">
      <span className="font-semibold text-green-700">Utility:</span> Pay with USDC vault for instant settlement.
    </div>
  </div>
);

export default PayrollUtilities;
