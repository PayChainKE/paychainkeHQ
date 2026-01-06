import React from 'react';
import { Book, Zap, Shield, Database, Code, Server } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';

const docSections = [
  {
    icon: Zap,
    title: 'Quick Start',
    description: 'Get up and running with payChainKE in under 5 minutes.',
    items: [
      'Create a merchant account',
      'Register your Till Number',
      'Install the POS SDK',
      'Receive your first Truth Ping',
    ],
  },
  {
    icon: Server,
    title: 'Webhook Integration',
    description: 'Configure M-Pesa callbacks to route through payChainKE.',
    items: [
      'Daraja API setup',
      'Callback URL configuration',
      'Signature verification',
      'Error handling',
    ],
  },
  {
    icon: Shield,
    title: 'Fraud Detection',
    description: 'Understanding the AI-powered fraud scoring system.',
    items: [
      'How fraud scores work',
      'Behavioral pattern analysis',
      'Custom thresholds',
      'Alert configuration',
    ],
  },
  {
    icon: Database,
    title: 'Data & Compliance',
    description: 'KRA eTIMS integration and data handling policies.',
    items: [
      'eTIMS reporting setup',
      'Transaction export',
      'Data retention policy',
      'GDPR compliance',
    ],
  },
  {
    icon: Code,
    title: 'API Reference',
    description: 'Complete REST and WebSocket API documentation.',
    items: [
      'Authentication',
      'Transaction endpoints',
      'WebSocket events',
      'Rate limits',
    ],
  },
  {
    icon: Book,
    title: 'SDK Libraries',
    description: 'Client libraries for popular languages and frameworks.',
    items: [
      'JavaScript/TypeScript',
      'Python',
      'Kotlin (Android)',
      'Swift (iOS)',
    ],
  },
];

const Docs: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Documentation
            </h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to integrate payChainKE into your payment workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.title}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 cursor-pointer card-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {section.description}
                      </p>
                      <ul className="space-y-1.5">
                        {section.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="w-1 h-1 rounded-full bg-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* API Endpoint Preview */}
          <div className="mt-12 p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Base URL
            </h3>
            <code className="block p-4 rounded-xl bg-secondary font-mono text-sm text-primary">
              https://api.paychainke.io/v1
            </code>

            <div className="mt-6 grid gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
                <span className="px-2 py-1 rounded bg-success/20 text-success text-xs font-bold">
                  GET
                </span>
                <code className="font-mono text-sm text-foreground">/transactions/{'{id}'}</code>
                <span className="text-xs text-muted-foreground ml-auto">Get transaction by ID</span>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
                <span className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-bold">
                  POST
                </span>
                <code className="font-mono text-sm text-foreground">/webhook/mpesa</code>
                <span className="text-xs text-muted-foreground ml-auto">M-Pesa callback endpoint</span>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
                <span className="px-2 py-1 rounded bg-warning/20 text-warning text-xs font-bold">
                  WS
                </span>
                <code className="font-mono text-sm text-foreground">/ws/transactions</code>
                <span className="text-xs text-muted-foreground ml-auto">Real-time Truth Ping stream</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Docs;
