import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function Compliance() {
  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-4">Compliance</h1>
        <p className="text-slate-600 mb-6">End-to-end KYC/AML workflows, case management, and reporting to satisfy local regulators.</p>
        <section className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-2">Features</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            <li>Automated KYC checks and document collection</li>
            <li>Risk scoring and alerts</li>
            <li>Exportable audit trails for regulators</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
