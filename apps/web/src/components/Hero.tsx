import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const Hero: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
  };

  return (
    <section className="relative w-full flex items-center justify-center overflow-hidden bg-white">
      {/* Decorative Background Elements Removed */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col lg:flex-row items-center gap-16 py-12 sm:py-16 lg:py-20">
        
        {/* Left Content Area */}
        <motion.div 
          className="w-full lg:w-1/2 flex flex-col items-start lg:-ml-12 xl:-ml-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >


          <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0A192F] tracking-tight leading-tight flex flex-col">
            <span>Simple tools for</span>
            <span>a <span className="text-[#00bf63]">secure</span> business.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-lg font-light">
            <strong className="font-semibold text-gray-900">Paychain</strong> makes it simple to accept secure payments while providing inflation protection, global bulk payouts, and automated business tools.
          </motion.p>

          {/* Call to Actions */}
          <motion.div variants={itemVariants} className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <a
              href="/waitlist"
              className="group relative flex items-center justify-center w-full sm:w-auto px-8 py-4 text-base rounded-2xl bg-[#0A192F] text-white font-medium overflow-hidden transition-all hover:shadow-2xl hover:shadow-emerald-500/20 bento-glow"
            >
              <span className="relative z-10 flex items-center">
                Start Growing Today 
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
            

          </motion.div>

          {/* Social Proof */}
          <motion.div variants={itemVariants} className="mt-14 pt-8 border-t border-gray-200 w-full max-w-md">
            <p className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">Trusted by industry leaders</p>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-3">
                {['/Home page/merchant 1.png', '/Home page/merchant 2.png', '/Home page/merchant 3.png'].map((src, i) => (
                  <div key={i} className="relative group">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img
                      src={src}
                      alt={`Merchant ${i + 1}`}
                      className="relative w-12 h-12 rounded-full border-2 border-white object-cover shadow-sm transition-transform group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-800">
                  <span className="font-bold text-[#0A192F]">5,000+</span> active merchants
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Content Area (Image) */}
        <motion.div 
          className="w-full lg:w-1/2 flex items-center justify-center relative z-0 mt-8 lg:-mt-16 lg:-mr-10 xl:-mr-16"
          initial={{ opacity: 0, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="relative w-full max-w-lg lg:max-w-xl xl:max-w-2xl flex justify-center perspective-[2000px]">
            <div className="relative z-10 w-full">
              <img
                src="/Home page/design 1.png"
                alt="Paychain app design"
                className="w-[120%] sm:w-[110%] h-auto object-contain scale-[1.15]"
              />
            </div>
            
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
