import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Repeat, Percent, Send, Shield, Wallet, Zap, ChevronDown } from 'lucide-react';
import './inflation-shield.css';
import Breadcrumbs from '@/components/Breadcrumbs';

const data = [
  { year: '2021', kes: 100, usdc: 100 },
  { year: '2022', kes: 85, usdc: 100 },
  { year: '2023', kes: 75, usdc: 100 },
  { year: '2024', kes: 70, usdc: 100 },
  { year: '2025', kes: 65, usdc: 100 },
];

const features = [
  { title: 'Instant KES → USDC Swaps', icon: Repeat, desc: 'Convert your KES balance to USDC in seconds from your dashboard. No queues, no negotiation.' },
  { title: 'Transparent 0.5% FX Rate', icon: Percent, desc: 'Flat 0.5% spread on all conversions. You see the exact rate before you confirm, no hidden fees.' },
  { title: 'Pay International Suppliers', icon: Send, desc: 'Send USDC directly to international suppliers. No wire transfers, no SWIFT fees, no bank delays.' },
  { title: 'Auto-Hedge Thresholds', icon: Shield, desc: 'Set a KES threshold: PayChain automatically converts surplus to USDC, protecting your purchasing power.' },
  { title: 'Hybrid KES + USDC Balance', icon: Wallet, desc: 'See and manage both currencies on one dashboard. Switch between them instantly as needs change.' },
  { title: 'Blockchain-Settled Transfers', icon: Zap, desc: 'All USDC transfers settle on Base Network: fast, cheap, and traceable under 10 seconds.' },
];

const stats = [
  { value: '30%', label: 'KES depreciation vs USD (2021–2024)' },
  { value: 'KES 150K', label: 'Purchasing power lost on KES 500K held in cash' },
  { value: '0.5%', label: 'PayChain flat FX spread' },
  { value: '< 10s', label: 'USDC transfer time on Base Network' },
];

const useCases = [
  { title: 'Import/Export Traders', desc: 'Pay international suppliers in USDC without wire transfers or SWIFT delays.' },
  { title: 'High Cash Flow Retail', desc: 'Protect surplus KES from depreciation automatically.' },
  { title: 'Hospitality Businesses', desc: 'Hold stable USDC reserves while running daily operations in KES.' },
  { title: 'Service Agencies', desc: 'Receive and hold USDC from international clients, convert to KES when needed.' },
];

const InflationShield: React.FC = () => {
  const [isUsdcOpen, setIsUsdcOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Breadcrumb strip */}
      <div className="pt-24 pb-2 bg-gray-50">
        <div className="container mx-auto px-6 lg:px-8">
          <Breadcrumbs currentPage="Inflation Shield" />
        </div>
      </div>

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="relative pb-20 lg:pb-28 overflow-hidden bg-[#0a0a0a] text-white">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-[#00bf63]/10 blur-3xl" />
            <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-16">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-sm font-medium text-gray-200">In development, coming soon</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
                  Stop Watching Your Profits <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500">Disappear</span>.
                </h1>
                <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                  We're building the PayChain Inflation Shield: a way to swap KES to USDC in seconds, protecting your purchasing power and hedging shilling depreciation without ever visiting a forex bureau. It's currently in development on Base Network; join the waitlist to be first in line when it opens up.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="https://app.paychain.co.ke" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
                    Join the Waitlist
                  </a>
                  <Link to="/contact" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all duration-300 backdrop-blur-md">
                    Talk to Sales
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-lg font-semibold text-gray-200 mb-6">KES Purchasing Power vs USDC (Baseline 100)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorKes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorUsdc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00bf63" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00bf63" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="year" stroke="#4b5563" tick={{fill: '#9ca3af'}} />
                        <YAxis stroke="#4b5563" tick={{fill: '#9ca3af'}} />
                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} />
                        <Area type="monotone" dataKey="kes" stroke="#f59e0b" fillOpacity={1} fill="url(#colorKes)" name="KES Value" strokeWidth={3} />
                        <Area type="monotone" dataKey="usdc" stroke="#00bf63" fillOpacity={1} fill="url(#colorUsdc)" name="USDC Value" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6 lg:px-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">The Shilling Lost Over 30% of Its Value in 3 Years. Your Business Felt Every Drop.</h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-10">
                Kenyan merchants who import goods, pay international suppliers, or simply hold cash in KES are quietly losing wealth every month, not through bad decisions, but through currency depreciation they have no control over. The options have always been bad: visit a forex bureau with unpredictable rates, hold USD in a bank account with high minimums, or just absorb the loss. <strong className="text-gray-900">We're building a fourth option.</strong>
              </p>
            </motion.div>
          </div>
        </section>

        {/* SOLUTION & EXPLAINER */}
        <section className="py-20 bg-gray-50 border-y border-gray-200">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-start max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h3 className="text-3xl font-bold text-gray-900 mb-6">Your Purchasing Power, Protected.</h3>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  The PayChain Inflation Shield is a built-in KES-to-USDC conversion engine that lets you swap your KES balance to USDC stablecoin directly from your dashboard, at a transparent 0.5% rate with no forex bureau, no bank minimum, no waiting.
                </p>
                
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm overflow-hidden transition-all duration-300">
                  <button 
                    onClick={() => setIsUsdcOpen(!isUsdcOpen)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="font-bold text-gray-900 text-lg">What is USDC?</span>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isUsdcOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <motion.div 
                    initial={false}
                    animate={{ height: isUsdcOpen ? 'auto' : 0, opacity: isUsdcOpen ? 1 : 0, marginTop: isUsdcOpen ? 16 : 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-gray-600 leading-relaxed">
                      USDC is a digital dollar. 1 USDC = $1 USD, always. It's issued by Circle, regulated in the US, and widely used globally as a stable store of value on the blockchain. It protects you from local currency fluctuations without needing a foreign bank account.
                    </p>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl"
              >
                <h4 className="text-2xl font-bold text-gray-900 mb-8">How it Works</h4>
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00bf63]/10 flex items-center justify-center text-[#00bf63] font-bold text-lg">1</div>
                    <div>
                      <h5 className="font-bold text-gray-900 mb-2">Fund Your KES Balance</h5>
                      <p className="text-gray-600">Collect payments through your PayChain Virtual Account or via mobile money deposits.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00bf63]/10 flex items-center justify-center text-[#00bf63] font-bold text-lg">2</div>
                    <div>
                      <h5 className="font-bold text-gray-900 mb-2">Swap to USDC Instantly</h5>
                      <p className="text-gray-600">Choose amount, see the exact rate and 0.5% fee, and confirm. Your USDC balance updates immediately.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00bf63]/10 flex items-center justify-center text-[#00bf63] font-bold text-lg">3</div>
                    <div>
                      <h5 className="font-bold text-gray-900 mb-2">Hold, Pay or Send</h5>
                      <p className="text-gray-600">Hold USDC as stable savings, pay international suppliers directly on-chain, or convert back to KES when needed.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything a Forex Bureau Does. <span className="text-[#00bf63]">Minus the Bureau.</span></h2>
              <p className="text-lg text-gray-600">Enterprise-grade tools packaged into a simple, beautiful dashboard.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-[#00bf63]/30 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:bg-[#00bf63] transition-colors duration-300">
                      <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{f.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="py-20 bg-[#0a0a0a] text-white">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Cost of Not Hedging</h2>
              <p className="text-gray-400">Numbers that speak for themselves.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center backdrop-blur-sm"
                >
                  <div className="text-4xl font-extrabold text-[#00bf63] mb-4">{stat.value}</div>
                  <div className="text-sm text-gray-400 uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* AUDIENCE SECTION */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">Built for Merchants Who Think Ahead</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {useCases.map((uc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex gap-4"
                >
                  <div className="w-2 h-12 bg-[#00bf63] rounded-full flex-shrink-0" />
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{uc.title}</h4>
                    <p className="text-gray-600">{uc.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6 lg:px-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[#0a0a0a] to-gray-900 rounded-3xl p-12 text-center max-w-4xl mx-auto border border-gray-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00bf63]/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
              
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">Your Money Should Hold Its Value. Soon, It Can.</h2>
              <p className="text-xl text-gray-400 mb-10 relative z-10">Sign up to PayChain today, and we'll notify you the moment the Inflation Shield opens up.</p>
              <div className="relative z-10 inline-flex items-center justify-center">
                <a href="https://app.paychain.co.ke" className="px-8 py-4 text-lg font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(0,191,99,0.3)]">
                  Join the Waitlist
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default InflationShield;
