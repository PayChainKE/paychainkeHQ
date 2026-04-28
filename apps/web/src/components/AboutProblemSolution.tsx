import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, TrendingDown, Users, Landmark, ShieldCheck, TrendingUp } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const problems = [
  {
    title: 'Fake M-PESA payments.',
    desc: 'Customers show you a screenshot claiming they paid. You have no way to verify it in real time. You release the goods. The money never arrives.',
    icon: <ShieldAlert className="w-6 h-6" />,
    color: 'bg-red-50 text-red-600',
  },
  {
    title: 'The shilling dropping.',
    desc: 'You work hard, collect KES, and watch your purchasing power quietly disappear every month especially if you buy imported goods.',
    icon: <TrendingDown className="w-6 h-6" />,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    title: 'Payroll chaos.',
    desc: 'Every month you spend hours sending individual M-PESA transfers to your staff one by one. It is exhausting and prone to mistakes.',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    title: 'Banks saying no.',
    desc: 'You go for a business loan. They ask for a title deed you do not have. Application rejected. Again.',
    icon: <Landmark className="w-6 h-6" />,
    color: 'bg-slate-100 text-slate-600',
  },
];

const AboutProblemSolution: React.FC = () => {
  return (
    <section id="the-problem" className="relative py-20 sm:py-32 bg-gray-50 overflow-hidden border-t border-gray-200 scroll-mt-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Phase 1: The Reality (Top Section) */}
        <div className="max-w-4xl mx-auto text-center mb-16 sm:mb-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-800 text-sm font-bold tracking-wider uppercase border border-red-200 mb-6 shadow-sm">
              The Reality
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.2] tracking-tight mb-6">
              PayChain is a financial dashboard built for Kenyan business owners.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Imagine you run a shop, restaurant, or any business in Kenya. Right now you probably deal with four frustrating problems every day:
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-12 text-left">
            {problems.map((p) => (
              <motion.div 
                key={p.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="bg-white p-6 sm:p-8 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${p.color}`}>
                  {p.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  {p.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Connector Line / Transition */}
        <div className="flex justify-center mb-16 sm:mb-24">
          <div className="w-1 h-24 bg-gradient-to-b from-transparent via-emerald-400 to-[#00351d] rounded-full opacity-50"></div>
        </div>

        {/* Phase 2: The Unified OS (Bottom Section) */}
        <div className="bg-[#00351d] rounded-[2.5rem] p-8 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] opacity-50 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column: Solution Headline */}
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="lg:col-span-5 lg:sticky lg:top-32"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-400/20 text-emerald-300 text-sm font-bold tracking-wider uppercase border border-emerald-400/30 mb-6">
                The Unified OS
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight mb-6">
                PayChain solves all four in one place.
              </h2>
              <p className="text-base sm:text-lg text-emerald-100/70 leading-relaxed">
                Consolidate your financial stack. Everything your business needs to operate securely and grow effortlessly, built into a single dashboard.
              </p>
            </motion.div>

            {/* Right Column: Solution Details */}
            <div className="lg:col-span-7 space-y-6">
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="bg-white/5 backdrop-blur-sm p-6 sm:p-8 rounded-[1.5rem] border border-white/10"
              >
                <div className="w-12 h-12 bg-emerald-400/20 text-emerald-300 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-base sm:text-lg leading-relaxed font-medium text-white/90">
                  When you join PayChain you get a verified till number. Every customer payment is confirmed instantly on your dashboard, not by screenshot. <span className="font-bold text-emerald-400 block mt-3">Real verification. Fraud becomes impossible.</span>
                </p>
              </motion.div>

              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="bg-white/5 backdrop-blur-sm p-6 sm:p-8 rounded-[1.5rem] border border-white/10"
              >
                <div className="w-12 h-12 bg-emerald-400/20 text-emerald-300 rounded-xl flex items-center justify-center mb-6">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-base sm:text-lg leading-relaxed font-medium text-white/90">
                  From the same dashboard you can pay all your staff in one click, swap your KES to USDC to protect it from shilling drops, and after 3 months of using PayChain your transaction history automatically qualifies you for working capital/cash advance—<span className="font-bold text-emerald-400 block mt-3">no collateral, no bank queue, no title deed.</span>
                </p>
              </motion.div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default AboutProblemSolution;
