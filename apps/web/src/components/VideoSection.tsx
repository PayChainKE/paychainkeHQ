import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Globe, Wallet } from 'lucide-react';

const VideoSection: React.FC = () => {
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
      description: "Registered PayChain till numbers for secure, fraud-proof inbound payments.",
      icon: ShieldCheck,
    },
    {
      title: "Bulk Pay",
      description: "Pay staff, suppliers & utilities in one place effortlessly.",
      icon: Zap,
    },
    {
      title: "FX & Stablecoins",
      description: "Swap KES to USDC instantly, hedge shilling depreciation.",
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
              Introducing PayChain
            </motion.h2>
            
            <motion.p variants={itemVariants} className="text-lg text-gray-600 mb-10 leading-relaxed">
              Tired of SMS payment fraud and shilling depreciation eating your profits? 
              PayChain is a unified dashboard that gives you everything you need to collect, pay, swap, and grow built on Safaricom M-PESA infrastructure and blockchain rails.
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div 
                  key={index} 
                  variants={itemVariants}
                  className="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{feature.title}</h4>
                    <p className="text-sm text-gray-500 leading-snug">{feature.description}</p>
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
