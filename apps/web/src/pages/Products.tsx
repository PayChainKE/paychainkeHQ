import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, FileText, Shield, Send, Wallet, Settings } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Breadcrumbs from '@/components/Breadcrumbs'

const products = [
  {
    path: '/products/virtual-account',
    icon: FileText,
    name: 'PayChain Virtual Account',
    tagline: 'A Paybill and account. Verified.',
    desc: 'A dedicated PayChain Paybill and virtual account for your business: collect in person, via payment link (even over WhatsApp), STK push, or invoice, all verified and settled instantly.',
  },
  {
    path: '/products/inflation-shield',
    icon: Shield,
    name: 'The Inflation Shield',
    tagline: 'Coming soon.',
    desc: 'A stablecoin protection feature we\'re currently building, to hedge shilling depreciation without visiting a forex bureau. In development.',
  },
  {
    path: '/products/bulk-pay',
    icon: Send,
    name: 'PayChain Bulk Pay',
    tagline: 'Batch payroll and mass payouts.',
    desc: 'Pay employees, suppliers, and contractors, and settle KPLC tokens (prepaid or postpaid), water, internet, and other utilities, all in one click.',
  },
  {
    path: '/products/cash-advance',
    icon: Wallet,
    name: 'Cash Advance',
    tagline: 'Working capital, no collateral.',
    desc: 'Access capital based on your verified PayChain transaction history, not land titles, guarantors, or bank relationships.',
  },
  {
    path: '/products/operations-tools',
    icon: Settings,
    name: 'Operations Tools',
    tagline: 'Reconciliation, disputes, and dashboards.',
    desc: 'Real-time visibility, financial controls, and compliance automation, everything you need to run a modern Kenyan business.',
  },
]

export default function Products() {
  return (
    <div className="min-h-screen bg-white text-[#0A192F]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-28 pb-24">
        <Breadcrumbs currentPage="Products" />

        <header className="text-center mb-16 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">Products</h1>
          <p className="mt-4 text-lg text-slate-600">
            Everything a Kenyan merchant needs to collect payments, protect revenue, pay out, and access capital, all from one dashboard.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, i) => {
            const Icon = product.icon
            return (
              <motion.div
                key={product.path}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <Link
                  to={product.path}
                  className="group flex flex-col h-full p-6 border border-gray-200 rounded-2xl hover:border-[#00bf63]/40 hover:shadow-lg transition-all duration-300 bg-white"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5 group-hover:bg-[#00bf63] transition-colors duration-300">
                    <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm font-semibold text-[#00a857] mb-3">{product.tagline}</p>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1">{product.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 group-hover:text-[#00a857] transition-colors">
                    Learn more
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </section>

        <div className="mt-16 text-center">
          <a
            href="https://app.paychain.co.ke"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 shadow-sm"
          >
            Get Started
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
