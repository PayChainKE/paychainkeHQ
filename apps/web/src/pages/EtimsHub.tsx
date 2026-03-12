import React from 'react';

const EtimsHub: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">e-TIMS Hub</h1>
    <p className="text-gray-600 mb-6">Simplified KRA compliance and e-TIMS management. View recent transactions, download PDFs, and monitor VAT reserves.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <div className="mb-4">
        <span className="font-semibold">Status:</span> PayChain is Registered as your KRA technical agent (Ref: MOU #XXXX).
      </div>
      <table className="w-full text-left mb-4">
        <thead>
          <tr>
            <th className="py-2">Transaction</th>
            <th className="py-2">e-TIMS Ref</th>
            <th className="py-2">PDF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TXN-8821</td>
            <td>ETIMS-12345</td>
            <td><a href="#" className="text-blue-600 underline">Download</a></td>
          </tr>
          <tr>
            <td>TXN-8820</td>
            <td>ETIMS-67890</td>
            <td><a href="#" className="text-blue-600 underline">Download</a></td>
          </tr>
        </tbody>
      </table>
      <div className="mb-2 text-red-600 font-semibold">Filing Deadline Approaching</div>
      <div className="mb-2 text-emerald-600 font-semibold">Tax Reserve Vault: KES 12,000 (VAT 16%)</div>
    </div>
  </div>
);

export default EtimsHub;
