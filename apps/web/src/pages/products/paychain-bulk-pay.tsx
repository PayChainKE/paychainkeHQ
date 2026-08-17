import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { Users, Package, Zap, Calendar, FileText, CheckCircle, Check } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

const features = [
  { title: 'Batch Payroll', icon: Users, desc: 'Upload staff list via CSV or build on dashboard. Run payroll for your entire team in one click with individual M-PESA confirmations sent automatically.' },
  { title: 'Supplier Payments', icon: Package, desc: 'Save supplier details once — bank account, mobile money, Paybill, or Till. Pay them all simultaneously when invoices are due. No manual transfers, no errors, no delays.' },
  { title: 'Utility Bill Settlement', icon: Zap, desc: 'Connect recurring utility accounts and settle electricity, water, and internet from one dashboard. Never miss a bill again.' },
  { title: 'Scheduled & Recurring Payments', icon: Calendar, desc: 'Set payments to run automatically — weekly wages, monthly rent, recurring orders. PayChain executes on time, every time.' },
  { title: 'Full Audit Trail', icon: FileText, desc: 'Every payment logged with amount, recipient, timestamp, and reference. Download full reports for accounting and KRA eTIMS compliance.' },
  { title: 'Payment Approval Workflow', icon: CheckCircle, desc: 'Require a second sign-off before large payments are released. Protect your business from unauthorized transfers.' },
];

const steps = [
  { title: 'Build Your Payment List', desc: 'Add employees, suppliers, and utility accounts — upload CSV or enter manually. Save for reuse every month.' },
  { title: 'Schedule or Execute', desc: 'Choose amounts, set dates, run immediately or schedule for later. Review everything before confirming.' },
  { title: 'Confirm Once. Done.', desc: 'PayChain processes every payment simultaneously, sends individual M-PESA confirmations, and logs the full batch.' },
];

const useCases = [
  { title: 'Retail & Hospitality', desc: 'Run weekly casual wages and monthly permanent payroll from the same dashboard — without touching a phone.' },
  { title: 'Service Agencies', desc: 'Pay freelancers, contractors, and staff in one batch. Download full payroll reports for HR.' },
  { title: 'Import/Export Traders', desc: 'Pay multiple suppliers simultaneously on invoice due dates. Never delay a supplier relationship.' },
  { title: 'Any Business with Bills', desc: 'Electricity. Internet. Water. Rent. Schedule and forget.' },
];

const comparisonRows = [
  ['Time to pay 20 staff', '40–60 minutes', 'Under 2 minutes'],
  ['Error risk', 'High — manual entry', 'Zero — saved lists'],
  ['Audit trail', 'None', 'Full downloadable report'],
  ['Scheduling', 'Manual every time', 'Automated recurring'],
  ['Approval controls', 'None', 'Multi-level authorization'],
  ['KRA compliance', 'Manual records', 'Auto-generated reports'],
];

const batch = [
  { name: 'Aisha N.', amount: 'KES 12,000', status: 'paid' },
  { name: 'James K.', amount: 'KES 8,500', status: 'paid' },
  { name: 'Mercy O.', amount: 'KES 10,200', status: 'pending' },
];

const PaychainBulkPay: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Breadcrumb strip */}
      <div className="pt-24 pb-2 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <Breadcrumbs currentPage="Paychain Bulk Pay" />
        </div>
      </div>

      {/* HERO */}
      <section className="relative pb-20 lg:pb-28 overflow-hidden bg-[#0a0a0a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-[#00bf63]/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00bf63] animate-pulse" />
                <span className="text-sm font-medium text-gray-200">One dashboard. Every outbound payment.</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
                Pay Everyone. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00bf63] to-emerald-300">In One Click.</span>
              </h1>
              <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                PayChain Bulk Pay lets you run payroll, pay suppliers, and settle utility bills directly from your merchant dashboard — no more app switching, no more manual transfers, no more end-of-month chaos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="https://app.paychain.co.ke" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-black bg-[#00bf63] hover:bg-[#00d971] rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(0,191,99,0.3)]">
                  Start Paying Smarter
                </a>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-sm font-semibold text-gray-200">Payroll batch — March</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-[#00bf63]/15 text-[#00bf63] px-2.5 py-1 rounded-full">Confirm All</span>
                </div>
                <div className="space-y-3">
                  {batch.map((row, i) => (
                    <motion.div
                      key={row.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
                      className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{row.name}</div>
                        <div className="text-xs text-gray-500">{row.amount}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${row.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {row.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                        {row.status === 'paid' && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.8 + i * 0.15 }}
                            className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-black" strokeWidth={3} />
                          </motion.div>
                        )}
                      </div>
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Running Payroll Shouldn't Feel Like a Second Job.</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Every month, Kenyan business owners spend hours making individual M-PESA transfers — one by one, employee by employee, supplier by supplier. One wrong number. One network error. One missed payment. And the damage to trust takes weeks to repair.
            </p>
          </motion.div>
        </div>
      </section>

      {/* EXPLAINER + STEPS */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">All Your Outbound Payments. One Dashboard. Zero Chaos.</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                PayChain Bulk Pay is a centralized outbound payment engine built into your merchant dashboard. Upload your payroll list, add supplier accounts, schedule utility bills — and execute all of them simultaneously with a single confirmation. Every payment is logged, timestamped, and receipted automatically.
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
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Everything You Need to Move Money Out — Without the Mess
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
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:border-[#00bf63]/30 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:bg-[#00bf63] transition-colors duration-300">
                    <Icon className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Built for Every Kind of Kenyan Business
          </motion.h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((uc, i) => (
              <motion.article
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <h4 className="font-bold text-gray-900 mb-2">{uc.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{uc.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Manual Transfers vs PayChain Bulk Pay
          </motion.h3>
          <div className="max-w-4xl mx-auto overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">Feature</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-gray-400">Manual M-PESA</th>
                  <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-[#00a857] bg-emerald-50/60">PayChain Bulk Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map(([label, manual, paychain]) => (
                  <tr key={label}>
                    <td className="py-4 px-5 font-semibold text-gray-800">{label}</td>
                    <td className="py-4 px-5 text-gray-500">{manual}</td>
                    <td className="py-4 px-5 font-semibold text-[#00a857] bg-emerald-50/60">{paychain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-[#0a0a0a] to-gray-900 rounded-3xl p-12 text-center max-w-4xl mx-auto border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00bf63]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10">Stop Sending Transfers One by One.</h2>
            <p className="text-xl text-gray-400 mb-10 relative z-10">Sign up in minutes and run your first batch payout today.</p>
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

export default PaychainBulkPay;
