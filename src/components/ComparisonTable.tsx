import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, Shield, Brain, FileCheck, Users, Zap } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   COMPARISON DATA
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   COMPARISON TABLE
───────────────────────────────────────────────────────────── */
const ComparisonTable: React.FC = () => (
  <section className="py-28 bg-[#0A192F] overflow-hidden">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">

      {/* Header */}
      <motion.div
        variants={fadeUp(0)}
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400 border border-emerald-500/25 mb-5"
          style={{ background: 'rgba(16,185,129,0.08)' }}>
          <Zap className="w-3.5 h-3.5" />
          PayChain vs. Legacy Tools
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
          Why merchants are{' '}
          <span style={{
            background: 'linear-gradient(90deg, #10B981, #34d399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            switching.
          </span>
        </h2>
        <p className="text-white/45 text-base">
          Legacy payment processors were built for a different era. PayChain is built for 2026 — and beyond.
        </p>
      </motion.div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        {/* Column headers */}
        <motion.div
          variants={fadeUp(0.1)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="grid grid-cols-3 gap-4 mb-4 px-2"
        >
          <div /> {/* empty label col */}
          <div className="rounded-2xl px-6 py-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-bold text-white/50">Legacy Processors</p>
            <p className="text-xs text-white/25 mt-0.5">Kopo Kopo · Till Numbers · Manual tools</p>
          </div>
          <div className="rounded-2xl px-6 py-4 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)' }}>
            <p className="text-sm font-bold text-emerald-400">PayChain OS</p>
            <p className="text-xs text-emerald-400/60 mt-0.5">Hybrid · Blockchain · AI-native</p>
          </div>
        </motion.div>

        {/* Rows */}
        <div className="space-y-3">
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <motion.div
                key={row.category}
                variants={fadeUp(0.15 + i * 0.08)}
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
                className="grid grid-cols-3 gap-4 rounded-2xl overflow-hidden"
              >
                {/* Category label */}
                <div className="flex items-center gap-3 px-4 py-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-white/80">{row.category}</p>
                </div>

                {/* Legacy */}
                <div className="flex flex-col justify-center px-6 py-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-red-300/80">{row.legacy.label}</p>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed pl-6">{row.legacy.detail}</p>
                </div>

                {/* PayChain */}
                <div className="flex flex-col justify-center px-6 py-5 rounded-2xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-emerald-300">{row.paychain.label}</p>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed pl-6 mb-2">{row.paychain.detail}</p>
                  <span className="ml-6 inline-flex w-fit px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-wider"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    {row.paychain.highlight}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Card stack */}
      <div className="md:hidden space-y-6">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.category}
              variants={fadeUp(0.1 + i * 0.08)}
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Category header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <Icon className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">{row.category}</p>
              </div>

              {/* Legacy */}
              <div className="px-5 py-4 border-b" style={{ background: 'rgba(239,68,68,0.03)', borderColor: 'rgba(239,68,68,0.1)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Legacy</p>
                </div>
                <p className="text-sm font-semibold text-red-300/80 mb-1">{row.legacy.label}</p>
                <p className="text-xs text-white/30">{row.legacy.detail}</p>
              </div>

              {/* PayChain */}
              <div className="px-5 py-4" style={{ background: 'rgba(16,185,129,0.05)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">PayChain OS</p>
                </div>
                <p className="text-sm font-semibold text-emerald-300 mb-1">{row.paychain.label}</p>
                <p className="text-xs text-white/40 mb-2">{row.paychain.detail}</p>
                <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-wider"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {row.paychain.highlight}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <motion.div
        variants={fadeUp(0.5)}
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="text-center mt-14"
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => window.open('https://forms.gle/eJQVeiSGioHN4t6s7', '_blank')}
          className="px-8 py-4 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
        >
          Start for Free — No Credit Card Required
        </motion.button>
        <p className="text-xs text-white/25 mt-3">VASP 2025 Registered · KRA e-TIMS Certified · Equity Bank Partner</p>
      </motion.div>
    </div>
  </section>
);

export default ComparisonTable;
