import React, { useState, useEffect } from 'react';
import { Shield, Zap } from 'lucide-react';
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="stagger-children">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-foreground">Secure Your </span>
              <span className="text-primary">Jasho</span>
              <br />
              <span className="text-foreground">Verify the Truth</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mb-8">
              Sub-100ms payment verification with automated e-TIMS compliance.
              Protect against KES 5.8B in annual fraud with blockchain-anchored truth.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">&lt;100ms</p>
                <p className="text-sm text-muted-foreground">Verification Speed</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">99.9%</p>
                <p className="text-sm text-muted-foreground">Fraud Prevention</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">50K+</p>
                <p className="text-sm text-muted-foreground">Till Numbers Protected</p>
              </div>
            </div>
          </div>

          {/* Right: Truth Ping Demo */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Phone mockup */}
              <div className="relative w-64 sm:w-72 h-[520px] sm:h-[580px] bg-card rounded-[2.5rem] sm:rounded-[3rem] border-4 border-border p-2 card-shadow mx-auto lg:mx-0">
                {/* Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-full" />
                
                {/* Screen */}
                <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <span className="font-bold text-foreground">payChainKE</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Merchant Terminal</p>
                  </div>

                  {/* Truth Ping */}
                  <div className="flex-1 flex items-center justify-center">
                    <TruthPing isVerified={isVerified} amount={2500} tillNumber="174379" />
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3 text-primary" />
                      <span>Powered by Base L2</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
