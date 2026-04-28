import React from 'react';
import { motion } from 'framer-motion';
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

const ComparisonTable: React.FC = () => (
  <section className="py-28 bg-[#00351d] overflow-hidden">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
        <motion.div
          variants={fadeUp(0)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="text-left"
        >

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Why merchants are switching to{' '}
            <span className="text-emerald-400">
              PayChain
            </span>
            .
          </h2>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-8 max-w-xl">
            Legacy payment processors were built for a different era. PayChain is built for 2026 and beyond — faster, compliant, and resilient to real-world risks.
          </p>

        </motion.div>
        
        <motion.div
          variants={fadeUp(0.2)}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="relative"
        >
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#00351d]">
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
