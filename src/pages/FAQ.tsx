import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Shield, RefreshCw, FileCheck, Users, Zap, HelpCircle, MessageCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: FAQItem[];
}

const categories: FAQCategory[] = [
  {
    id: 'general',
    label: 'General',
    icon: <HelpCircle className="w-4 h-4" />,
    color: 'text-slate-400 border-slate-400/30 bg-slate-400/10',
    items: [
      {
        question: 'What is PayChainKE?',
        answer: (
          <>
            PayChainKE is a <strong className="text-foreground">Hybrid Business Operating System</strong> built for the African merchant. It bridges the gap between traditional mobile money (M-PESA) and global Web3 liquidity on Base L2 — letting you accept payments, protect savings from inflation, pay staff and suppliers in bulk, and stay KRA-compliant automatically. All in one dashboard.
          </>
        ),
      },
      {
        question: 'Who is PayChainKE for?',
        answer: (
          <>
            PayChainKE is built for <strong className="text-foreground">Kenyan MSMEs, retailers, service providers, and digital merchants</strong> who accept M-PESA, handle staff payroll, need KRA e-TIMS compliance, and want to protect their business savings from KES inflation. If you run any business in Kenya that touches money, PayChainKE is for you.
          </>
        ),
      },
      {
        question: 'Is PayChainKE available outside Kenya?',
        answer: (
          <>
            We are <strong className="text-foreground">Kenya-first</strong> and optimised for the Kenyan market — M-PESA, KRA e-TIMS, CBK regulations. Expansion across East Africa (Uganda, Tanzania, Rwanda) is on the 2026 roadmap. Join the waitlist to be notified when your country goes live.
          </>
        ),
      },
      {
        question: 'How do I get started?',
        answer: (
          <>
            Click <strong className="text-foreground">"Join the Waitlist"</strong> on the homepage, enter your business details, and our onboarding team will contact you within 48 hours. Early access merchants get priority onboarding, reduced fees, and a dedicated account manager for the first 90 days.
          </>
        ),
      },
      {
        question: 'Is there a free trial?',
        answer: (
          <>
            Yes. PayChainKE offers a <strong className="text-foreground">30-day free trial</strong> with full access to all four OS pillars (Accept, Protect, Spend, Comply). No credit card required. After 30 days, you choose a plan that fits your transaction volume.
          </>
        ),
      },
    ],
  },
  {
    id: 'inflation-shield',
    label: 'Inflation Shield',
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    items: [
      {
        question: 'What is the Inflation Shield?',
        answer: (
          <>
            The Inflation Shield is PayChainKE's <strong className="text-foreground">automated KES→USDC conversion feature</strong>. When you receive M-PESA payments, you can set a threshold — any balance above that threshold is automatically converted to USDC (a USD-pegged stablecoin) on Base L2. This means your business savings retain their USD purchasing power even as the KES depreciates.
          </>
        ),
      },
      {
        question: 'Why USDC on Base L2?',
        answer: (
          <>
            <strong className="text-foreground">USDC</strong> is the world's most trusted USD-pegged stablecoin, issued by Circle and fully regulated. <strong className="text-foreground">Base L2</strong> (built by Coinbase) is a low-fee, fast Ethereum Layer 2 network — swaps cost less than KES 5 and settle in under 2 seconds. Together they give you the stability of the USD with the speed of mobile money.
          </>
        ),
      },
      {
        question: 'Can I convert USDC back to KES at any time?',
        answer: (
          <>
            Yes, instantly. You can swap USDC back to KES and withdraw to your M-PESA or bank account at any time from your PayChainKE dashboard. The live KES/USD rate is displayed before you confirm every conversion. <strong className="text-foreground">No lock-up periods, no withdrawal penalties.</strong>
          </>
        ),
      },
      {
        question: 'Is my USDC safe?',
        answer: (
          <>
            Your USDC is held in a <strong className="text-foreground">non-custodial wallet</strong> linked to your PayChainKE account — meaning only you control the keys. PayChainKE never holds your funds. USDC is 100% backed by US dollar reserves, audited monthly by Deloitte. Your balance is also covered by our <strong className="text-foreground">Sentinel AI</strong> fraud monitoring layer.
          </>
        ),
      },
    ],
  },
  {
    id: 'sentinel',
    label: 'Sentinel AI',
    icon: <Shield className="w-4 h-4" />,
    color: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    items: [
      {
        question: 'What is Sentinel AI?',
        answer: (
          <>
            Sentinel AI is PayChainKE's <strong className="text-foreground">real-time fraud prevention engine</strong>. Every M-PESA payment you receive is verified directly against Safaricom's servers in under 100 milliseconds — not against an SMS message that can be faked. Fake "you have received" notifications are blocked before you release goods or services.
          </>
        ),
      },
      {
        question: 'How does Sentinel AI stop fake SMS fraud?',
        answer: (
          <>
            Instead of trusting the SMS confirmation a customer shows you, Sentinel AI <strong className="text-foreground">queries Safaricom's API directly</strong> and cross-references the transaction against your till number, amount, and timestamp. If the transaction doesn't exist on Safaricom's ledger, the payment is flagged as fraudulent instantly. No more manually calling Safaricom to verify payments.
          </>
        ),
      },
      {
        question: 'What happens when Sentinel blocks a transaction?',
        answer: (
          <>
            You receive an <strong className="text-foreground">instant in-app alert</strong> (with a red "BLOCKED" status on your dashboard) and an optional SMS/email notification. The blocked transaction is logged with full details for your records and is not counted as revenue. You can review all blocked transactions in the Sentinel Audit Log.
          </>
        ),
      },
      {
        question: 'Does Sentinel AI work for card and bank payments too?',
        answer: (
          <>
            Currently Sentinel AI optimises for <strong className="text-foreground">M-PESA (Paybill & Till), Airtel Money, and Equity Bank</strong> mobile transactions. Card payments processed via PayChainKE's checkout are covered by 3DS verification. Bank transfer verification via RTGS/EFT flagging is on the Q3 2026 roadmap.
          </>
        ),
      },
      {
        question: 'What is the Sentinel AI uptime guarantee?',
        answer: (
          <>
            Sentinel AI operates on a <strong className="text-foreground">99.97% uptime SLA</strong> with multi-region failover across Nairobi and AWS eu-west. Your business is always protected. Planned maintenance windows (less than 4 hours/year) are announced 7 days in advance.
          </>
        ),
      },
    ],
  },
  {
    id: 'etims',
    label: 'e-TIMS & Compliance',
    icon: <FileCheck className="w-4 h-4" />,
    color: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    items: [
      {
        question: 'What is e-TIMS and why does it matter?',
        answer: (
          <>
            <strong className="text-foreground">e-TIMS (Electronic Tax Invoice Management System)</strong> is KRA's mandatory invoicing system. From January 1, 2026, all business expenses must be validated against e-TIMS data for tax deductibility. Businesses that don't issue or receive valid e-TIMS invoices face a <strong className="text-foreground">2× penalty on the tax due</strong> for that transaction.
          </>
        ),
      },
      {
        question: 'How does PayChainKE handle e-TIMS compliance?',
        answer: (
          <>
            PayChainKE is built with <strong className="text-foreground">e-TIMS Native</strong> — meaning every sale you process automatically triggers an ETR (Electronic Tax Register) receipt and submits it to KRA in real time. No manual data entry, no third-party ETR device required. Your compliance rate is visible on your dashboard at all times.
          </>
        ),
      },
      {
        question: 'Do I still need a physical ETR machine?',
        answer: (
          <>
            No. PayChainKE is a <strong className="text-foreground">KRA-approved software ETR solution</strong> — it replaces the physical ETR device for merchants who process payments digitally. For merchants who also handle cash, we integrate with approved ETR hardware vendors. Contact our support team for a hardware compatibility assessment.
          </>
        ),
      },
      {
        question: 'What happens if I miss an e-TIMS submission?',
        answer: (
          <>
            PayChainKE has an <strong className="text-foreground">automated retry and reconciliation engine</strong>. If a KRA submission fails (e.g., due to a network outage), the system queues and retries automatically and logs the reason. You are alerted in-app and by email. All submissions are timestamped and auditable, protecting you in the event of a KRA audit.
          </>
        ),
      },
    ],
  },
  {
    id: 'payouts',
    label: 'Pay-for-Business',
    icon: <Users className="w-4 h-4" />,
    color: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    items: [
      {
        question: 'What is Pay-for-Business?',
        answer: (
          <>
            Pay-for-Business is PayChainKE's <strong className="text-foreground">bulk payout engine</strong>. You can pay your entire staff payroll, all your suppliers, utility bills (KPLC, Nairobi Water, Stima Sacco), and airtime top-ups in a single dashboard action — in KES (via M-PESA bulk transfer) or USDC (on Base L2 for international suppliers).
          </>
        ),
      },
      {
        question: 'How fast are bulk payouts processed?',
        answer: (
          <>
            M-PESA bulk transfers settle in <strong className="text-foreground">under 60 seconds</strong> for batches up to 1,000 recipients. USDC payments on Base L2 settle in under 2 seconds. Bank (EFT) transfers settle within the standard <strong className="text-foreground">same-day or T+1</strong> banking window depending on your bank.
          </>
        ),
      },
      {
        question: 'Is there a limit on bulk payout size?',
        answer: (
          <>
            Starter plans support up to <strong className="text-foreground">500 recipients per batch</strong>. Business and Enterprise plans support unlimited recipients per batch (subject to CBK daily transaction limits). M-PESA bulk transfer limits per Safaricom policy apply and can be raised with a CBK-approved business account.
          </>
        ),
      },
      {
        question: 'Can I schedule recurring payroll runs?',
        answer: (
          <>
            Yes. PayChainKE supports <strong className="text-foreground">recurring payment schedules</strong> — weekly, bi-weekly, or monthly. Set up your payroll once, upload your staff roster, and the system executes payments automatically on your chosen date. You receive a full payroll receipt and e-TIMS invoice for every run.
          </>
        ),
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Licensing',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-red-400 border-red-400/30 bg-red-400/10',
    items: [
      {
        question: 'Is PayChainKE regulated?',
        answer: (
          <>
            Yes. PayChainKE operates under a <strong className="text-foreground">CBK Payment Service Provider (PSP) licence</strong> and is compliant with the <strong className="text-foreground">Virtual Asset Service Provider (VASP) framework 2025</strong>. Our fiat on/off-ramp operations are conducted in partnership with Equity Bank and licensed Safaricom Paybill channels.
          </>
        ),
      },
      {
        question: 'How is my business data protected?',
        answer: (
          <>
            All data is encrypted at rest (AES-256) and in transit (TLS 1.3). PayChainKE is <strong className="text-foreground">SOC 2 Type II compliant</strong> and undergoes quarterly penetration testing by a certified third-party security firm. Transaction data is stored in Nairobi-based ISO 27001-certified data centres with real-time replication to a secondary site.
          </>
        ),
      },
      {
        question: 'What happens to my data if I cancel?',
        answer: (
          <>
            You own your data. Upon cancellation, you can export your full transaction history, customer records, and e-TIMS receipts in CSV or JSON format. Your data is retained for <strong className="text-foreground">7 years</strong> in compliance with KRA and CBK record-keeping requirements, then permanently deleted. You can request earlier deletion for non-regulatory data.
          </>
        ),
      },
    ],
  },
];

const FAQAccordion: React.FC<{ item: FAQItem; index: number }> = ({ item, index }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="border border-gray-200 rounded-xl overflow-hidden bg-white"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-gray-50 transition-colors duration-200"
      >
        <span className="text-base font-medium text-foreground">{item.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-emerald-400"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-1 text-gray-600 leading-relaxed border-t border-gray-100">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FAQ: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('general');
  const current = categories.find(c => c.id === activeCategory)!;

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <Navbar />

      {/* Hero */}
      <section
        className="relative pt-32 pb-16 px-4 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero 3.png')" }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-block text-xs font-semibold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6"
          >
            Help Center
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
          >
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Questions
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-200 max-w-2xl mx-auto"
          >
            Everything you need to know about the Hybrid Business OS for African merchants. Can't find your answer?{' '}
            <a href="mailto:support@paychainke.com" className="text-emerald-400 hover:underline">
              Contact our support team.
            </a>
          </motion.p>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="px-4 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 flex-wrap justify-center">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'border-gray-200 text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ List */}
      <section className="px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <div className={`inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full border mb-4 ${current.color}`}>
                {current.icon}
                {current.label}
              </div>
              {current.items.map((item, i) => (
                <FAQAccordion key={i} item={item} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm"
          >
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Still have questions?</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Our team is available Monday–Friday, 8am–6pm EAT. Average first response time: <strong className="text-gray-900">under 2 hours.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@paychainke.com"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors duration-200 shadow-lg shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                Email Support
              </a>
              <Link
                to="/docs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold transition-colors duration-200"
              >
                Read the Docs
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
