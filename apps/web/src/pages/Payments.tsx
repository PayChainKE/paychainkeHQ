import React from 'react';

const Payments: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">Payments</h1>
    <p className="text-gray-600 mb-6">View and manage all merchant payments. Initiate new payments, review history, and track payment status.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold mb-4">Initiate Payment</button>
      <ul className="space-y-2">
        <li className="flex items-center justify-between border-b py-2">
          <span>Payment to John Doe</span>
          <span className="text-xs text-gray-500">Ksh 5,000.00</span>
        </li>
        <li className="flex items-center justify-between border-b py-2">
          <span>Payment to Jane Smith</span>
          <span className="text-xs text-gray-500">Ksh 2,500.00</span>
        </li>
      </ul>
    </div>
  </div>
);

export default Payments;
