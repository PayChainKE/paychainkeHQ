import React from 'react';
import { Cpu, Shield, Database, Lock, Zap, Code } from 'lucide-react';

const TechnicalSpecs: React.FC = () => {
  const specs = [
    {
      icon: Cpu,
      title: 'Rust-Axum Stack',
      description: 'High-performance async web framework built in Rust for maximum speed and reliability.',
      details: 'Zero-cost abstractions, memory safety, and Tokio runtime for concurrent processing.'
    },
    {
      icon: Shield,
      title: 'AES-256 Encryption',
      description: 'Military-grade encryption protects all transaction data in transit and at rest.',
      details: 'FIPS 140-2 compliant with perfect forward secrecy and quantum-resistant algorithms.'
    },
    {
      icon: Database,
      title: 'Base L2 Blockchain',
      description: 'Every transaction is immutably anchored to Coinbase\'s Layer 2 network.',
      details: 'Ethereum-compatible with sub-second finality and minimal gas fees.'
    },
    {
      icon: Lock,
      title: 'Zero-Knowledge Privacy',
      description: 'Privacy-preserving verification without exposing sensitive transaction details.',
      details: 'Cryptographic proofs ensure validity while maintaining merchant and customer privacy.'
    },
    {
      icon: Zap,
      title: 'Sub-100ms Latency',
      description: 'Real-time WebSocket push notifications deliver verification results instantly.',
      details: 'Global CDN with edge computing ensures consistent performance across Kenya.'
    },
    {
      icon: Code,
      title: 'REST & WebSocket APIs',
      description: 'Developer-friendly APIs with comprehensive SDKs for seamless integration.',
      details: 'OpenAPI 3.0 specification with automatic client generation and extensive documentation.'
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Enterprise-Grade <span className="text-primary">Infrastructure</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Built with cutting-edge technology to handle millions of transactions
            with uncompromising security and performance.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {specs.map((spec, index) => (
            <div key={index} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <spec.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{spec.title}</h3>
              </div>
              <p className="text-muted-foreground mb-3">{spec.description}</p>
              <p className="text-sm text-muted-foreground">{spec.details}</p>
            </div>
          ))}
        </div>

        {/* 3D Animation Section */}
        <div className="mt-16 text-center">
          <div className="sketchfab-embed-wrapper max-w-4xl mx-auto">
            <iframe
              title="Modern Caltrans Traffic Signal Setup"
              frameBorder="0"
              allowFullScreen
              mozallowfullscreen="true"
              webkitallowfullscreen="true"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              xr-spatial-tracking=""
              execution-while-out-of-viewport=""
              execution-while-not-rendered=""
              web-share=""
              src="https://sketchfab.com/models/83a1c770e7584e01a9021487b130eee7/embed?ui_theme=dark"
              className="w-full h-96 rounded-lg"
            ></iframe>
            <p style={{ fontSize: '13px', fontWeight: 'normal', margin: '5px', color: '#4A4A4A' }}>
              <a
                href="https://sketchfab.com/3d-models/modern-caltrans-traffic-signal-setup-83a1c770e7584e01a9021487b130eee7?utm_medium=embed&utm_campaign=share-popup&utm_content=83a1c770e7584e01a9021487b130eee7"
                target="_blank"
                rel="nofollow"
                style={{ fontWeight: 'bold', color: '#1CAAD9' }}
              >
                Modern Caltrans Traffic Signal Setup
              </a>{' '}
              by{' '}
              <a
                href="https://sketchfab.com/raiseriggytherunkey?utm_medium=embed&utm_campaign=share-popup&utm_content=83a1c770e7584e01a9021487b130eee7"
                target="_blank"
                rel="nofollow"
                style={{ fontWeight: 'bold', color: '#1CAAD9' }}
              >
                YourLocalJavaCarDealer
              </a>{' '}
              on{' '}
              <a
                href="https://sketchfab.com?utm_medium=embed&utm_campaign=share-popup&utm_content=83a1c770e7584e01a9021487b130eee7"
                target="_blank"
                rel="nofollow"
                style={{ fontWeight: 'bold', color: '#1CAAD9' }}
              >
                Sketchfab
              </a>
            </p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-16 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-8 border border-primary/10">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-2">Performance Metrics</h3>
            <p className="text-muted-foreground">Real-world performance benchmarks</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">&lt;100ms</div>
              <div className="text-sm text-muted-foreground">Average Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">99.99%</div>
              <div className="text-sm text-muted-foreground">Uptime SLA</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">10M+</div>
              <div className="text-sm text-muted-foreground">Transactions/Month</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">0.01%</div>
              <div className="text-sm text-muted-foreground">False Positive Rate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnicalSpecs;