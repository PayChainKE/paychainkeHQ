import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Activity,
  Database,
  Building2,
  GitMerge,
  TrendingUp,
  Check,
  Store,
  Send,
  Smartphone,
  FileText,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

const waysToGetPaid = [
  { title: 'Paybill & Virtual Account', icon: Store, desc: 'Your own dedicated PayChain Paybill and virtual account number, customers pay it exactly like any M-PESA till or Paybill, in person or at checkout.' },
  { title: 'Payment Links', icon: Send, desc: 'Send a payment link to any customer (even over WhatsApp) for e-commerce, delivery orders, or one-off sales. Money settles instantly the moment they pay.' },
  { title: 'STK Push', icon: Smartphone, desc: 'Prompt a customer to pay directly: send an M-PESA STK push straight to their phone and get paid the moment they enter their PIN. No till number to read out.' },
  { title: 'Professional Invoicing', icon: FileText, desc: 'Create and send professional invoices to customers, with a payable link built in. Track Draft, Sent, and Paid status right from your dashboard.' },
];

const features = [
  { title: 'Verified Inbound Payments', icon: ShieldCheck, desc: 'Every payment verified through our NCBA Bank integration before confirmation. Fake screenshots are impossible.' },
  { title: 'Real-Time Dashboard Confirmation', icon: Activity, desc: 'The moment a customer pays, it appears on your dashboard with amount, timestamp, phone number, and reference.' },
  { title: 'Immutable Transaction Ledger', icon: Database, desc: 'Every payment logged on blockchain rails, a permanent, tamper-proof record that builds your Trust Score.' },
  { title: 'Aggregator-Backed Virtual Account', icon: Building2, desc: 'Registered through a licensed payment aggregator, institutional credibility behind every transaction.' },
  { title: 'Hybrid M-PESA + Blockchain Rails', icon: GitMerge, desc: 'M-PESA reach. Blockchain security. You get both without needing to understand either.' },
  { title: 'Automatic Trust Score Building', icon: TrendingUp, desc: 'Every verified collection builds your credit profile. 3 months unlocks your Cash Advance eligibility.' },
];

const steps = [
  { title: 'Get Verified', desc: 'Complete KYC and receive your dedicated PayChain Virtual Account, backed by a licensed aggregator.' },
  { title: 'Share & Collect', desc: 'Customers pay via M-PESA as normal. You see confirmed payment on your dashboard instantly, no SMS needed.' },
  { title: 'Build & Grow', desc: 'Every transaction builds your Trust Score and working capital eligibility automatically.' },
];

const comparisonRows = [
  ['Payment verification', 'SMS confirmation', 'NCBA Bank integration + blockchain'],
  ['Fraud protection', 'None', 'Real-time fraud elimination'],
  ['Transaction records', 'SMS inbox', 'Immutable digital ledger'],
  ['Business credit building', 'No', 'Yes (automatic Trust Score)'],
  ['Dashboard visibility', 'No', 'Real-time, full history'],
  ['Regulatory backing', 'Basic', 'Licensed aggregator'],
];

const VirtualAccount: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Breadcrumb strip */}
      <div className="pt-24 pb-2 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <Breadcrumbs currentPage="PayChain Virtual Account" />
        </div>
      </div>

      {/* HERO */}
      <section className="relative pb-20 lg:pb-28 overflow-hidden bg-[#0a0a0a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-[#00bf63]/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00bf63] animate-pulse" />
                <span className="text-sm font-medium text-gray-200">Verified. Secured. Intelligent.</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
                Your Paybill. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00bf63] to-emerald-300">Verified.</span>
              </h1>
              <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                Every PayChain merchant gets a dedicated PayChain Paybill and virtual account, a registered, aggregator-backed payment channel that replaces your basic M-PESA till, kills SMS fraud, logs every shilling, and builds your business credit automatically.
              </p>
              <a href="https://app.paychain.co.ke" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
                Get Your Paybill & Account
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Incoming Payment</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full">Verified</span>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="bg-white rounded-xl p-5 shadow-xl mb-4"
                >
                  <div className="text-2xl font-extrabold text-gray-900 mb-1">+ Ksh 4,500.00</div>
                  <div className="text-xs text-gray-500">From Aisha N. · Ref QGH7X9K2M</div>
                </motion.div>
                <div className="space-y-2">
                  {[
                    { label: 'M-PESA verified', ok: true },
                    { label: 'On-chain record', ok: true },
                    { label: 'Trust Score updated', ok: true },
                  ].map((row, i) => (
                    <motion.div
                      key={row.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.7 + i * 0.15 }}
                      className="flex items-center gap-2.5 text-sm text-gray-300"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                      </span>
                      {row.label}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">The SMS Till Is Broken. And Fraudsters Know It.</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Every day, Kenyan merchants lose money to one of the oldest tricks in the book: a fake M-PESA confirmation SMS. A customer shows a screenshot. You believe it. The money was never sent. Basic M-PESA tills were never designed to protect you. They were designed to move money. Your PayChain Paybill and Virtual Account were designed to do both.
            </p>
          </motion.div>
        </div>
      </section>

      {/* WAYS TO GET PAID */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
            One Account. Every Way to Get Paid.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-lg text-gray-600 leading-relaxed text-center max-w-2xl mx-auto mb-12">
            Every collection method below settles into the same Paybill and virtual account, verified instantly, no matter how the customer pays.
          </motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {waysToGetPaid.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-[#00bf63]/30 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:bg-[#00bf63] transition-colors duration-300">
                    <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* EXPLAINER + STEPS */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">One Account. Two Rails. Zero Fraud.</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                The PayChain Virtual Account operates across both M-PESA infrastructure and blockchain rails simultaneously, giving you the familiarity of M-PESA with the security of blockchain confirmation. Every inbound payment is confirmed through our NCBA Bank integration in real time, logged on-chain for a tamper-proof record, instantly visible on your dashboard, and automatically added to your Trust Score.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
              <h4 className="text-xl font-bold text-gray-900 mb-6">How it Works</h4>
              <div className="space-y-6">
                {steps.map((step, i) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#00bf63]/10 flex items-center justify-center text-[#00a857] font-bold">{i + 1}</div>
                    <div>
                      <h5 className="font-bold text-gray-900 mb-1">{step.title}</h5>
                      <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Everything Your Account Should Have Always Done
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-[#00bf63]/30 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:bg-[#00bf63] transition-colors duration-300">
                    <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            PayChain Virtual Account vs Basic M-PESA Till
          </motion.h2>
          <div className="max-w-4xl mx-auto overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">Feature</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">Basic M-PESA Till</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-[#00a857] bg-emerald-50/60">PayChain Virtual Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map(([label, basic, paychain]) => (
                  <tr key={label}>
                    <td className="py-4 px-5 font-semibold text-gray-800">{label}</td>
                    <td className="py-4 px-5 text-gray-500">{basic}</td>
                    <td className="py-4 px-5 font-semibold text-[#00a857] bg-emerald-50/60">{paychain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-[#0a0a0a] to-gray-900 rounded-3xl p-12 text-center max-w-4xl mx-auto border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00bf63]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">Stop Trusting Screenshots. Start Running a Verified Business.</h2>
            <p className="text-xl text-gray-400 mb-10 relative z-10">Sign up in minutes and start running a verified business today.</p>
            <div className="relative z-10">
              <a href="https://app.paychain.co.ke" className="inline-flex px-8 py-4 text-lg font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(0,191,99,0.3)]">
                Sign Up
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VirtualAccount;
