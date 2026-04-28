import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const ProblemSolution = () => {
  return (
    <section className="relative py-16 bg-white overflow-hidden mt-8">
      {/* Professional Top Separator */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 md:w-1/4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent blur-[1px]"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Headline */}
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="lg:col-span-5 lg:sticky lg:top-32"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-50 text-[#00351d] text-sm font-bold tracking-wider uppercase border border-emerald-100 mb-6">
              The Unified OS
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-4">
              PayChain solves all four in one place.
            </h2>
            <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md">
              Consolidate your financial stack. Everything your business needs to operate securely and grow effortlessly, built into a single dashboard.
            </p>
          </motion.div>

          {/* Right Column: The Details */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="bg-white p-6 sm:p-8 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow relative overflow-hidden"
            >
              <div className="w-12 h-12 bg-emerald-50 text-[#00351d] rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed font-medium">
                When you join PayChain you get a verified till number. Every customer payment is confirmed instantly on your dashboard, not by screenshot. <span className="font-bold text-[#00351d] block mt-3">Real verification. Fraud becomes impossible.</span>
              </p>
            </motion.div>

            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="bg-[#00351d] p-6 sm:p-8 rounded-[1.5rem] shadow-2xl relative overflow-hidden text-white"
            >
              {/* Abstract graphic */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl opacity-50 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-base sm:text-lg text-white/90 leading-relaxed font-medium">
                  From the same dashboard you can pay all your staff in one click, swap your KES to USDC to protect it from shilling drops, and after 3 months of using PayChain your transaction history automatically qualifies you for working capital/cash advance—<span className="font-bold text-emerald-400 block mt-3">no collateral, no bank queue, no title deed.</span>
                </p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;