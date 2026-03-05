import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Zap, Shield, RefreshCw, FileCheck, Users, Brain, ArrowRight } from 'lucide-react';
import TruthPing from './TruthPing';

// Custom hook for intersection observer
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return [ref, isIntersecting] as const;
};

const ProblemSolution: React.FC = () => {
  const [sectionRef, isInView] = useIntersectionObserver();
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{ background: '#0A192F' }}
      ref={sectionRef}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">

          {/* Problem Section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-5">
              Why Merchants Switch to PayChainKE
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Legacy tools are costing you{' '}
              <span className="text-red-400">
                more than you realise.
              </span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Fraud, inflation, compliance failures, and slow payouts compound silently.
              KES 40.24T flows through mobile money — yet{' '}
              <strong className="text-white">1.2M+ Kenyan businesses</strong> have no real protection layer.
            </p>
          </motion.div>

          {/* 2×2 Problem Cards */}
          <div className="grid md:grid-cols-2 gap-5 mb-24">

            {/* Card 1 — Inflation */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <span className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Crisis #1</span>
                    <h3 className="text-lg font-bold text-white leading-snug">Currency Devaluation</h3>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-400 shrink-0">−20%</span>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed">
                The KES fell from <strong className="text-white">108/USD → 129+/USD</strong> between 2021–2025. Every KES idle in your float account is silently losing purchasing power — even without a single fraud event.
              </p>

              {/* Mini bar chart */}
              <div className="rounded-xl bg-[#060f1e] border border-white/5 p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">KES Float Real Value (KES 500K base)</p>
                <div className="space-y-2">
                  {[
                    { yr: '2021', pct: 100, label: 'KES 500,000' },
                    { yr: '2022', pct: 94.6, label: 'KES 473,000' },
                    { yr: '2023', pct: 89, label: 'KES 445,000' },
                    { yr: '2024', pct: 83.6, label: 'KES 418,000' },
                    { yr: '2025', pct: 80, label: 'KES 400,000' },
                  ].map(({ yr, pct, label }) => (
                    <div key={yr} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-8 shrink-0">{yr}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-1.5 rounded-full bg-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-22 text-right shrink-0">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-red-400 mt-3">▲ Inflation Shield stops this erosion automatically</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <p className="text-[11px] text-slate-600">
                  Source: <a href="https://centralbank.go.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">CBK 2021–2025</a> · <a href="https://knbs.or.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">KNBS CPI 2025</a>
                </p>
                <span className="text-[10px] text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">Active daily</span>
              </div>
            </motion.div>

            {/* Card 2 — Fake SMS Fraud */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Crisis #2</span>
                    <h3 className="text-lg font-bold text-white leading-snug">Fake SMS & Payment Fraud</h3>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-400 shrink-0">344%↑</span>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed">
                Mobile banking fraud surged <strong className="text-white">344% in one year</strong> — reaching <strong className="text-white">KES 810M in direct losses</strong>. 49% of Kenyan phone owners received fraudulent messages in 2024. A merchant cannot tell a fake M-PESA SMS from a real one with legacy tools.
              </p>

              {/* Fake SMS visual mockup */}
              <div className="rounded-xl bg-[#060f1e] border border-white/5 p-4 space-y-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Typical fraud scenario</p>
                <div className="rounded-lg bg-green-900/20 border border-green-500/20 p-3">
                  <p className="text-[11px] text-green-300 font-mono">MPESA · You have received Ksh2,500.00 from JOHN KAMAU...</p>
                  <p className="text-[10px] text-red-400 mt-1">⚠ Fake — transaction does not exist on Safaricom servers</p>
                </div>
                <div className="rounded-lg bg-emerald-900/20 border border-emerald-500/20 p-3">
                  <p className="text-[11px] text-emerald-300 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Sentinel AI · Server verified · TXN-8X4K · ✓ Real
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <p className="text-[11px] text-slate-600">
                  Source: <a href="https://safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">Safaricom FY25</a> · <a href="https://transunion.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">TransUnion 2025</a>
                </p>
                <span className="text-[10px] text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">KES 810M lost</span>
              </div>
            </motion.div>

            {/* Card 3 — Reversals & Insider Fraud */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <span className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Crisis #3</span>
                    <h3 className="text-lg font-bold text-white leading-snug">Reversals & Insider Fraud</h3>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-400 shrink-0">9.8%</span>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed">
                <strong className="text-white">9.8% of mobile money users</strong> have had direct financial losses — higher than any traditional bank. In 2025, Safaricom dismissed <strong className="text-white">113 employees</strong> for internal fraud, proving the threat comes from inside the system too.
              </p>

              {/* Timeline visual */}
              <div className="rounded-xl bg-[#060f1e] border border-white/5 p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Manual reversal timeline (legacy tools)</p>
                <div className="flex items-center gap-1">
                  {['Day 1', 'Day 3', 'Day 7', 'Day 14'].map((d, i) => (
                    <div key={d} className="flex-1 text-center">
                      <div className={`h-2 rounded-full mb-1 ${i === 0 ? 'bg-red-500' : i === 3 ? 'bg-red-900/40' : 'bg-red-700/50'}`} />
                      <span className="text-[9px] text-slate-500">{d}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Manual dispute → 3–14 days with no resolution guarantee</p>
                <p className="text-[10px] text-emerald-400 mt-1">✓ PayChainKE · Blockchain-anchored ledger · Instant audit trail</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <p className="text-[11px] text-slate-600">
                  Source: <a href="https://safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">Safaricom Sustainability 2024</a> · <a href="https://centralbank.go.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">CBK Payments</a>
                </p>
                <span className="text-[10px] text-yellow-400 font-semibold bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">113 staff fired</span>
              </div>
            </motion.div>

            {/* Card 4 — e-TIMS */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Crisis #4</span>
                    <h3 className="text-lg font-bold text-white leading-snug">e-TIMS Compliance Tax</h3>
                  </div>
                </div>
                <span className="text-2xl font-black text-red-400 shrink-0">2× Fine</span>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed">
                From <strong className="text-white">January 1, 2026</strong>, KRA validates every expense via e-TIMS. A KES 500,000 purchase without a valid e-TIMS invoice costs you <strong className="text-white">KES 150,000+ in non-deductible losses</strong>. Most MSMEs are still filing manually and have no idea.
              </p>

              {/* Penalty calculator */}
              <div className="rounded-xl bg-[#060f1e] border border-white/5 p-4 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Penalty impact calculator</p>
                {[
                  { purchase: 'KES 100,000', extra: 'KES 30,000 lost' },
                  { purchase: 'KES 250,000', extra: 'KES 75,000 lost' },
                  { purchase: 'KES 500,000', extra: 'KES 150,000 lost' },
                ].map(({ purchase, extra }) => (
                  <div key={purchase} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Purchase: {purchase}</span>
                    <span className="text-[11px] text-red-400 font-semibold">{extra}</span>
                  </div>
                ))}
                <p className="text-[10px] text-emerald-400 mt-1 border-t border-white/5 pt-2">✓ e-TIMS Native · Every sale auto-submitted to KRA</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <p className="text-[11px] text-slate-600">
                  Source: <a href="https://kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">KRA e-TIMS 2024</a> · <a href="https://treasury.go.ke" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 underline">Finance Act 2025</a>
                </p>
                <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">Active Now</span>
              </div>
            </motion.div>
          </div>

          {/* Solution Section */}
          <div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Text Content */}
              <div>
                <span className="inline-block text-xs font-semibold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-4">
                  The Hybrid Business OS
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  PayChainKE solves all four.
                </h2>
                <p className="text-lg text-slate-400 max-w-3xl">
                  One platform that protects your wealth from inflation with the <strong className="text-white">Inflation Shield</strong>, blocks fraud in under 100ms with <strong className="text-white">Sentinel AI</strong>, automates KRA compliance with <strong className="text-white">e-TIMS Native</strong>, and powers your payroll and supplier payments with <strong className="text-white">Pay-for-Business</strong>.
                </p>
                <p className="text-base text-slate-500 mt-4 max-w-3xl">
                  This isn't a payment processor. It's the operating system your business has been waiting for.
                </p>
              </div>

              {/* Right: Truth Ping Demo */}
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Phone mockup */}
                  <div className="relative w-72 h-[580px] bg-black rounded-[2.5rem] sm:rounded-[3rem] border-2 border-gray-800 p-1 card-shadow shadow-2xl mx-auto lg:mx-0">
                    {/* Dynamic Island */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-3 bg-black rounded-full" />

                    {/* Screen */}
                    <div className="w-full h-full bg-[#0A192F] rounded-[2.5rem] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="p-6 border-b border-white/10">
                        <div className="flex items-center">
                          <span className="font-bold text-white">pay</span><span className="font-bold text-emerald-400">Chain</span><span className="font-bold text-white">KE</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Merchant Terminal</p>
                      </div>

                      {/* Truth Ping */}
                      <div className="flex-1 flex items-center justify-center">
                        <TruthPing isVerified={true} amount={2500} tillNumber="174379" />
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t border-white/10">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>Powered by Base L2</span>
                        </div>
                      </div>
                    </div>

                    {/* Floating badges */}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-16">
              {[
                { icon: <RefreshCw className="w-5 h-5 text-emerald-400" />, label: 'Inflation Shield', desc: 'Auto-converts idle KES float to USDC on Base L2, protecting savings from shilling depreciation 24/7.', kpi: '+20% Preserved', color: 'border-emerald-500/20 bg-emerald-500/5' },
                { icon: <Shield className="w-5 h-5 text-blue-400" />, label: 'Sentinel AI', desc: 'Sub-100ms server-side verification eliminates fake SMS fraud, confirmed directly from Safaricom.', kpi: '<100ms Block', color: 'border-blue-500/20 bg-blue-500/5' },
                { icon: <FileCheck className="w-5 h-5 text-purple-400" />, label: 'e-TIMS Native', desc: 'Every sale triggers an automatic ETR receipt and KRA submission. Stay compliant without lifting a finger.', kpi: 'Zero Penalties', color: 'border-purple-500/20 bg-purple-500/5' },
                { icon: <Users className="w-5 h-5 text-amber-400" />, label: 'Pay-for-Business', desc: 'Bulk payroll, supplier payments, and utility bills — automated in one dashboard. In KES or USDC.', kpi: '1-Click Payouts', color: 'border-amber-500/20 bg-amber-500/5' },
              ].map(({ icon, label, desc, kpi, color }) => (
                <div key={label} className={`rounded-2xl border p-6 flex flex-col gap-3 ${color}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">{icon}</div>
                    <h3 className="text-sm font-bold text-white">{label}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed flex-1">{desc}</p>
                  <div className="text-xl font-black text-white mt-2">{kpi}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;