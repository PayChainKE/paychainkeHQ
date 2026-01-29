import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const HowItWorks: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-12">
            How It Works
          </h1>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold mb-4">Secure Payment Verification</h3>
                <p className="text-gray-600 text-lg">
                  Our advanced AI analyzes payment transactions in real-time, anchoring every sale to the blockchain for maximum security and fraud prevention.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold mb-4">Instant Fraud Detection</h3>
                <p className="text-gray-600 text-lg">
                  Within sub-100ms, our Sentinel Intelligence detects and neutralizes fake SMS fraud attempts, ensuring legitimate transactions proceed smoothly.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold mb-4">Real-time Monitoring</h3>
                <p className="text-gray-600 text-lg">
                  Continuous monitoring and reporting provide you with complete visibility into your payment security status and transaction integrity.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-gray-600 text-lg mb-8">
              Join thousands of merchants and enterprises who trust PayChainKE HQ for their payment security needs.
            </p>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-colors">
              Get Started Today
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HowItWorks;