import React from 'react';
import { Check, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const roadmapWeeks = [
  {
    week: 'Week 1-2',
    title: 'Foundation',
    status: 'completed',
    items: [
      'Set up Rust/Axum project structure',
      'PostgreSQL + Redis infrastructure',
      'Basic M-Pesa webhook receiver',
      'Initial schema design',
    ],
  },
  {
    week: 'Week 3-4',
    title: 'Core Engine',
    status: 'current',
    items: [
      'Truth Ping WebSocket implementation',
      'Transaction hashing (SHA256)',
      'Base L2 contract deployment',
      'Real-time verification flow',
    ],
  },
  {
    week: 'Week 5-6',
    title: 'Intelligence',
    status: 'upcoming',
    items: [
      'Fraud detection ML model (Candle)',
      'Anomaly scoring system',
      'Historical pattern analysis',
      'Alert notification system',
    ],
  },
  {
    week: 'Week 7-8',
    title: 'Production',
    status: 'upcoming',
    items: [
      'KRA eTIMS integration',
      'Load testing & optimization',
      'Merchant onboarding flow',
      'MVP launch in pilot zones',
    ],
  },
];

const statusConfig = {
  completed: { icon: Check, color: 'text-success', bg: 'bg-success' },
  current: { icon: Clock, color: 'text-primary', bg: 'bg-primary' },
  upcoming: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const RoadmapSection: React.FC = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            8-Week <span className="text-gradient">MVP Roadmap</span>
          </h2>
          <p className="text-muted-foreground">
            From zero to production-ready payment verification in 8 weeks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roadmapWeeks.map((phase, index) => {
            const config = statusConfig[phase.status as keyof typeof statusConfig];
            const Icon = config.icon;
            
            return (
              <div
                key={phase.week}
                className={cn(
                  "relative p-6 rounded-2xl border",
                  phase.status === 'current'
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border"
                )}
              >
                {/* Connector line */}
                {index < roadmapWeeks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border" />
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    phase.status === 'completed' && "bg-success/20",
                    phase.status === 'current' && "bg-primary/20 animate-pulse",
                    phase.status === 'upcoming' && "bg-muted"
                  )}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <span className={cn("text-sm font-medium", config.color)}>
                    {phase.week}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-3">
                  {phase.title}
                </h3>

                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", config.bg)} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RoadmapSection;
