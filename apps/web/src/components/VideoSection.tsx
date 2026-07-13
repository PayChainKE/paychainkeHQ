import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Globe, Wallet } from 'lucide-react';

const VideoSection: React.FC = () => {
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const features = [
    {
      title: "Verified Collections",
      description: "Registered PayChain Virtual Accounts for secure, fraud-proof inbound payments.",
      icon: ShieldCheck,
    },
    {
      title: "Bulk Pay",
      description: "Pay staff, suppliers & utilities in one place effortlessly.",
      icon: Zap,
    },
    {
      title: "FX & Stablecoins",
      description: "Receive global payments in stablecoins and swap KES to USDC instantly to hedge shilling depreciation.",
      icon: Globe,
    },
    {
      title: "Cash Advance",
      description: "Unlock working capital based on your transaction history, no collateral needed.",
      icon: Wallet,
    },
  ];

  return (
    <section className="py-24 bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-6 lg:px-8 relative z-20">
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Left Column: Content */}
          <div className="flex flex-col">

            
            <motion.h2 variants={itemVariants} className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              What is PayChain?
            </motion.h2>
            
            <motion.p variants={itemVariants} className="text-lg text-gray-600 mb-10 leading-relaxed">
              Tired of SMS payment fraud and shilling depreciation eating your profits? 
              PayChain is a unified dashboard that gives you everything you need to collect, pay, swap, and grow built on Safaricom M-PESA infrastructure and blockchain rails.
            </motion.p>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              {features.map((feature, index) => (
                <motion.div 
                  key={index} 
                  variants={itemVariants}
                  className="group w-full h-40 sm:h-32 [perspective:1000px] cursor-pointer"
                  onMouseEnter={() => setActiveCardIndex(index)}
                >
                  <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] ${activeCardIndex === index ? '[transform:rotateY(180deg)]' : ''}`}>
                    {/* Front Face */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                      <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center opacity-[0.04]"></div>
                      {/* Decorative Frame */}
                      <div className="absolute inset-1.5 border-2 border-emerald-900/40 rounded-lg pointer-events-none"></div>
                      <div className="relative z-10 w-full h-full p-2 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center relative">
                          <div className="absolute inset-0 bg-emerald-200 rounded-full blur-md opacity-40"></div>
                          <feature.icon className="relative z-10 w-6 h-6 sm:w-8 sm:h-8 text-emerald-600 drop-shadow-sm" />
                        </div>
                        <h4 className="relative z-10 text-sm sm:text-base font-bold text-gray-900 text-center leading-tight">{feature.title}</h4>
                      </div>
                    </div>
                    
                    {/* Back Face */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-emerald-800 rounded-xl shadow-xl overflow-hidden border border-emerald-500/50">
                      <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 to-emerald-900/90"></div>
                      {/* Decorative Frame */}
                      <div className="absolute inset-1.5 border-2 border-white/50 rounded-lg pointer-events-none z-10"></div>
                      <div className="relative z-10 w-full h-full p-4 flex items-center justify-center text-center">
                        <p className="text-sm text-white font-medium leading-relaxed drop-shadow-sm">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>


          </div>

          {/* Right Column: Video */}
          <motion.div 
            variants={itemVariants}
            className="relative group"
          >
            <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/MaKDVkrlHqs?si=7h0nvdgTlKfdq0jB" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default VideoSection;
