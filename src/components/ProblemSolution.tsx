import React from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import TruthPing from './TruthPing';

const ProblemSolution: React.FC = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Problem Section */}
          <div className="mb-16">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <AlertTriangle className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">The Problem</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                KES 5.8B Lost to Payment Fraud Annually
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Kenyan merchants lose billions yearly to sophisticated payment fraud schemes.
                Fake SMS confirmations, transaction reversals, and compliance gaps create
                a perfect storm of financial insecurity.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                  <h3 className="text-xl font-semibold text-foreground">Fake SMS Fraud</h3>
                </div>
                <p className="text-muted-foreground">
                  Criminals send fraudulent SMS confirmations, tricking merchants into
                  releasing goods before payment confirmation.
                </p>
                <div className="mt-4 text-2xl font-bold text-destructive">KES 3.2B</div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                  <h3 className="text-xl font-semibold text-foreground">Transaction Reversals</h3>
                </div>
                <p className="text-muted-foreground">
                  Customers dispute legitimate transactions, forcing merchants to refund
                  while losing the original goods.
                </p>
                <div className="mt-4 text-2xl font-bold text-destructive">KES 1.8B</div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                  <h3 className="text-xl font-semibold text-foreground">Compliance Gaps</h3>
                </div>
                <p className="text-muted-foreground">
                  Manual e-TIMS reporting creates errors and penalties, costing businesses
                  time and additional fees.
                </p>
                <div className="mt-4 text-2xl font-bold text-destructive">KES 0.8B</div>
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