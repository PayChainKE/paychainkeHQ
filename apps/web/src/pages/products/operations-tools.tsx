import React from 'react';
import Seo from '@/components/Seo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
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
  { icon: LayoutDashboard, title: 'See Everything as It Happens', body: 'Every payment in and out — money collected, bills paid, USDC swaps, cash advance activity — updates the moment it happens. Your full financial picture, always current.' },
  { icon: TrendingUp, title: 'Watch Your Trust Score Grow', body: 'See your Trust Score update in real time, and exactly how close you are to your next Cash Advance offer.' },
  { icon: Users, title: 'Control Who Can Spend What', body: 'Add staff with their own roles, set spending limits, and require your okay before large payments go out — without giving them full access to your account.' },
  { icon: BarChart2, title: 'Know How Your Business Is Doing', body: 'See your sales trends, your busiest times, your best customers, and how much you\'ve grown month to month — all in simple charts, not guesswork.' },
  { icon: Download, title: 'Download Your Records Anytime', body: 'Download your payment history, payroll records, and tax summaries — ready to hand to your accountant, an investor, or keep for yourself.' },
  { icon: Bell, title: 'Get Alerted to What Matters', body: 'Get notified about large payments received, low balances, upcoming bills, and Trust Score milestones — without having to check the dashboard all day.' },
  { icon: Layers, title: 'Manage More Than One Business', body: 'Running more than one shop or business? Manage separate dashboards with one combined view and one login for your whole team.' },
];

const useCases = [
  { title: 'Retail & Hospitality', desc: 'Watch your daily sales as they happen, see your busiest hours, and let your books balance themselves automatically at the end of each day.' },
  { title: 'Service Agencies', desc: 'Generate records, track payments, run payroll, and download clean tax records, all from one place.' },
  { title: 'Import/Export Traders', desc: 'Watch payments come in as they happen, match up your Paybill and invoice payments automatically, and manage when suppliers get paid.' },
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
    <div className="min-h-screen bg-white">
      <Seo
        title="Operations Tools | Run Your Business from One Dashboard"
        description="See your money matching up automatically, handle disputes, control who can spend what, and stay on the right side of tax rules — everything you need to run a modern Kenyan business from one dashboard."
        path="/products/operations-tools"
      />
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
                PayChain Operations Tools lets you see everything happening in your business, control who can spend what, stay on the right side of tax rules automatically, and manage your team: everything you need to run a modern Kenyan business, without the complexity.
              </p>
              <a href="https://app.paychain.co.ke/login?tab=signup" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
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
                      <div className="text-xs font-semibold text-white">72 (Good)</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex-1">
                      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Team activity</div>
                      <ul className="text-[11px] text-gray-300 space-y-1.5 leading-relaxed">
                        <li>Mary approved payout (10m ago)</li>
                        <li>Ken requested FX swap (1h ago)</li>
                        <li>New user added: John (today)</li>
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
              PayChain Operations Tools ties every PayChain product together in one place, giving you up-to-the-minute data, automatic help staying compliant, control over your team, and a clear picture of how your business is doing — all on one dashboard built for Kenyan small businesses.
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
              <a href="https://app.paychain.co.ke/login?tab=signup" className="inline-flex px-8 py-4 text-lg font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(0,191,99,0.3)]">
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
