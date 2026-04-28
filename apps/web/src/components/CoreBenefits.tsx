import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Eye } from 'lucide-react';

const benefits = [
  {
    title: 'Security by Design',
    desc: 'Our Sentinel AI and bank-grade encryption protocols ensure your transaction data and Truth Layer verification are protected at all times.',
    icon: <Shield className="w-5 h-5 text-emerald-600" />,
  },
  {
    title: 'Radical Transparency',
    desc: 'Experience a unified, real-time view of your KES and USDC assets, anchored to an immutable ledger on the Base L2 blockchain.',
    icon: <Eye className="w-5 h-5 text-emerald-600" />,
  },
  {
    title: 'Industrial-Grade Reliability',
    desc: "Engineered for 100% uptime with Jenga API v3 and Africa's Talking USSD fallbacks.",
    icon: <Zap className="w-5 h-5 text-emerald-600" />,
  },
];

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const CoreBenefits: React.FC = () => {
  return (
    <section className="bg-white text-[#0A192F]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block text-xs font-semibold tracking-widest uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mb-4">
            BENEFITS
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            Get the benefits of a Hybrid business OS
          </h2>
          <p className="mt-3 text-sm text-slate-500">Convenience Redefined</p>
        </div>

        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-10 grid gap-8 md:gap-12 grid-cols-1 md:grid-cols-3">
          {benefits.map((b) => (
            <motion.div
              key={b.title}
              variants={item}
              whileHover={{ y: -6, boxShadow: '0 30px 60px rgba(10,25,47,0.12)' }}
              className="bg-white border border-transparent hover:border-emerald-100 transition-all duration-300 rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                  {b.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0A192F]">{b.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{b.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CoreBenefits;
