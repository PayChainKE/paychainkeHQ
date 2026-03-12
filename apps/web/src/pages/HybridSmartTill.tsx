import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function HybridSmartTill() {
  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-4">The Hybrid Smart Till</h1>
        <p className="text-slate-600 mb-6">A portable, offline-first smart till that accepts card, mobile money and cash — with local-first reconciliation and instant settlement options.</p>
        <section className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-2">Key features</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            <li>Offline payment capture with secure sync</li>
            <li>Multi-currency settlement and auto-conversion</li>
            <li>Easy device pairing and remote configuration</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
