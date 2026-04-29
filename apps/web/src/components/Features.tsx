import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileCheck, Users, CreditCard, Zap, ArrowRight } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { 
      duration: 0.8, 
      delay, 
      ease: [0.16, 1, 0.3, 1] as const 
    } 
  },
});

const features = [
  {
    icon: 'accept-payment',
    tag: 'Accept',
    tagColor: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    learnColor: 'text-[#00bf63]',
    borderColor: 'border-emerald-100',
    title: 'Easy and safe way to accept payments',
    description:
      'With a PayChain merchant account, go fully cashless and make it easy for your customers to pay via Lipa Na M-Pesa, USDC on Base, card, or bank transfer, all verified on-chain in under 100ms.',
  },
  {
    icon: 'manage',
    tag: 'Manage',
    tagColor: 'bg-blue-50 text-blue-700 border border-blue-100',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    learnColor: 'text-[#00bf63]',
    borderColor: 'border-blue-100',
    title: 'Manage your business anywhere, anytime',
    description:
      'Our dedicated merchant dashboard gives you real-time visibility into transactions, customer payments, e-TIMS receipts, and analytics, from any device, at any time.',
  },
  {
    icon: 'cash-grow',
    tag: 'Grow',
    tagColor: 'bg-purple-50 text-purple-700 border border-purple-100',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    learnColor: 'text-[#00bf63]',
    borderColor: 'border-purple-100',
    title: 'Quick financing to grow your business',
    description:
      "Access capital when you need it. Whether it's working capital or funds to expand, PayChain Business Advance uses your transaction history to get you credit fast, no paperwork.",
  },
  {
    icon: 'pay',
    tag: 'Spend',
    tagColor: 'bg-orange-50 text-orange-700 border border-orange-100',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    learnColor: 'text-[#00bf63]',
    borderColor: 'border-orange-100',
    title: 'Conveniently pay your suppliers or employees',
    description:
      'Use PayChain Bulk Pay to batch-disburse salaries, supplier invoices, and utility bills in one click, directly to M-Pesa or bank. PAYE auto-calculated.',
  },
];

const Features: React.FC = () => (
  <section className="relative py-32 bg-[#f9fafb] overflow-hidden">
    {/* Top Separator */}
    <div className="absolute top-0 left-0 w-full rotate-180 overflow-hidden leading-[0] z-10">
      <svg viewBox="0 0 1440 120" className="relative block w-full h-[60px] md:h-[80px]" preserveAspectRatio="none">
        <path 
          d="M0,120 L1440,120 L1440,0 C1100,80 340,80 0,0 L0,120 Z" 
          className="fill-[#00351d]"
        />
      </svg>
    </div>

    <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-16">
        <motion.div
          variants={fadeUp(0)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="relative z-10 max-w-2xl text-left"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight">
            Key tools to drive your<br className="hidden sm:block" /> business forward
          </h2>
          <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-xl">
            We understand that you want more customers coming through the door. That is why PayChain's
            tools seamlessly weave into how your business operates, making it easier than ever to run,
            grow, and prosper.
          </p>
          <a
            href="/how-it-works"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm hover:shadow"
          >
            How it works <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        <motion.div
          variants={fadeUp(0.2)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="hidden lg:block w-full max-w-[400px] lg:max-w-[600px] ml-auto relative z-0 pointer-events-none"
        >
          <img src="/Home page/design 0.png" alt="" className="w-full h-auto object-contain scale-[1.5] lg:scale-[2.2] origin-center -translate-y-[20px]" />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            variants={fadeUp(i * 0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className={`flex flex-col gap-3 sm:gap-4 p-5 sm:p-6 rounded-2xl border ${f.borderColor} bg-white shadow-[0_12px_40px_-12px_rgba(0,53,29,0.25)] hover:shadow-[0_20px_50px_-10px_rgba(0,53,29,0.4)] transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] items-center text-center`}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center flex-shrink-0 mb-2">
              {f.icon === 'accept-payment' ? (
                <img src="/icons/accept payment.gif" alt="Accept Payment" className="w-full h-full object-contain" />
              ) : f.icon === 'cash-grow' ? (
                <img src="/icons/cash grow.gif" alt="Cash Grow" className="w-full h-full object-contain" />
              ) : f.icon === 'manage' ? (
                <img src="/icons/manage.gif" alt="Manage" className="w-full h-full object-contain" />
              ) : f.icon === 'pay' ? (
                <img src="/icons/pay.gif" alt="Pay" className="w-full h-full object-contain" />
              ) : null}
            </div>
            <div className="flex flex-col items-center text-center w-full">
              <h3 className="text-lg sm:text-xl font-bold text-emerald-500 mb-2 leading-snug">{f.title}</h3>
              <p className="text-sm sm:text-base text-gray-500 leading-relaxed mb-4">{f.description}</p>
              <a
                href="/how-it-works"
                className="inline-flex items-center px-3 py-1 mt-2 text-xs font-semibold text-white bg-[#00351d] rounded transition-all duration-300 hover:bg-[#00351d]/90 hover:scale-105 group"
              >
                Learn more
                <ArrowRight className="w-3 h-3 ml-1 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Bottom Separator */}
    <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] z-10">
      <svg viewBox="0 0 1440 120" className="relative block w-full h-[60px] md:h-[80px]" preserveAspectRatio="none">
        <path 
          d="M0,120 L1440,120 L1440,0 C1100,80 340,80 0,0 L0,120 Z" 
          className="fill-[#00351d]"
        />
      </svg>
    </div>
  </section>
);

export default Features;
