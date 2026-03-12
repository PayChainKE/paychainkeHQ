import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function OperationsTools() {
  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-4">Operations tools</h1>
        <p className="text-slate-600 mb-6">A suite of operational tools for reconciliation, dispute management, and finance dashboards.</p>
        <section className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-2">What's inside</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            <li>Automated reconciliation engine</li>
            <li>Dispute workflow and audit logs</li>
            <li>Role-based access and reporting</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
