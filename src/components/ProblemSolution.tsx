import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import TruthPing from './TruthPing';

// Custom hook for intersection observer
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return [ref, isIntersecting];
};

const ProblemSolution: React.FC = () => {
  const [sectionRef, isInView] = useIntersectionObserver();
  return (
    <section className="py-24 bg-card" ref={sectionRef}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Problem Section */}
          <div className={`mb-16 transition-all duration-1000 ${isInView ? 'animate-slide-in' : 'opacity-0 translate-x-[-50px]'}`}>
<div className="text-left mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                The Problem:
              </h2>
              <h3 className={`text-2xl md:text-3xl font-bold text-destructive mb-4 italic transition-all duration-1000 delay-300 ${isInView ? 'animate-modern-typewriter' : 'opacity-0'}`}>
                KES 1.6 Trillion Lost to Digital Fraud Annually.
              </h3>
              <p className="text-base lg:text-lg text-muted-foreground text-left">
                In <strong className="font-bold text-gray-900">2024</strong>, Kenya faced <strong className="font-bold text-gray-900">KES 2.0T fraud exposure</strong>, with <strong className="font-bold text-gray-900">KES 1.6T</strong> in actual losses.
              </p>
              <p className="text-base lg:text-lg text-muted-foreground text-left block lg:hidden">
                Mobile money surged to <strong className="font-bold text-gray-900">KES 40.24T</strong>, enabling sophisticated fraud that created a "Trust Crisis" for over <strong className="font-bold text-gray-900">1.2M active businesses</strong>.
              </p>
              <p className="text-base lg:text-lg text-muted-foreground text-left hidden lg:block">
                Mobile money surged to <strong className="font-bold text-gray-900">KES 40.24T</strong>, enabling sophisticated fraud that created
              </p>
              <p className="text-base lg:text-lg text-muted-foreground text-left hidden lg:block">
                a "Trust Crisis" for over <strong className="font-bold text-gray-900">1.2M active businesses</strong>.
              </p>
            </div>

            <div className={`space-y-12 transition-all duration-1000 ${isInView ? 'stagger-children' : 'opacity-0'}`}>
              {/* Fake SMS Fraud */}
              <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-1000 delay-500 ${isInView ? 'animate-modern-fade-in-up' : 'opacity-0 translate-y-[30px]'}`}>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6 min-h-[280px] flex flex-col justify-center order-1 lg:order-1 hover:scale-105 transition-transform duration-300">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-foreground">Fake SMS & Smishing (The "Social" Fraud)</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    The Stat: 49% of Kenyan phone owners received fraudulent messages in 2024. The Cost: Mobile banking fraud losses surged by 344% in a single year, reaching KES 810 Million in direct banking-related mobile theft, while broader "smishing" (SMS phishing) targets 80% of Kenyans quarterly.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>Source:</strong> <a href="https://safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safaricom FY25 Results Booklet</a> / <a href="https://transunion.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">TransUnion Africa 2025 Report</a>
                  </p>
                  <div className="text-2xl font-bold text-destructive">KES 810M</div>
                </div>
                <div className={`bg-card rounded-lg p-6 order-2 lg:order-2 transition-all duration-1000 delay-700 ${isInView ? 'animate-modern-float' : 'opacity-0 scale-95'}`}>
                  <img
                    src="/fake sms.png"
                    alt="Fake SMS Fraud Illustration"
                    className="w-full h-64 object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Transaction Reversals */}
              <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-1000 delay-900 ${isInView ? 'animate-modern-fade-in-up' : 'opacity-0 translate-y-[30px]'}`}>
                <div className={`bg-card rounded-lg p-6 order-2 lg:order-1 transition-all duration-1000 delay-1100 ${isInView ? 'animate-modern-float' : 'opacity-0 scale-95'}`}>
                  <img
                    src="/reversal.png"
                    alt="Transaction Reversals Illustration"
                    className="w-full h-64 object-contain rounded-lg"
                  />
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6 min-h-[280px] flex flex-col justify-center order-1 lg:order-2 hover:scale-105 transition-transform duration-300">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-foreground">Transaction Reversals & Insider Fraud</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    The Stat: 9.8% of mobile money users have experienced direct financial loss, significantly higher than traditional banking. The Cost: In 2024, Safaricom fired 113 employees for fraud violations—a clear sign that the "Truth" is often compromised from the inside, making manual verification impossible for merchants.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>Source:</strong> <a href="https://safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safaricom 2024 Sustainability Report</a> / <a href="https://centralbank.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CBK National Payments Report</a>
                  </p>
                  <div className="text-2xl font-bold text-destructive">9.8% Users</div>
                </div>
              </div>

              {/* Compliance Gaps */}
              <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-1000 delay-1300 ${isInView ? 'animate-modern-fade-in-up' : 'opacity-0 translate-y-[30px]'}`}>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6 min-h-[280px] flex flex-col justify-center order-1 lg:order-1 hover:scale-105 transition-transform duration-300">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-foreground">The e-TIMS Compliance Tax</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    The Stat: Effective January 1, 2026, KRA began validating all business expenses strictly via e-TIMS data. The Cost: Non-compliant businesses face a penalty of twice the tax due. For a KES 500,000 inventory purchase without an e-TIMS invoice, a merchant effectively pays KES 150,000 in extra tax, as the expense is no longer deductible.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>Source:</strong> <a href="https://kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">KRA e-TIMS Guidelines (Tax Procedures Act 2024)</a> / <a href="https://treasury.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Finance Act 2025 Amendments</a>
                  </p>
                  <div className="text-2xl font-bold text-destructive">2x Tax Penalty</div>
                </div>
                <div className={`bg-card rounded-lg p-6 order-2 lg:order-2 transition-all duration-1000 delay-1500 ${isInView ? 'animate-modern-float' : 'opacity-0 scale-95'}`}>
                  <img
                    src="/compliance gap.png"
                    alt="Compliance Gaps Illustration"
                    className="w-full h-64 object-contain rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Solution Section */}
          <div>
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
              {/* Left: Text Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">The Solution</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  PayChainKE
                </h2>
                <p className="text-lg text-muted-foreground max-w-3xl">
                  Blockchain-anchored payment verification with real-time fraud protection
                  and automated compliance. Every transaction is verified, secured, and
                  reported instantly.
                </p>
              </div>

              {/* Right: Truth Ping Demo */}
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Phone mockup */}
                  <div className="relative w-72 h-[580px] bg-black rounded-[2.5rem] sm:rounded-[3rem] border-2 border-gray-800 p-1 card-shadow mx-auto lg:mx-0">
                    {/* Dynamic Island */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-3 bg-black rounded-full" />

                    {/* Screen */}
                    <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">payChainKE</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Merchant Terminal</p>
                      </div>

                      {/* Truth Ping */}
                      <div className="flex-1 flex items-center justify-center">
                        <TruthPing isVerified={true} amount={2500} tillNumber="174379" />
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

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">Real-Time Verification</h3>
                </div>
                <p className="text-muted-foreground">
                  Sub-100ms verification eliminates fake SMS fraud by confirming payments
                  directly from Safaricom's systems.
                </p>
                <div className="mt-4 text-2xl font-bold text-primary">100% Accurate</div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">Fraud Prevention</h3>
                </div>
                <p className="text-muted-foreground">
                  AI-powered Sentinel Intelligence detects and blocks fraudulent patterns
                  before they impact your business.
                </p>
                <div className="mt-4 text-2xl font-bold text-primary">99.9% Uptime</div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">Auto-Compliance</h3>
                </div>
                <p className="text-muted-foreground">
                  One-click e-TIMS integration ensures perfect compliance with KRA
                  regulations, eliminating penalties.
                </p>
                <div className="mt-4 text-2xl font-bold text-primary">Zero Errors</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;