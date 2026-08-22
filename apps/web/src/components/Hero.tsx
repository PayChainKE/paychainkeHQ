import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const Hero: React.FC = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
  };

  return (
    <section className="relative w-full flex items-center justify-center overflow-hidden bg-white min-h-[600px] md:min-h-[800px]">
      {/* Background Image - Flipped for Mobile, Normal for Desktop */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 md:hidden bg-[url('/Home%20page/mobile%20home%20hero%20bg.png')] bg-cover bg-center scale-x-[-1]" />
        <div className="absolute inset-0 hidden md:block bg-[url('/hero-bg.png')] bg-cover md:bg-top md:bg-[center_-200px] lg:bg-[center_-380px] bg-no-repeat" />
      </div>

      {/* Background Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#00351d] via-[#00351d]/90 to-transparent z-0"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col lg:flex-row items-center gap-16 py-16 lg:py-24">
        
        {/* Left Content Area */}
        <motion.div 
          className="w-full lg:w-1/2 flex flex-col items-start"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >


          <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#FBF8F1] leading-tight">
            Simple tools for<br />a{' '}
            <span className="relative inline-block text-emerald-400">
              secure
              <svg
                className="absolute left-0 -bottom-1 sm:-bottom-2 w-full h-3 sm:h-4 text-emerald-400"
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
              >
                <motion.path
                  d="M2,8 C30,2 70,2 98,8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                />
              </svg>
            </span>{' '}
            business.
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-6 text-base sm:text-lg text-[#FBF8F1] leading-relaxed max-w-lg font-medium">
            <strong className="text-[#FBF8F1] font-bold">Paychain</strong> makes it simple to accept secure payments (via Paybill, payment links, or STK push), pay staff and suppliers in bulk, and run your business on automated tools built for Kenyan merchants.
          </motion.p>

          {/* Call to Actions */}
          <motion.div variants={itemVariants} className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
            <a
              href="https://app.paychain.co.ke"
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm rounded-lg bg-emerald-400 text-emerald-950 font-extrabold hover:bg-emerald-300 transition-colors cursor-pointer shadow-lg hover:shadow-xl"
            >
              Get started today <ArrowRight className="w-4 h-4 ml-1.5" />
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-[#FBF8F1] mb-2 uppercase tracking-wider">Trusted by:</span>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {['/Home page/merchant 1.png', '/Home page/merchant 2.png', '/Home page/merchant 3.png'].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Merchant ${i + 1}`}
                      className="w-10 h-10 rounded-full border-2 border-white object-cover shadow-sm"
                    />
                  ))}
                </div>
                <div className="flex flex-col items-start">
                  <div className="flex gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-medium text-[#FBF8F1]">
                    <span className="font-bold text-emerald-400">3,000+</span> merchants
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>

      {/* Professional Angled Separator */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] z-20 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-12 sm:h-20 md:h-24 lg:h-32">
          <polygon points="0,100 1440,0 1440,100" className="fill-gray-50" />
        </svg>
      </div>
    </section>
  );
};

export default Hero;
