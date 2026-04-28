import React from 'react';
import { motion } from 'framer-motion';

const MobileAppCTA: React.FC = () => {
  return (
    <section className="relative w-full py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="bg-emerald-900 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col lg:flex-row items-center justify-between">
          
          {/* Professional Dot Pattern Overlay */}
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

          {/* Text Content */}
          <div className="relative z-10 p-10 sm:p-16 lg:p-20 lg:w-1/2 flex flex-col items-start text-left">
            <span className="text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-4">Coming soon ......</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Paychain mobile app
            </h2>
            <p className="text-base sm:text-lg text-gray-300 mb-10 max-w-md leading-relaxed">
              Download the Paychain mobile app and run your business anywhere, anytime. Stay secured on top of your business on the go.
            </p>
            
            <div className="flex flex-row flex-wrap gap-4 w-full sm:w-auto mt-2">
              <a href="#download-ios" className="transition-transform hover:scale-105 inline-block">
                <img src="/Home page/app store.png" alt="Download on the App Store" className="h-12 sm:h-14 w-auto object-contain rounded-xl" />
              </a>
              <a href="#download-android" className="transition-transform hover:scale-105 inline-block">
                <img src="/Home page/google play.png" alt="Get it on Google Play" className="h-12 sm:h-14 w-auto object-contain rounded-xl" />
              </a>
            </div>
          </div>

          {/* Image Content */}
          <div className="relative z-10 w-full lg:w-1/2 flex justify-center lg:justify-end items-end pt-10 lg:pt-20 px-4 sm:px-10 lg:pr-0 gap-4 sm:gap-6">
            <motion.img 
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              src="/Home page/paychain mock up.png" 
              alt="Paychain Dashboard Mockup" 
              className="w-1/2 max-w-[200px] lg:max-w-[260px] object-contain origin-bottom drop-shadow-[0_25px_35px_rgba(0,0,0,0.8)]"
              style={{ marginBottom: '0.5rem' }}
            />
            <motion.img 
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              src="/Home page/mobile mock up.png" 
              alt="Paychain Mobile App Mockup" 
              className="w-1/2 max-w-[200px] lg:max-w-[260px] object-contain origin-bottom drop-shadow-[0_25px_35px_rgba(0,0,0,0.8)]"
              style={{ marginBottom: '-2rem' }}
            />
          </div>

        </div>
      </div>
    </section>
  );
};

export default MobileAppCTA;
