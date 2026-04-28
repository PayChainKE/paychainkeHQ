import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileCheck, Users, CreditCard, Zap, ArrowRight } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

const features = [
  {
    icon: 'accept-payment', // custom identifier for the gif
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
    icon: 'manage', // custom identifier for the gif
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
    icon: 'cash-grow', // custom identifier for the gif
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
    icon: 'pay', // custom identifier for the gif
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

/* ─────────────────────────────────────────────────────────────
   FEATURES SECTION — Key tools layout (PayChain edition)
───────────────────────────────────────────────────────────── */
const Features: React.FC = () => (
  <section className="py-24 bg-gray-50">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">

      {/* Left-aligned header */}
      <motion.div
        variants={fadeUp(0)}
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="max-w-2xl mb-16 text-left"
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
          className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-black text-white text-base sm:text-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          How it works <ArrowRight className="w-5 h-5" />
        </a>
      </motion.div>


      {/* 2×2 feature cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              variants={fadeUp(i * 0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              className={`flex flex-col gap-4 sm:gap-6 p-6 sm:p-8 rounded-2xl border ${f.borderColor} bg-white hover:shadow-lg transition-shadow items-start`}
            >
              {/* Icon */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0 mb-2">
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
              {/* Text */}
              <div className="flex flex-col items-start text-left w-full">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-snug">{f.title}</h3>
                <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-4">{f.description}</p>
                <a
                  href="/how-it-works"
                  className={`inline-flex items-center text-base sm:text-lg font-semibold hover:underline ${f.learnColor}`}
                >
                  Learn more
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default Features;
