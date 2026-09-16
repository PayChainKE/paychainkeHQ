import React, { useState } from 'react';
import Seo from '@/components/Seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Zap,
  RefreshCw,
  Database,
  Eye,
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  Landmark,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

const features = [
  { title: 'Based on Your Sales, Not Paperwork', icon: Database, desc: 'How much you can borrow is worked out from your real PayChain payment history. You don\'t need land, property, a guarantor, or a good CRB record.' },
  { title: 'You See the Full Cost Upfront', icon: Eye, desc: 'Before you accept, you see exactly how much you get, the one-time fee, and how repayment works. No surprises later.' },
  { title: 'You Pay Back a Little as You Sell', icon: RefreshCw, desc: 'Repayment is taken automatically as a small % of what you collect each day. A slower day means a smaller repayment — no fixed amount to worry about.' },
  { title: 'Money Arrives Instantly', icon: Zap, desc: 'The moment you accept, the money is in your PayChain balance. Use it for Bulk Pay, paying suppliers, or withdraw to M-PESA.' },
  { title: 'Grows with Your Business', icon: TrendingUp, desc: 'Pay back your first advance and your next one comes faster, for a bigger amount, on better terms.' },
  { title: 'No Hidden Charges', icon: ShieldCheck, desc: 'One clear one-time fee plus a share of what you sell — that\'s the whole cost. No late fees, no penalties, no extra charges for paying early.' },
];

const timeline = [
  { title: 'Transact Through PayChain (Months 1 to 3)', desc: 'Every verified collection through your PayChain Virtual Account builds your merchant ledger, a tamper-proof record of your real business activity.' },
  { title: 'Your Trust Score Builds Automatically', desc: "PayChain's Trust Score algorithm analyzes your revenue consistency, transaction frequency, and growth trajectory. Watch it build in real time on your dashboard. No action required." },
  { title: 'You Receive a Cash Advance Offer', desc: 'At month 3, if you qualify, PayChain shows you an offer on your dashboard: how much you get, how you pay it back, the one-time fee, and the total cost. All visible before you say yes.' },
  { title: 'Accept and Receive Funds', desc: 'Accept your offer. Funds arrive in your PayChain merchant balance immediately, ready for Bulk Pay, supplier payments, or M-PESA withdrawal. No 3 to 5 day bank delays.' },
  { title: 'Repay as You Earn', desc: 'Repayment is a fixed percentage of your daily PayChain collections: automatic, no manual transfers. Strong month = repay faster. Slow week = smaller repayment. Works with your cash flow, not against it.' },
];

const comparisonRows = [
  ['Who can get it', 'Title deed + audited accounts', 'Savings + membership', '3 months of PayChain sales'],
  ['Applying', 'Weeks of paperwork', '1 to 2 weeks', 'Automatic offer on your dashboard'],
  ['When money arrives', 'Days to weeks', 'Days', 'Instantly'],
  ['Paying it back', 'Fixed amount every month', 'Fixed amount every month', 'A % of what you sell each day'],
  ['Land or property needed', 'Yes', 'Yes', 'No'],
  ['Credit history needed', 'Yes', 'Partly', 'No'],
  ['Penalty for a slow month', 'Yes', 'Yes', 'No (adjusts automatically)'],
  ['Helps you next time', 'Bank only', 'SACCO only', 'Builds your Trust Score'],
];

const useCases = [
  { title: 'Retail & Hospitality', desc: "Stock up before peak season without draining operational cash. Repay as the season's revenue comes in." },
  { title: 'Import & Export Traders', desc: 'Bridge the gap between placing an international order and receiving inventory. Cover deposits, freight, and customs, repay as stock sells.' },
  { title: 'Service Agencies', desc: 'Take on larger contracts than current cash flow allows. Cover upfront costs, repay from the contract revenue.' },
  { title: 'Any Cash Flow Gap', desc: "Delayed payment. Unexpected equipment. Seasonal trough before a peak. PayChain Cash Advance is for the moments that matter." },
];

const faqs = [
  { q: 'How much can I borrow?', a: 'Your limit is calculated from your verified transaction history. Higher, more consistent revenue through PayChain = higher limit. Limits grow with each successfully repaid advance.' },
  { q: 'What does it cost?', a: 'One clear one-time fee, plus a small share of what you sell each day until it\'s repaid. The full cost is shown before you accept — no hidden fees, no extra interest.' },
  { q: 'What if my business has a slow month?', a: 'Repayments are a fixed % of your actual daily collections. Slow month = smaller repayment. No missed payment penalties for normal revenue variation.' },
  { q: 'Can I get a second advance before repaying the first?', a: 'Once a significant portion is repaid, PayChain may present a top-up offer. Full second advances are available after full repayment.' },
  { q: 'Does this affect my credit record?', a: 'No. PayChain looks only at your own Trust Score — built from your activity on PayChain. It has nothing to do with CRB or any bank\'s credit record.' },
  { q: 'Can I repay early?', a: 'Yes, with no penalty. Early repayment strengthens your Trust Score faster and accelerates your next offer.' },
];

function TrustScoreRing() {
  const [played, setPlayed] = useState(false);
  const target = 78;
  const circumference = 2 * Math.PI * 15.9155;
  return (
    <motion.div
      className="relative w-40 h-40 mx-auto"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      onViewportEnter={() => setPlayed(true)}
      transition={{ duration: 0.5 }}
    >
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5"
        />
        <motion.path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="#00bf63" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: played ? circumference * (1 - target / 100) : circumference }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Trust Score</span>
        <span className="text-3xl font-extrabold text-white">{target}%</span>
      </div>
    </motion.div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left px-6 py-5 focus:outline-none"
      >
        <span className="font-bold text-gray-900">{q}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
      >
        <p className="px-6 pb-5 text-gray-600 leading-relaxed">{a}</p>
      </motion.div>
    </div>
  );
}

const CashAdvance: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Cash Advance | Get Money for Your Business Fast | PayChain"
        description="Get money for your business based on your real PayChain sales — no land, property, or guarantors needed. Money arrives instantly, and you pay back a little as you sell, with no hidden fees."
        path="/products/cash-advance"
      />
      <Navbar />

      {/* Breadcrumb strip */}
      <div className="pt-24 pb-2 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <Breadcrumbs currentPage="Cash Advance" />
        </div>
      </div>

      {/* HERO */}
      <section className="relative pb-20 lg:pb-28 overflow-hidden bg-[#0a0a0a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-[#00bf63]/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00bf63] animate-pulse" />
                <span className="text-sm font-medium text-gray-200">Unlocks after 3 months of verified transactions</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
                Your Sales History <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00bf63] to-emerald-300">Is All You Need.</span>
              </h1>
              <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                PayChain Cash Advance gives Kenyan merchants money for their business based on how they actually sell, not land titles, not guarantors, not who you know at the bank. Just the truth of how your business moves money.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {['No land or property needed', 'No credit history needed', 'No bank queues'].map((pill) => (
                  <span key={pill} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-gray-200">
                    <Check className="w-3.5 h-3.5 text-[#00bf63]" /> {pill}
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="https://app.paychain.co.ke" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
                  Sign Up
                </a>
              </div>
              <p className="text-sm text-gray-500 mt-4">Free to sign up · Get started in minutes</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="h-32 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 mb-6" />
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="bg-white rounded-xl p-5 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Cash Advance Offer</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">Ready</span>
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900 mb-1">Ksh 150,000.00</div>
                  <div className="text-sm text-gray-500 mb-4">Repayment: 6% of daily collections</div>
                  <button className="w-full bg-[#0a0a0a] text-white text-sm font-bold py-3 rounded-lg">Accept Offer</button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 mb-6">
              <Landmark className="w-6 h-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Kenya's Banks Were Not Built for Kenya's Merchants.</h2>
            <blockquote className="text-xl italic font-semibold text-gray-700 mb-8 leading-relaxed">
              "The bank asked for a title deed. You left empty-handed, not because your business isn't real, but because their system was never designed to see it."
            </blockquote>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              Every Kenyan small business owner knows this story. Business is good. Orders are coming in. You have the customers, the suppliers, the reputation, but not the cash right now to fulfill the opportunity in front of you.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              So you go to the bank. They ask for a title deed. A guarantor. Three years of audited accounts. You leave empty-handed. You go to a SACCO. The rates are punishing. You borrow from family. It works until it doesn't. Meanwhile, the opportunity is gone.
            </p>
            <p className="text-lg font-bold text-gray-900">PayChain Cash Advance was built for the moment between the opportunity and the cash.</p>
          </motion.div>
        </div>
      </section>

      {/* EXPLAINER */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">Money That Understands Your Business.</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                PayChain Cash Advance is built right into your dashboard. After 3 months of using your PayChain Virtual Account, your business automatically qualifies, and how much you can get is based entirely on your own real sales. No forms to fill in. No one valuing your land or property. No committee deciding your fate behind closed doors. Just your own sales history, a clear offer, and money in your account.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-sm text-gray-500">Approved limit</div>
                  <div className="text-2xl font-bold text-gray-900">Ksh 150,000.00</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Repayment</div>
                  <div className="font-semibold text-gray-900">6% daily</div>
                </div>
              </div>
              <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">One-time fee: Ksh 4,500.00</div>
              <button className="w-full bg-[#00bf63] text-black font-bold py-3 rounded-lg">Accept</button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            From Your First Sale to Money in Your Account, in 5 Steps
          </motion.h3>
          <div className="max-w-3xl mx-auto space-y-8">
            {timeline.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex gap-5"
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#00bf63] text-black flex items-center justify-center font-extrabold shadow-[0_0_20px_rgba(0,191,99,0.25)]">
                  {i + 1}
                </div>
                <div className="pb-2">
                  <h4 className="font-bold text-gray-900 mb-1.5">{step.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST SCORE */}
      <section className="py-20 bg-[#0a0a0a] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00bf63]/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-3 gap-12 items-center max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:col-span-2">
              <h3 className="text-3xl font-bold mb-8">Money Trust, Built on the Truth of Your Sales.</h3>
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-[#00bf63] mb-4">What builds your Trust Score</h4>
                  <ul className="space-y-3">
                    {['How much money you collect overall', 'How regularly customers pay you', 'Whether your sales are growing or steady', 'How much your average customer payment is', 'How long you\'ve been using PayChain', 'Whether you\'ve repaid past advances on time'].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed">
                        <Check className="w-4 h-4 text-[#00bf63] mt-0.5 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">What doesn't affect your score</h4>
                  <ul className="space-y-3">
                    {['Your personal credit history', 'Whether you own property', 'Your bank account balance', 'Your education or employment', 'Your relationship with any bank'].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-400 leading-relaxed">
                        <X className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <TrustScoreRing />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">A Cash Advance Built the Way Business Actually Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Why PayChain Cash Advance Wins
          </motion.h3>
          <div className="max-w-5xl mx-auto overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400"></th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">Bank Loan</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">SACCO Loan</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-[#00a857] bg-emerald-50/60">PayChain Cash Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map(([label, bank, sacco, paychain]) => (
                  <tr key={label}>
                    <td className="py-4 px-5 font-semibold text-gray-800">{label}</td>
                    <td className="py-4 px-5 text-gray-500">{bank}</td>
                    <td className="py-4 px-5 text-gray-500">{sacco}</td>
                    <td className="py-4 px-5 font-semibold text-[#00a857] bg-emerald-50/60">{paychain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Built for the Moment Between the Opportunity and the Cash
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex gap-4"
              >
                <div className="w-2 h-12 bg-[#00bf63] rounded-full flex-shrink-0" />
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{uc.title}</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{uc.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ELIGIBILITY */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
              <h4 className="font-bold text-gray-900 mb-4">You're on track if:</h4>
              <ul className="space-y-2.5 text-sm">
                {['Active PayChain Virtual Account for 3+ months', 'Trust Score at or above eligibility threshold', 'KYC-verified merchant account in Kenya', 'No defaulted PayChain advance'].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-gray-700">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <h4 className="font-bold text-gray-900 mb-4">Not yet eligible if:</h4>
              <ul className="space-y-2.5 text-sm">
                {['Joined PayChain less than 3 months ago', 'Trust Score below current threshold'].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-gray-700">
                    <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
          <p className="text-center text-lg font-medium text-gray-700">Every merchant who joins PayChain today is 3 months away from their first offer. The clock starts with your first payment.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8 max-w-3xl">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl font-bold text-gray-900 mb-10 text-center">
            Questions We Get Asked About Cash Advance
          </motion.h3>
          <div className="space-y-4">
            {faqs.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-[#0a0a0a] to-gray-900 rounded-3xl p-12 text-center max-w-4xl mx-auto border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00bf63]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">The Sooner You Start Selling on PayChain, the Sooner You Get Your First Advance.</h2>
            <p className="text-xl text-gray-400 mb-10 relative z-10">Every payment you collect through PayChain brings you closer to your first Cash Advance offer.</p>
            <div className="relative z-10">
              <a href="https://app.paychain.co.ke" className="inline-flex px-8 py-4 text-lg font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(0,191,99,0.3)]">
                Sign Up
              </a>
              <p className="text-sm text-gray-500 mt-4">No land or property needed · No bank queue</p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CashAdvance;
