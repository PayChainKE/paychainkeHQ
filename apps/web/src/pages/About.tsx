import React from 'react'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PoweredBy from '@/components/PoweredBy'

const spring = { type: 'spring', stiffness: 120, damping: 18 }

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <motion.section
    className={`w-full max-w-6xl mx-auto py-20 px-6 ${className}`}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0, transition: { ...spring, duration: 0.5 } }}
    viewport={{ once: true, amount: 0.2 }}
  >
    {children}
  </motion.section>
)

const TruthGrid: React.FC = () => (
  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden>
    <defs>
      <linearGradient id="g" x1="0" x2="1">
        <stop offset="0%" stopColor="#E6F8F0" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#E6F8F0" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="white" />
    <g className="opacity-40">
      {[...Array(12)].map((_, i) => (
        <line key={i} x1={`${(i + 1) * 8}%`} y1="0" x2={`${(i + 1) * 8}%`} y2="100%" stroke="url(#g)" strokeWidth="1" />
      ))}
    </g>
  </svg>
)
export default function About() {
  return (
    <div className="min-h-screen bg-white text-[#0A192F] font-sans relative overflow-hidden">
      <Navbar />

      {/* About hero using provided image to match site hero sizing */}
      <section className="w-full bg-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col lg:flex-row items-center gap-10 lg:gap-0 py-12 sm:py-16 lg:py-20">
          <div className="w-full lg:w-1/2 flex flex-col items-start lg:-ml-12 relative z-10">
            <motion.h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0, transition: { ...spring } }} viewport={{ once: true }}>
              Infrastructure for Digital Truth.
            </motion.h1>

            <motion.p className="mt-4 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed max-w-lg" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0, transition: { ...spring, delay: 0.04 } }} viewport={{ once: true }}>
              We are building the Hybrid Business OS to protect and empower the African merchant.
            </motion.p>
          </div>

          <div className="w-full flex items-center justify-center relative z-0 mt-6 lg:mt-0 lg:relative lg:w-1/2">
            <div className="w-full h-56 sm:h-72 md:h-96 lg:h-[420px] rounded-lg overflow-hidden shadow-lg" style={{ backgroundImage: "url('/hero%203.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
          </div>
        </div>
      </section>

      <main className="relative z-10">
        <Section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <motion.article
              className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0, transition: { ...spring, duration: 0.5 } }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-semibold text-[#0A192F]">Our Mission</h3>
              <p className="mt-4 text-slate-600 text-lg">
                Eliminating the trust deficit in African retail by linking directly to institutional source data.
              </p>
            </motion.article>

            <motion.aside
              className="bg-[#F8FAFC] rounded-2xl p-6 border border-gray-100 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0, transition: { ...spring, delay: 0.06, duration: 0.5 } }}
              viewport={{ once: true }}
            >
              <h4 className="text-sm font-semibold text-[#0A192F]">The Problem</h4>
              <ul className="mt-3 text-slate-600 list-disc list-inside space-y-2">
                <li>Fake SMS fraud that undermines merchant liquidity.</li>
                <li>Currency inflation eroding real purchasing power.</li>
              </ul>
            </motion.aside>
          </div>

          <motion.div
            className="mt-8 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0, transition: { ...spring, delay: 0.08, duration: 0.5 } }}
            viewport={{ once: true }}
          >
            <h4 className="text-base font-semibold text-[#0A192F]">The Hybrid Solution</h4>
            <p className="mt-3 text-slate-600">
              We bridge traditional institutional rails like Jenga and M-PESA with modern settlement on Base L2 USDC, combining
              local payment certainty with on-chain settlement resilience and programmability.
            </p>
          </motion.div>
        </Section>

        <Section>
          <div className="max-w-7xl mx-auto">
            <motion.h3 className="text-2xl font-semibold text-[#0A192F]" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0, transition: { ...spring } }} viewport={{ once: true }}>
              The PayChainKE Narrative
            </motion.h3>

            <motion.div className="mt-6 space-y-8 text-slate-700" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0, transition: { ...spring, delay: 0.03 } }} viewport={{ once: true }}>
              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">1. Our Purpose: The Architecture of Trust</h4>
                <p className="mt-3">
                  In the rapidly evolving landscape of African commerce, the "Digital Trust Deficit" remains the single greatest
                  barrier to scale. PayChainKE was founded to dismantle this barrier. We don't just process transactions; we anchor
                  them in absolute truth. By linking directly to institutional source data, we ensure that every merchant—from a
                  boutique in Nairobi to a wholesaler in Juja—operates on a foundation of verified financial facts.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">2. Bridging Two Worlds: The Hybrid PSP Model</h4>
                <p className="mt-3">
                  We believe the future of finance is not a choice between traditional rails and decentralized protocols—it is the
                  seamless integration of both.
                </p>
                <ul className="mt-3 list-disc list-inside text-slate-600">
                  <li><strong>The Fiat Core:</strong> Leveraging the reach of M-PESA and the banking stability of the Jenga API ecosystem.</li>
                  <li className="mt-2"><strong>The Web3 Shield:</strong> Utilizing Base Layer 2 to provide a non-custodial Inflation Shield, allowing merchants to store value in USDC stablecoins with near-zero latency.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">3. Engineered for Resilience</h4>
                <p className="mt-3">Our technical philosophy is built on three industrial-grade pillars:</p>
                <ul className="mt-3 list-disc list-inside text-slate-600 space-y-2">
                  <li><strong>Sentinel AI:</strong> A high-performance Rust engine that validates every digital handshake in under 100ms, making "Fake SMS" fraud mathematically impossible.</li>
                  <li><strong>Non-Custodial Sovereignty:</strong> We provide the tools, but the merchant owns the keys. This architecture ensures full compliance with the VASP Act 2025 while protecting user privacy.</li>
                  <li><strong>Universal Connectivity:</strong> Integrated with Africa’s Talking, we ensure that "Truth Alerts" reach merchants via USSD even in low-data environments, ensuring 100% operational uptime.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">4. The "Zero-Knowledge" Security Paradigm</h4>
                <p className="mt-3">We operate on a principle of radical security where privacy is not an afterthought, but a core architectural requirement. By utilizing a non-custodial framework, PayChainKE ensures that we never hold, see, or touch your private keys or your digital assets. This "Zero-Knowledge" approach means your financial sovereignty is absolute—you are the sole custodian of your wealth, protected by the mathematical certainty of the Base L2 blockchain.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">5. Beyond Payments: The Business Operating System</h4>
                <p className="mt-3">PayChainKE is more than a gateway; it is a comprehensive command center for the modern merchant. We understand that running a business involves more than just accepting funds. Our ecosystem integrates:</p>
                <ul className="mt-3 list-disc list-inside text-slate-600 space-y-2">
                  <li><strong>Operational Automation:</strong> Seamlessly transition from a verified sale to an automated e-TIMS tax filing without opening a second app.</li>
                  <li><strong>Smart Liquidity:</strong> A "Unified Balance" view that allows you to manage KES cash flow for daily operations alongside a USDC vault for long-term wealth preservation.</li>
                  <li><strong>Enterprise Outbound:</strong> The same industrial-grade security used to verify your income is applied to your expenses—from bulk payroll to supplier settlements.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">6. A Commitment to the "Last Mile" Merchant</h4>
                <p className="mt-3">Our vision of 1st-world infrastructure is one that serves everyone, regardless of their hardware or internet stability. By partnering with Africa’s Talking, we’ve engineered a "Dual-Rail" notification system. If your data connection fails in a high-traffic retail environment, our Sentinel AI automatically pushes a "Truth Alert" via USSD or SMS. We ensure that the merchant in the heart of Nairobi CBD and the wholesaler in the outskirts of Juja receive the same high-fidelity service.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">7. Guided by Global Strategic Excellence</h4>
                <p className="mt-3">The PayChainKE mission is powered by a synergy of local technical execution and global strategic foresight. Led by Brandon, a specialist in high-performance fintech architecture, and mentored by Michelle Chivunga, a globally recognized voice in blockchain policy and digital transformation, we are not just building for today’s market—we are architecting the future of African commerce.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-[#0A192F]">8. Our Strategic Values (The PayChain Code)</h4>
                <ul className="mt-3 list-disc list-inside text-slate-600 space-y-2">
                  <li><strong>Absolute Veracity:</strong> We do not guess; we verify directly with institutional source data.</li>
                  <li><strong>Merchant-First Sovereignty:</strong> The merchant is the owner; the platform is the facilitator.</li>
                  <li><strong>Hyper-Scale Efficiency:</strong> Sub-100ms performance is our standard, ensuring that technology never slows down a sale.</li>
                  <li><strong>Inclusive Innovation:</strong> Cutting-edge Web3 stability delivered with the familiarity of M-PESA.</li>
                </ul>
              </div>
            </motion.div>
          </div>
        </Section>
      </main>
      <Section>
        <motion.div
          className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0, transition: { ...spring, duration: 0.5 } }}
          viewport={{ once: true }}
        >
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-left shadow-sm">
            <div className="text-sm font-medium text-[#0A192F]">Inflation Shield</div>
            <div className="mt-2 text-lg font-semibold text-[#0A192F]">+20% Preserved</div>
            <p className="mt-3 text-sm text-slate-600">Auto-converts idle KES float to USDC on Base L2, protecting savings from shilling depreciation 24/7.</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-left shadow-sm">
            <div className="text-sm font-medium text-[#0A192F]">Sentinel AI</div>
            <div className="mt-2 text-lg font-semibold text-[#0A192F]">&lt;100ms Block</div>
            <p className="mt-3 text-sm text-slate-600">Sub-100ms server-side verification eliminates fake SMS fraud, confirmed directly from Safaricom.</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-left shadow-sm">
            <div className="text-sm font-medium text-[#0A192F]">e-TIMS Native</div>
            <div className="mt-2 text-lg font-semibold text-[#0A192F]">Zero Penalties</div>
            <p className="mt-3 text-sm text-slate-600">Every sale triggers an automatic ETR receipt and KRA submission. Stay compliant without lifting a finger.</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-left shadow-sm">
            <div className="text-sm font-medium text-[#0A192F]">Pay-for-Business</div>
            <div className="mt-2 text-lg font-semibold text-[#0A192F]">1-Click Payouts</div>
            <p className="mt-3 text-sm text-slate-600">Bulk payroll, supplier payments, and utility bills — automated in one dashboard. In KES or USDC.</p>
          </div>
        </motion.div>
      </Section>
      <Section>
        <PoweredBy />
      </Section>
      <Footer />
    </div>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-[#F8FAFC] border border-gray-100 text-sm text-[#0A192F] shadow-sm">
      {label}
    </div>
  )
}

function StepCard({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 text-left shadow-sm">
      <div className="text-sm font-medium text-[#10B981]">Step {number}</div>
      <div className="mt-2 font-semibold text-[#0A192F]">{title}</div>
      <div className="mt-2 text-sm text-slate-600">{desc}</div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-6">
      <div className="text-2xl font-semibold text-[#0A192F]">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  )
}

