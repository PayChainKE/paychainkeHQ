import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

const ComparisonTable: React.FC = () => (
  <section className="relative py-16 bg-[#00351d] overflow-hidden">
    {/* Professional Glowing Top Separator */}
    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"></div>
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2/3 md:w-1/2 h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent blur-[2px]"></div>

    
    <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          variants={fadeUp(0)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="text-left"
        >

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
            Why merchants are switching to{' '}
            <span className="text-emerald-400">
              PayChain
            </span>
            .
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
            Legacy tools leave you fighting fraud, inflation, and payroll chaos. PayChain is a unified OS that secures your business with a dedicated bank account number, and collateral-free credit based on your real performance.
          </p>
          <a 
            href="/about#the-problem"
            className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#00351d] font-bold text-sm tracking-wide rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:-translate-y-0.5"
          >
            The problem
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>

        </motion.div>
        
        <motion.div
          variants={fadeUp(0.2)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="relative flex justify-center lg:justify-end"
        >
          <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#00351d]">
            <img 
              src="/happy_kenyan_merchant.png" 
              alt="Happy Kenyan Merchant using PayChain" 
              className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
            />
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default ComparisonTable;
