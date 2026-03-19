import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import { Users, Package, Zap, Calendar, FileText, CheckCircle } from 'lucide-react';
import './paychain-bulk-pay.css';
import useBulkPayAnimations from './useBulkPayAnimations';

const features = [
  { title: 'Batch Payroll', icon: Users, desc: 'Upload staff list via CSV or build on dashboard. Run payroll for your entire team in one click with individual M-PESA confirmations sent automatically.' },
  { title: 'Supplier Payments', icon: Package, desc: 'Save supplier details once. Pay them all simultaneously when invoices are due. No manual transfers, no errors, no delays.' },
  { title: 'Utility Bill Settlement', icon: Zap, desc: 'Connect recurring utility accounts and settle electricity, water, and internet from one dashboard. Never miss a bill again.' },
  { title: 'Scheduled & Recurring Payments', icon: Calendar, desc: 'Set payments to run automatically — weekly wages, monthly rent, recurring orders. PayChain executes on time, every time.' },
  { title: 'Full Audit Trail', icon: FileText, desc: 'Every payment logged with amount, recipient, timestamp, and reference. Download full reports for accounting and KRA e-TIMS compliance.' },
  { title: 'Payment Approval Workflow', icon: CheckCircle, desc: 'Require a second sign-off before large payments are released. Protect your business from unauthorized transfers.' },
];

const PaychainBulkPay: React.FC = () => {
  useBulkPayAnimations();

  return (
    <div className="bulk-pay-page bg-background text-foreground min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* HERO */}
        <section className="bulk-hero grid lg:grid-cols-2 gap-10 items-center" aria-labelledby="bulk-hero-title" data-animate>
          <div>
            <h1 id="bulk-hero-title" className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4">Pay Everyone. From One Place. In One Click.</h1>
            <p className="text-lg text-muted-foreground mb-6">PayChain Bulk Pay lets you run payroll, pay suppliers, and settle utility bills directly from your merchant dashboard — no more app switching, no more manual transfers, no more end-of-month chaos.</p>
            <div className="flex gap-3">
              <div className="inline-flex bg-primary/30 border border-primary/40 rounded-lg p-1">
                <Link to="/waitlist" className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg h-10">Start Paying Smarter</Link>
              </div>
            </div>
          </div>

          <div className="hero-dashboard" aria-hidden="true">
            <div className="dashboard-mock" role="img" aria-label="Bulk pay dashboard mockup">
              <div className="batch-header"><span className="title">Payroll batch — March</span><button className="confirm-all">Confirm All</button></div>
              <ul className="batch-list">
                <li className="batch-item"><div className="meta"><span className="name">Aisha N.</span><span className="amount">KES 12,000</span></div><div className="status"><span className="badge pending">Pending</span><span className="check"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div></li>
                <li className="batch-item"><div className="meta"><span className="name">James K.</span><span className="amount">KES 8,500</span></div><div className="status"><span className="badge paid">Paid</span><span className="check play"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div></li>
                <li className="batch-item"><div className="meta"><span className="name">Mercy O.</span><span className="amount">KES 10,200</span></div><div className="status"><span className="badge pending">Pending</span><span className="check"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div></li>
              </ul>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="problem mt-12 p-8 rounded-lg" data-animate>
          <h2 className="text-2xl font-semibold mb-3">Running Payroll Shouldn't Feel Like a Second Job.</h2>
          <p className="text-base text-white/90">Every month, Kenyan business owners spend hours making individual M-PESA transfers — one by one, employee by employee, supplier by supplier. One wrong number. One network error. One missed payment. And the damage to trust takes weeks to repair.</p>
        </section>

        {/* EXPLAINER */}
        <section className="explainer grid lg:grid-cols-2 gap-8 mt-12 items-start" data-animate>
          <div>
            <h3 className="text-2xl font-semibold mb-3">All Your Outbound Payments. One Dashboard. Zero Chaos.</h3>
            <p className="text-base text-muted-foreground">PayChain Bulk Pay is a centralized outbound payment engine built into your merchant dashboard. Upload your payroll list, add supplier accounts, schedule utility bills — and execute all of them simultaneously with a single confirmation. Every payment is logged, timestamped, and receipted automatically.</p>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-3">How it Works</h4>
            <ol className="steps-list">
              <li><strong>1 — Build Your Payment List:</strong> Add employees, suppliers, and utility accounts — upload CSV or enter manually. Save for reuse every month.</li>
              <li><strong>2 — Schedule or Execute:</strong> Choose amounts, set dates, run immediately or schedule for later. Review everything before confirming.</li>
              <li><strong>3 — Confirm Once. Done.:</strong> PayChain processes every payment simultaneously, sends individual M-PESA confirmations, and logs the full batch.</li>
            </ol>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features mt-12" data-animate>
          <h3 className="text-2xl font-semibold mb-6">Everything You Need to Move Money Out — Without the Mess</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="feature-card p-6 rounded-2xl shadow-sm" role="article">
                  <div className="icon mb-3"><Icon className="w-6 h-6 text-primary" /></div>
                  <h4 className="font-semibold mb-2">{f.title}</h4>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* USE CASES */}
        <section className="use-cases mt-12" data-animate>
          <h3 className="text-2xl font-semibold mb-6">Built for Every Kind of Kenyan Business</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Retail & Hospitality</h4> <p className="text-sm">Run weekly casual wages and monthly permanent payroll from the same dashboard — without touching a phone.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Service Agencies</h4> <p className="text-sm">Pay freelancers, contractors, and staff in one batch. Download full payroll reports for HR.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Import/Export Traders</h4> <p className="text-sm">Pay multiple suppliers simultaneously on invoice due dates. Never delay a supplier relationship.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Any Business with Bills</h4> <p className="text-sm">Electricity. Internet. Water. Rent. Schedule and forget.</p> </article>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="comparison mt-12 p-6 rounded-lg" data-animate>
          <h3 className="text-2xl font-semibold mb-6">Manual Transfers vs PayChain Bulk Pay</h3>
          <div className="overflow-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="text-left w-1/3 text-sm text-muted-foreground">Feature</th>
                  <th className="text-left text-sm">Manual M-PESA</th>
                  <th className="text-left text-sm">PayChain Bulk Pay</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="py-3 text-sm text-muted-foreground">Time to pay 20 staff</td><td className="py-3 text-sm text-muted-foreground">40–60 minutes</td><td className="py-3 text-sm text-primary">Under 2 minutes</td></tr>
                <tr><td className="py-3 text-sm text-muted-foreground">Error risk</td><td className="py-3 text-sm text-muted-foreground">High — manual entry</td><td className="py-3 text-sm text-primary">Zero — saved lists</td></tr>
                <tr><td className="py-3 text-sm text-muted-foreground">Audit trail</td><td className="py-3 text-sm text-muted-foreground">None</td><td className="py-3 text-sm text-primary">Full downloadable report</td></tr>
                <tr><td className="py-3 text-sm text-muted-foreground">Scheduling</td><td className="py-3 text-sm text-muted-foreground">Manual every time</td><td className="py-3 text-sm text-primary">Automated recurring</td></tr>
                <tr><td className="py-3 text-sm text-muted-foreground">Approval controls</td><td className="py-3 text-sm text-muted-foreground">None</td><td className="py-3 text-sm text-primary">Multi-level authorization</td></tr>
                <tr><td className="py-3 text-sm text-muted-foreground">KRA compliance</td><td className="py-3 text-sm text-muted-foreground">Manual records</td><td className="py-3 text-sm text-primary">Auto-generated reports</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="final-cta mt-12 text-center p-12 rounded-2xl" data-animate>
          <h3 className="text-2xl font-semibold mb-3">Stop Sending Transfers One by One.</h3>
          <p className="text-muted-foreground mb-6">Join our closed beta launching Q2 2026.</p>
          <div className="inline-flex bg-primary/30 border border-primary/40 rounded-lg p-1 inline-block">
            <Link to="/waitlist" className="btn-primary px-5 py-2 rounded-lg h-10">Get Early Access</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PaychainBulkPay;
import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function PaychainBulkPay() {
  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold mb-4">Paychain Bulk Pay</h1>
        <p className="text-slate-600 mb-6">Scale payroll and supplier payouts with queued batch processing, retries, and multi-rail settlement options.</p>
        <section className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-2">Capabilities</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            <li>CSV or API-driven batch uploads</li>
            <li>Retry, reconciliation and reporting</li>
            <li>Integrates with local mobile money rails</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
