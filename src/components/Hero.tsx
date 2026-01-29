import React, { useState, useEffect } from 'react';
import { Shield, Zap, Star } from 'lucide-react';
import TruthPing from './TruthPing';

const Hero: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Demo: trigger verification ping every 5 seconds
    const interval = setInterval(() => {
      setIsVerified(true);
      setTimeout(() => setIsVerified(false), 3000);
    }, 6000);

    // Initial demo
    const initialTimeout = setTimeout(() => setIsVerified(true), 1500);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []);

  return (
    <section 
      className="relative min-h-[85vh] md:min-h-[75vh] flex items-center justify-center overflow-hidden pt-16"
      style={{
        backgroundImage: `url('/background 2.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
        minHeight: '85vh'
      }}
    >
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-black/50 md:bg-black/70"></div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-20 z-10">
        <div className="grid lg:grid-cols-3 gap-12 items-center min-h-[60vh]">
          {/* Text Content - Left side on large screens */}
          <div className="lg:col-span-2 stagger-children">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6 text-left">
              <span className="text-gray-300">Secure Your </span>
              <span className="text-primary">Payment</span>
              <span className="text-gray-300"> Truth.</span>
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl mb-8 text-left">
              Anchor every sale to the blockchain and neutralize "Fake SMS" fraud in sub-100ms with our high-performance Sentinel Intelligence.
            </p>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-colors">
                Get Started
              </button>
              <button className="border border-gray-300 text-gray-300 hover:bg-gray-300 hover:text-gray-900 px-8 py-3 rounded-lg font-semibold transition-colors">
                Learn More
              </button>
            </div>

            {/* User testimonials and trust indicator */}
            <div className="mt-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex -space-x-2">
                  <img src="/hero 5.png" alt="User 1" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
                  <img src="/hero 4.png" alt="User 2" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
                  <img src="/hero 3.png" alt="User 3" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
                </div>
                <div className="flex flex-col">
                  {/* Five star rating */}
                  <div className="flex items-center gap-1 mb-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <span className="text-gray-300 text-sm">Trusted by 30,000+ merchants & enterprises</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Empty space on the right for large screens */}
          <div className="hidden lg:block"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
