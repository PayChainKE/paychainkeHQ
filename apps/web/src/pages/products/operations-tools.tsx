import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileCheck,
  TrendingUp,
  Users,
  BarChart2,
  Download,
  Bell,
  Layers,
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import Breadcrumbs from '@/components/Breadcrumbs';

const features = [
  { icon: LayoutDashboard, title: 'Real-Time Merchant Dashboard', body: 'Every transaction — collections, payments, FX swaps, cash advance activity — updated in real time. Your full financial picture, always current.' },
  { icon: FileCheck, title: 'KRA e-TIMS Tax Compliance', body: 'Every sale is signed as a real KRA fiscal receipt through eTIMS OSCU the moment it happens — with a verifiable QR code, not a batch report reconstructed later.' },
  { icon: TrendingUp, title: 'Trust Score Monitor', body: 'Track your Trust Score in real time — see exactly how close you are to unlocking your next Cash Advance tier.' },
  { icon: Users, title: 'Team Access & Spending Controls', body: 'Add team members with defined roles, set spending limits, require approval for large transactions — without giving up full account access.' },
  { icon: BarChart2, title: 'Business Analytics & Insights', body: 'Revenue trends, peak payment periods, top customers by volume, month-on-month growth — all visualized clearly. Decisions based on data, not guesswork.' },
  { icon: Download, title: 'Downloadable Financial Reports', body: 'Export transaction histories, payroll records, FX logs, and tax summaries — formatted for your accountant, investors, or your own records.' },
  { icon: Bell, title: 'Smart Notifications & Alerts', body: 'Custom alerts for large inflows, low balances, upcoming payments, and Trust Score milestones. Stay in control without watching the dashboard all day.' },
  { icon: Layers, title: 'Multi-Account Management', body: 'Multiple business locations or entities? Manage separate dashboards with consolidated reporting and shared team access under one login.' },
];

const useCases = [
  { title: 'Retail & Hospitality', desc: 'Monitor daily revenue in real time, track peak hours, and run end-of-day reconciliation automatically.' },
  { title: 'Service Agencies', desc: 'Generate records, track payments, run payroll, and download clean tax records — all from one place.' },
  { title: 'Import/Export Traders', desc: 'Monitor KES and USDC balances simultaneously, track FX history, manage supplier payment schedules.' },
  { title: 'Multi-Location Businesses', desc: 'Manage multiple merchant accounts under one login with consolidated reporting across all locations.' },
];

const chartData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  datasets: [
    {
      label: 'Revenue (KES)',
      data: [120000, 140000, 125000, 165000, 180000, 172000, 195000],
      borderColor: '#00bf63',
      backgroundColor: 'rgba(0,191,99,0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2.5,
    },
  ],
};

const chartOptions = {
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
  },
};

const OperationsTools = () => {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Breadcrumb strip */}
      <div className="pt-24 pb-2 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <Breadcrumbs currentPage="Operations Tools" />
        </div>
      </div>

      {/* HERO */}
      <section className="relative pb-20 lg:pb-28 overflow-hidden bg-[#0a0a0a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-[#00bf63]/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00bf63] animate-pulse" />
                <span className="text-sm font-medium text-gray-200">The command center behind every PayChain product</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
                Run Your Business from <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00bf63] to-emerald-300">One Intelligent Dashboard.</span>
              </h1>
              <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                PayChain Operations Tools gives you real-time visibility, financial controls, compliance automation, and team management — everything you need to run a modern Kenyan business, without the complexity.
              </p>
              <a href="https://app.paychain.co.ke" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
                See It in Action
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="col-span-2">
                    <div className="flex gap-3 mb-4">
                      <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Balance</div>
                        <div className="text-base font-bold text-white">Ksh 1,254,300.00</div>
                      </div>
                      <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Today</div>
                        <div className="text-base font-bold text-white">Ksh 42,300.00</div>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 h-[140px]">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  </div>

                  <aside className="col-span-1 flex flex-col gap-3">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Trust Score</div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-2">
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-[#00bf63] to-emerald-300"
                          initial={{ width: 0 }}
                          animate={{ width: '72%' }}
                          transition={{ duration: 1, delay: 0.6 }}
                        />
                      </div>
                      <div className="text-xs font-semibold text-white">72 — Good</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex-1">
                      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Team activity</div>
                      <ul className="text-[11px] text-gray-300 space-y-1.5 leading-relaxed">
                        <li>Mary approved payout — 10m ago</li>
                        <li>Ken requested FX swap — 1h ago</li>
                        <li>New user added: John — today</li>
                      </ul>
                    </div>
                  </aside>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Recent transactions</div>
                  <div className="space-y-1.5">
                    {[
                      ['INV-001234', 'Card • Ksh 4,200.00', '2h ago'],
                      ['INV-001233', 'M-PESA • Ksh 12,400.00', '5h ago'],
                      ['INV-001232', 'Card • Ksh 2,800.00', '1d ago'],
                    ].map(([id, meta, time]) => (
                      <div key={id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-white font-medium">{id}</span>
                        <span className="text-gray-500">{meta}</span>
                        <span className="text-gray-600">{time}</span>
                      </div>
                    ))}
                  </div>
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Most Kenyan Merchants Are Running Blind.</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              No real-time transaction data. No automated tax records. No team spending controls. No clear picture of what came in, what went out, and what's left. Just a phone full of SMS notifications and a notebook that never quite adds up. PayChain Operations Tools changes all of that.
            </p>
          </motion.div>
        </div>
      </section>

      {/* EXPLAINER */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8 max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">The Control Center Your Business Has Always Needed.</h3>
            <p className="text-lg text-gray-600 leading-relaxed">
              PayChain Operations Tools is the intelligence layer across all four PayChain products — a unified command center giving you real-time data, automated compliance, team controls, and business insights on one dashboard built for Kenyan SMEs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Every Tool You Need. Nothing You Don't.
          </motion.h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-[#00bf63]/30 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:bg-[#00bf63] transition-colors duration-300">
                    <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">{f.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KRA SPOTLIGHT */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-5xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-sm p-8 lg:p-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Tax Compliance Without the Headache.</h3>
            <p className="text-gray-600 leading-relaxed max-w-3xl mb-10">
              KRA's eTIMS system requires a signed fiscal receipt for every taxable sale. For most Kenyan businesses, this means manual data entry, spreadsheets, and accountants charging by the hour. PayChain eliminates all of that: every sale is signed through KRA's eTIMS OSCU in real time, with a verifiable QR receipt and full VAT breakdown, no manual submission step. Period summaries are ready for download whenever you or your accountant need them.
            </p>

            <div className="grid lg:grid-cols-3 gap-4 items-stretch">
              <div className="lg:col-span-2 bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Period</div>
                    <div className="font-bold text-gray-900">Jan 2026 — Mar 2026</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total transactions</div>
                    <div className="font-bold text-gray-900">1,248</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total revenue</div>
                    <div className="text-xl font-extrabold text-gray-900">Ksh 3,412,800.00</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">VAT summary</div>
                    <div className="text-xl font-extrabold text-gray-900">Ksh 280,400.00</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3">
                <button className="w-full inline-flex items-center justify-center gap-2 bg-[#0a0a0a] text-white font-bold px-4 py-3 rounded-xl hover:bg-gray-800 transition-colors">
                  <Download className="w-4 h-4" /> Download e-TIMS report
                </button>
                <div className="text-xs text-gray-500 text-center">Official format — ready for KRA</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Built for How Kenyan Businesses Actually Operate
          </motion.h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <h4 className="font-bold text-gray-900 mb-2">{uc.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{uc.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-[#0a0a0a] to-gray-900 rounded-3xl p-12 text-center max-w-4xl mx-auto border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00bf63]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">Stop Running Your Business on Guesswork.</h2>
            <p className="text-xl text-gray-400 mb-10 relative z-10">Sign up and experience full financial visibility today.</p>
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

export default OperationsTools;
