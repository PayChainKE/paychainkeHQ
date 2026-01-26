import React from 'react';
import { Zap, Shield, Brain, FileCheck, Smartphone, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Zap,
    title: 'High-Speed Verification.',
    description: 'Rust-native engine delivers sub-100ms payment verification with WebSocket push notifications.',
    highlight: false,
  },
  {
    icon: Database,
    title: 'Immutable Ledger.',
    description: 'Every transaction is anchored to the Base L2 Blockchain, creating an unbreakable audit trail.',
    highlight: false,
  },
  {
    icon: Shield,
    title: 'Sentinel Intelligence.',
    description: 'Real-time protection against fake SMS fraud and transaction reversals with AI-powered anomaly detection.',
    highlight: false,
  },
  {
    icon: FileCheck,
    title: 'e-TIMS Automation.',
    description: 'One-click compliance with KRA regulations through automated tax reporting integration.',
    highlight: false,
  },
];

const Features: React.FC = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Built for the <span className="text-gradient">African Market</span>
          </h2>
          <p className="text-gray-600">
            Enterprise-grade payment verification designed for high-traffic commercial environments.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Kenya image on the left */}
          <div className="order-1 lg:order-1 bg-white rounded-lg p-4 lg:p-6">
            {/* MSME Count Title */}
            <div className="text-center mb-4">
              <div className="text-xl lg:text-2xl font-normal text-gray-800"><span className="font-bold">125</span><span className="font-bold"> Million</span> MSMEs in Africa</div>
              <div className="text-base lg:text-lg font-normal text-red-600 mt-2">KES 1.6 Trillion Lost to Digital Fraud Annually</div>
            </div>
            <div className="flex justify-center">
              <img
                src="/africa.png"
                alt="Map of Africa"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          </div>

          {/* Feature cards on the right */}
          <div className="order-2 lg:order-2">
            <div className="grid grid-cols-2 gap-2 lg:gap-4 max-w-2xl">
              {features.map((feature, index) => {
                return (
                  <div
                    key={feature.title}
                    className={cn(
                      "group relative p-2 lg:p-4 rounded-lg lg:rounded-xl border transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:scale-105 bg-white cursor-pointer min-h-[120px] lg:min-h-[180px] flex flex-col",
                      feature.highlight
                        ? "border-primary/30 shadow-lg"
                        : "border-gray-200 shadow-sm"
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <h3 className="text-sm lg:text-lg font-bold text-gray-900 group-hover:text-primary transition-colors duration-300 mb-1 lg:mb-2 flex-shrink-0 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-xs lg:text-sm text-gray-600 leading-relaxed flex-grow">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
