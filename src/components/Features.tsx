import React from 'react';
import { Zap, Shield, Brain, FileCheck, Smartphone, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Zap,
    title: 'High-Speed Verification',
    description: 'Rust-native engine delivers sub-100ms payment verification with WebSocket push notifications.',
    highlight: true,
  },
  {
    icon: Shield,
    title: 'Sentinel Intelligence',
    description: 'Real-time protection against fake SMS fraud and transaction reversals with AI-powered anomaly detection.',
    highlight: false,
  },
  {
    icon: Database,
    title: 'Immutable Ledger',
    description: 'Every transaction is anchored to the Base L2 Blockchain, creating an unbreakable audit trail.',
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
    <section className="py-24 bg-gradient-dark">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for the <span className="text-gradient">Kenyan Market</span>
          </h2>
          <p className="text-muted-foreground">
            Enterprise-grade payment verification designed for high-traffic commercial environments.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn(
                  "group relative p-6 rounded-2xl border transition-all duration-300 hover:border-primary/50",
                  feature.highlight
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border"
                )}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                  feature.highlight
                    ? "bg-primary/20 group-hover:bg-primary/30"
                    : "bg-secondary group-hover:bg-primary/10"
                )}>
                  <Icon className={cn(
                    "w-6 h-6 transition-colors",
                    feature.highlight ? "text-primary" : "text-foreground group-hover:text-primary"
                  )} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
