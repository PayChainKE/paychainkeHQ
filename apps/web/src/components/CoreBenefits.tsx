import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, TrendingDown, Users, Landmark } from 'lucide-react';

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

const CoreBenefits: React.FC = () => {
  return (
    <section className="relative py-16 sm:py-24 bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Headline */}
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="lg:col-span-5 lg:sticky lg:top-32"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-800 text-sm font-bold tracking-wider uppercase border border-red-200 mb-6 shadow-sm">
              The Reality
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
              PayChain is a financial dashboard built for Kenyan business owners.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-md">
              Imagine you run a shop, restaurant, or any business in Kenya. Right now you probably deal with four frustrating problems every day:
            </p>
          </motion.div>

          {/* Right Column: The 4 Frustrations */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {problems.map((p) => (
                <motion.div 
                  key={p.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="bg-white p-6 sm:p-8 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-lg transition-shadow relative overflow-hidden"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${p.color}`}>
                    {p.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">{p.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-medium">
                    {p.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default CoreBenefits;
