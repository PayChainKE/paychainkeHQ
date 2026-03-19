import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const CashAdvance: React.FC = () => (
  <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
    <Navbar />

    <main className="max-w-4xl mx-auto px-6 py-20">
      <h1 className="text-2xl font-bold mb-4">Cash Advance</h1>
      <p className="text-gray-600 mb-6">Access business overdraft and cash advance tools. Bridge payroll gaps and manage liquidity with professional fintech solutions.</p>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold mb-4">Request Cash Advance</button>
        <ul className="space-y-2">
          <li className="flex items-center justify-between border-b py-2">
            <span>Advance #001</span>
            <span className="text-xs text-gray-500">KES 20,000</span>
          </li>
          <li className="flex items-center justify-between border-b py-2">
            <span>Advance #002</span>
            <span className="text-xs text-gray-500">KES 15,000</span>
          </li>
        </ul>
      </div>
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mt-6">
        <span className="font-semibold text-yellow-700">Tip:</span> Low on KES for Payroll? Use Overdraft to bridge the gap.
      </div>
    </main>

    <Footer />
  </div>
)

export default CashAdvance;
