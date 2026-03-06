import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, FileCheck, Users, Zap, CheckCircle2, RefreshCw,
  Lightbulb, Droplets, BarChart3, CreditCard, ArrowUpRight
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   ANIMATION HELPERS
───────────────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

/* ─────────────────────────────────────────────────────────────
   CARD 1 — ACCEPT PAYMENTS ANYWHERE
   Visual: M-PESA + USDC on Base logos with method pills
───────────────────────────────────────────────────────────── */
const AcceptCard: React.FC = () => {
  const methods = [
    { label: 'Lipa na M-PESA', color: '#4caf50', bg: 'rgba(76,175,80,0.1)', border: 'rgba(76,175,80,0.25)', emoji: '📱' },
    { label: 'USDC on Base', color: '#2775CA', bg: 'rgba(39,117,202,0.1)', border: 'rgba(39,117,202,0.25)', emoji: '🔵' },
    { label: 'Bank Transfer', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', emoji: '🏦' },
    { label: 'Card (Visa/MC)', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', emoji: '💳' },
  ];

  return (
    <motion.div
      variants={fadeUp(0)}
      initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="rounded-2xl p-7 border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-shadow col-span-2 md:col-span-1"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(16,185,129,0.1)' }}>
        <CreditCard className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 mb-3 uppercase tracking-widest">
        Accept
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Accept Payments Anywhere.</h3>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">
        One checkout. Every Kenyan payment method plus global Web3 liquidity — all verified on-chain in under 100ms.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {methods.map((m) => (
          <div key={m.label} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium"
            style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}>
            <span>{m.emoji}</span>
            <span className="truncate">{m.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CARD 2 — INFLATION SHIELD (dark, spans taller)
   Visual: Animated KES → USDC toggle swap
───────────────────────────────────────────────────────────── */
const ProtectCard: React.FC = () => {
  const [on, setOn] = useState(true);
  const [swapping, setSwapping] = useState(false);

  const toggle = () => {
    setSwapping(true);
    setTimeout(() => { setOn(v => !v); setSwapping(false); }, 650);
  };

  return (
    <motion.div
      variants={fadeUp(0.1)}
      initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="rounded-2xl p-7 border border-white/8 text-white shadow-sm hover:shadow-2xl transition-shadow col-span-2 md:col-span-1 flex flex-col"
      style={{ background: 'linear-gradient(140deg, #0A192F 0%, #0d2543 100%)' }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(16,185,129,0.15)' }}>
        <Shield className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/25 mb-3 uppercase tracking-widest w-fit"
        style={{ background: 'rgba(16,185,129,0.08)' }}>
        Protect
      </div>
      <h3 className="text-xl font-bold text-white mb-2">The Inflation Shield.</h3>
      <p className="text-sm text-white/55 mb-6 leading-relaxed">
        KES loses ~6% annually to inflation. PayChain auto-swaps your surplus into USDC so your savings hold their value.
      </p>

      {/* Toggle Visual */}
      <div className="mt-auto rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all cursor-pointer"
          style={{
            background: on ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
            border: on ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <Shield className={`w-4 h-4 ${on ? 'text-emerald-400' : 'text-white/25'}`} />
            <span className="text-sm font-semibold text-white">Inflation Shield</span>
          </div>
          <div className={`relative w-10 h-5.5 rounded-full transition-colors duration-300 ${on ? 'bg-emerald-500' : 'bg-white/15'}`}
            style={{ height: '22px', width: '42px' }}>
            <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300 ${on ? 'left-[22px]' : 'left-0.5'}`} />
          </div>
        </button>

        {/* Swap animation */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-white/35 mb-0.5">KES</p>
            <p className={`text-base font-bold transition-all duration-400 ${on && !swapping ? 'text-white/40' : 'text-white'}`}>
              {swapping ? '...' : on ? '↓ 0%' : '623,450'}
            </p>
          </div>
          <motion.div
            animate={{ rotate: swapping ? 180 : 0 }}
            transition={{ duration: 0.5 }}
          >
            <RefreshCw className={`w-4 h-4 ${on ? 'text-emerald-400' : 'text-white/20'}`} />
          </motion.div>
          <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: on ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-emerald-400/60 mb-0.5">USDC</p>
            <p className={`text-base font-bold ${on ? 'text-emerald-400' : 'text-white/40'}`}>
              {swapping ? '...' : on ? '$4,821' : '—'}
            </p>
          </div>
        </div>

        {on && !swapping && (
          <p className="text-[11px] text-emerald-400/70 px-2">
            ✓ Saved KES 4,500 from inflation today
          </p>
        )}
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CARD 3 — BULK PAY & UTILITIES
   Visual: Clean UI for KPLC / Water / Payroll
───────────────────────────────────────────────────────────── */
const SpendCard: React.FC = () => {
  const bills = [
    { icon: Lightbulb, label: 'KPLC Electricity', amount: 'KES 4,200', color: 'text-yellow-600 bg-yellow-50' },
    { icon: Droplets, label: 'Nairobi Water', amount: 'KES 1,800', color: 'text-blue-600 bg-blue-50' },
    { icon: Users, label: 'Staff Salaries × 12', amount: 'KES 186,000', color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <motion.div
      variants={fadeUp(0.15)}
      initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="rounded-2xl p-7 border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-shadow col-span-2 md:col-span-1"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-purple-50">
        <Users className="w-5 h-5 text-purple-600" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 mb-3 uppercase tracking-widest">
        Spend
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Bulk Pay &amp; Utilities.</h3>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">
        One-click batch payments for KPLC, Water, and your entire payroll. PAYE auto-calculated. M-Pesa or bank.
      </p>
      <div className="space-y-2">
        {bills.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className="flex items-center justify-between rounded-xl px-3 py-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${b.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-800">{b.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{b.amount}</span>
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
        Pay All Now <ArrowUpRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CARD 4 — e-TIMS NATIVE
   Visual: Verified badge + KRA invoice animation
───────────────────────────────────────────────────────────── */
const ComplyCard: React.FC = () => {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVerified(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const steps = ['Sale Recorded', 'ETR Generated', 'KRA Submitted', 'Receipt Issued'];

  return (
    <motion.div
      variants={fadeUp(0.2)}
      initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="rounded-2xl p-7 border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-shadow col-span-2 md:col-span-1"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-emerald-50">
        <FileCheck className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 mb-3 uppercase tracking-widest">
        Comply
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">e-TIMS Native.</h3>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">
        KRA compliance auto-filed on every transaction. No manual ETRs. No penalties. Your audit trail is permanent.
      </p>

      {/* KRA pipeline */}
      <div className="space-y-2 mb-4">
        {steps.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${verified ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <div className={`w-2 h-2 rounded-full transition-colors ${verified ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            </div>
            <div className="flex-1 h-px" style={{ background: verified ? 'rgba(16,185,129,0.2)' : '#f1f5f9' }} />
            <span className={`text-xs font-medium transition-colors ${verified ? 'text-emerald-700' : 'text-gray-400'}`}>{step}</span>
          </motion.div>
        ))}
      </div>

      {/* Verified stamp */}
      <AnimatePresence>
        {verified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}
          >
            {/* Sentinel pulse ring */}
            <div className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <CheckCircle2 className="relative w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800">KRA e-TIMS · Invoice Verified</p>
              <p className="text-[10px] text-emerald-600/70">Ref: ETR-2026-88219 · Submitted 0.9s ago</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────
   METRICS BANNER
───────────────────────────────────────────────────────────── */
const MetricBanner: React.FC = () => (
  <motion.div
    variants={fadeUp(0)}
    initial="hidden" whileInView="visible" viewport={{ once: true }}
    className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-gray-100 mb-12"
    style={{ background: '#e2e8f0' }}
  >
    {[
      { value: '30K+', label: 'Active Merchants' },
      { value: 'KES 1.6T', label: 'Fraud Prevented' },
      { value: '125M', label: 'African MSMEs' },
      { value: '<100ms', label: 'Avg. Response' },
    ].map(({ value, label }) => (
      <div key={label} className="bg-white px-6 py-5 text-center">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{label}</p>
      </div>
    ))}
  </motion.div>
);

/* ─────────────────────────────────────────────────────────────
   FEATURES SECTION — 4-Card Bento Grid (2026 Layout)
───────────────────────────────────────────────────────────── */
const Features: React.FC = () => (
  <section className="py-28 bg-[#F8FAFC]">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section header */}
      <motion.div
        variants={fadeUp(0)}
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-14"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 mb-5">
          <BarChart3 className="w-3.5 h-3.5" />
          Signature Features · v2.0
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          One OS.{' '}
          <span style={{
            background: 'linear-gradient(90deg, #0A192F, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Four superpowers.
          </span>
        </h2>
        <p className="text-gray-500 text-base leading-relaxed">
          Accept, protect, spend, and comply — all under one roof, built for Kenya's hybrid merchant economy.
        </p>
      </motion.div>

      <MetricBanner />

      {/* 2×2 Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
        <AcceptCard />
        <ProtectCard />
        <SpendCard />
        <ComplyCard />
      </div>
    </div>
  </section>
);

export default Features;
