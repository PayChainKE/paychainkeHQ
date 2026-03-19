import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function PaychainBulkPay() {
  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-4">Paychain Bulk Pay</h1>
        <p className="text-slate-600 mb-6">Scale payroll and supplier payouts with queued batch processing, retries, and multi-rail settlement options.</p>
        <section className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-2">Capabilities</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            <li>CSV or API-driven batch uploads</li>
            <li>Retry, reconciliation and reporting</li>
            <li>Integrates with local mobile money rails</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
