import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, Shield, Brain, FileCheck, Users, Zap } from 'lucide-react';

const rows = [
  {
    icon: Shield,
    category: 'Inflation Protection',
    legacy: {
      label: 'No protection',
      detail: 'KES loses ~6% of value every year. Savings erode silently.',
      bad: true,
    },
    paychain: {
      label: 'Inflation Shield',
      detail: 'Auto-swap KES surplus → USDC on every transaction. Wealth preserved.',
      highlight: 'Auto-swap to USDC',
    },
  },
  {
    icon: Brain,
    category: 'Fraud Prevention',
    legacy: {
      label: 'Fake SMS scams',
      detail: 'Merchants lose thousands to fake M-PESA confirmation screenshots.',
      bad: true,
    },
    paychain: {
      label: 'Sentinel AI',
      detail: 'Real-time neural verification in under 100ms. Zero fake-SMS fraud.',
      highlight: '<100ms Server Verification',
    },
  },
  {
    icon: FileCheck,
    category: 'Tax Compliance',
    legacy: {
      label: 'Manual KRA filings',
      detail: 'Hours spent every month. Missed deadlines. Fines and penalties.',
      bad: true,
    },
    paychain: {
      label: 'e-TIMS Native',
      detail: 'Every sale auto-generates and submits a KRA-compliant ETR instantly.',
      highlight: 'Automated ETR reporting',
    },
  },
  {
    icon: Users,
    category: 'Business Payouts',
    legacy: {
      label: 'Manual & slow',
      detail: 'One-by-one transfers, NHIF/NSSF headaches, no payroll history.',
      bad: true,
    },
    paychain: {
      label: 'Pay-for-Business',
      detail: 'Bulk automated payroll with PAYE deductions. Pay 50 staff in one click.',
      highlight: 'Bulk automated payouts',
    },
  },
];

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

const ComparisonTable: React.FC = () => (
  <section className="py-28 bg-[#0A192F] overflow-hidden">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
        <motion.div
          variants={fadeUp(0)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            The Future of Payments
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Why merchants are switching to{' '}
            <span style={{
              background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              PayChain
            </span>
            .
          </h2>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-8 max-w-xl">
            Legacy payment processors were built for a different era. PayChain is built for 2026 and beyond — faster, compliant, and resilient to real-world risks.
          </p>
          <div className="flex items-center gap-6 text-sm font-medium text-white/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>99.99% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Instant Settlements</span>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          variants={fadeUp(0.2)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl blur opacity-20" />
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0A192F]">
            <img 
              src="/merchant-dashboard.png" 
              alt="Modern Merchant Dashboard" 
              className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F] via-transparent to-transparent opacity-60" />
          </div>
        </motion.div>
      </div>

      <div className="hidden md:block relative z-10">
        <motion.div
          variants={fadeUp(0.1)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="grid grid-cols-3 gap-6 mb-6 px-2"
        >
          <div />
          <div className="rounded-2xl px-6 py-5 text-center bg-white/5 border border-white/10 backdrop-blur-sm">
            <p className="text-base font-bold text-white/50 tracking-wide uppercase">Legacy Processors</p>
            <p className="text-sm text-white/30 mt-1">Kopo Kopo · Till Numbers · Manual tools</p>
          </div>
          <div className="relative rounded-2xl px-6 py-5 text-center bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 backdrop-blur-sm shadow-[0_0_30px_rgba(16,185,129,0.15)] overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full" />
            <p className="relative z-10 text-base font-extrabold text-emerald-400 tracking-wide uppercase">PayChain OS</p>
            <p className="relative z-10 text-sm text-emerald-400/70 mt-1">Hybrid · Blockchain · AI-native</p>
          </div>
        </motion.div>

        <div className="space-y-4">
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <motion.div
                key={row.category}
                variants={fadeUp(0.15 + i * 0.08)}
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
                className="grid grid-cols-3 gap-6 rounded-3xl overflow-hidden group"
              >
                <div className="flex items-center gap-4 px-6 py-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] group-hover:bg-white/[0.04] transition-colors duration-300">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{row.category}</p>
                  </div>
                </div>

                <div className="flex flex-col justify-center px-8 py-6 rounded-2xl bg-red-500/[0.02] border border-red-500/10 group-hover:bg-red-500/[0.04] transition-colors duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-base font-semibold text-red-300">{row.legacy.label}</p>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed pl-9">{row.legacy.detail}</p>
                </div>

                <div className="relative flex flex-col justify-center px-8 py-6 rounded-2xl bg-gradient-to-br from-emerald-500/[0.05] to-cyan-500/[0.02] border border-emerald-500/20 shadow-lg group-hover:border-emerald-500/40 group-hover:shadow-emerald-500/10 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-base font-bold text-white">{row.paychain.label}</p>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed pl-9 mb-4">{row.paychain.detail}</p>
                    <div className="pl-9">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        {row.paychain.highlight}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden space-y-8 relative z-10">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.category}
              variants={fadeUp(0.1 + i * 0.08)}
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              className="rounded-3xl overflow-hidden bg-[#0A192F] border border-white/10 shadow-2xl relative"
            >
              <div className="absolute -inset-1 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              
              <div className="relative flex items-center gap-4 px-6 py-5 bg-white/5 border-b border-white/10 backdrop-blur-md">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-white">{row.category}</p>
              </div>

              <div className="relative px-6 py-5 bg-red-500/[0.02] border-b border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Legacy</p>
                </div>
                <p className="text-base font-semibold text-red-300/90 mb-1 pl-7">{row.legacy.label}</p>
                <p className="text-sm text-white/40 pl-7">{row.legacy.detail}</p>
              </div>

              <div className="relative px-6 py-6 bg-gradient-to-br from-emerald-500/[0.08] to-cyan-500/[0.02]">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-wider">PayChain OS</p>
                </div>
                <p className="text-base font-bold text-emerald-300 mb-2 pl-7">{row.paychain.label}</p>
                <p className="text-sm text-white/70 mb-4 pl-7">{row.paychain.detail}</p>
                <div className="pl-7">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    {row.paychain.highlight}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
