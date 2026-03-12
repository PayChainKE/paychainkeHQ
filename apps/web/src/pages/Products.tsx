import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function Products() {
  return (
    <div className="min-h-screen bg-white text-[#0A192F] font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-24">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold">Products</h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">Explore our product offerings. This page is a placeholder — I can build product listings if you want.</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 border rounded-lg">Product catalog coming soon.</div>
          <div className="p-6 border rounded-lg">Product catalog coming soon.</div>
          <div className="p-6 border rounded-lg">Product catalog coming soon.</div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
