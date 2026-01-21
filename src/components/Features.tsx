import React from 'react';
import { Zap, Shield, Brain, FileCheck, Smartphone, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Zap,
    title: 'High-Speed Verification',
    description: 'Rust-native engine delivers sub-100ms payment verification with WebSocket push notifications.',
    highlight: false,
  },
  {
    icon: Database,
    title: 'Immutable Ledger',
    description: 'Every transaction is anchored to the Base L2 Blockchain, creating an unbreakable audit trail.',
    highlight: false,
  },
  {
    icon: Shield,
    title: 'Sentinel Intelligence',
    description: 'Real-time protection against fake SMS fraud and transaction reversals with AI-powered anomaly detection.',
    highlight: false,
  },
  {
    icon: FileCheck,
    title: 'e-TIMS Automation',
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

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Kenya image on the left */}
          <div className="order-1 lg:order-1 bg-white rounded-lg p-6">
            {/* MSME Count Title */}
            <div className="text-center mb-4">
              <div className="text-2xl font-normal text-gray-800"><span className="font-bold">125m</span> MSMEs in Africa</div>
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
            <div className="flex justify-end">
              <div className="grid grid-cols-2 gap-6 max-w-2xl">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className={cn(
                        "group relative p-6 rounded-2xl border transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:scale-105 bg-white cursor-pointer",
                        feature.highlight
                          ? "border-primary/30 shadow-lg"
                          : "border-gray-200 shadow-sm"
                      )}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                      )}>
                        <Icon className={cn(
                          "w-6 h-6 transition-colors",
                          feature.highlight ? "text-primary" : "text-gray-700 group-hover:text-primary"
                        )} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
