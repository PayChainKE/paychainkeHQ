import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import {
  Repeat, Percent, Send, Shield, Wallet, Zap,
} from 'lucide-react';
import './inflation-shield.css';
import useInflationAnimations from './useInflationAnimations';

const features = [
  { title: 'Instant KES → USDC Swaps', icon: Repeat, desc: 'Convert your KES balance to USDC in seconds from your dashboard. No queues, no negotiation.' },
  { title: 'Transparent 0.5% FX Rate', icon: Percent, desc: 'Flat 0.5% spread on all conversions. You see the exact rate before you confirm — no hidden fees.' },
  { title: 'Pay International Suppliers in USDC', icon: Send, desc: 'Send USDC directly to international suppliers. No wire transfers, no SWIFT fees, no bank delays.' },
  { title: 'Auto-Hedge Above a Threshold', icon: Shield, desc: 'Set a KES threshold — PayChain automatically converts surplus to USDC, protecting your purchasing power hands-free.' },
  { title: 'Hybrid KES + USDC Balance', icon: Wallet, desc: 'See and manage both currencies on one dashboard. Switch between them instantly as your business needs change.' },
  { title: 'Blockchain-Settled Transfers', icon: Zap, desc: 'All USDC transfers settle on Base Network — fast, cheap, and traceable. Under 10 seconds. Fraction of wire transfer cost.' },
];

const InflationShield: React.FC = () => {
  useInflationAnimations();

  return (
    <div className="inflation-page bg-background text-foreground min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* HERO */}
        <section className="inflation-hero grid lg:grid-cols-2 gap-10 items-center" aria-labelledby="inflation-hero-title" data-animate>
          <div>
            <h1 id="inflation-hero-title" className="mt-[2cm] text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4">Stop Watching Your Profits Disappear with the Shilling.</h1>
            <p className="text-lg text-muted-foreground mb-6">The PayChain Inflation Shield lets you swap KES to USDC instantly — protecting your purchasing power, paying international suppliers in stablecoin, and hedging shilling depreciation without ever visiting a forex bureau.</p>
            <div className="flex gap-3">
              <div className="inline-flex bg-primary/30 border border-primary/40 rounded-lg p-1">
                <Link to="/waitlist" className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg h-10">Protect Your Money</Link>
              </div>
            </div>
          </div>

          <div className="hero-chart" aria-hidden="true">
            <svg viewBox="0 0 320 180" className="chart-svg" role="img" aria-label="Inflation shield chart">
              <defs>
                <linearGradient id="kesGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="usdcGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
              </defs>
              <g transform="translate(10,10)">
                <path className="kes-line" d="M0,20 L40,36 L80,44 L120,70 L160,88 L200,110 L240,125 L300,140" fill="none" stroke="url(#kesGrad)" strokeWidth="3" strokeLinecap="round" />
                <path className="usdc-line" d="M0,40 L60,40 L120,40 L180,40 L240,40 L300,40" fill="none" stroke="url(#usdcGrad)" strokeWidth="3" strokeLinecap="round" />
                <g className="legend">
                  <rect x="6" y="100" width="10" height="6" fill="url(#kesGrad)" />
                  <text x="22" y="106" className="legend-text">KES (declining)</text>
                  <rect x="6" y="116" width="10" height="6" fill="url(#usdcGrad)" />
                  <text x="22" y="122" className="legend-text">USDC (stable)</text>
                </g>
              </g>
            </svg>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="problem-section mt-12 p-8 rounded-lg" data-animate>
          <h2 className="text-2xl font-semibold mb-3">The Shilling Lost Over 30% of Its Value in 3 Years. Your Business Felt Every Drop.</h2>
          <p className="text-base text-white/90 mb-6">Kenyan merchants who import goods, pay international suppliers, or simply hold cash in KES are quietly losing wealth every month — not through bad decisions, but through currency depreciation they have no control over. The options have always been bad: visit a forex bureau with unpredictable rates, hold USD in a bank account with high minimums, or just absorb the loss. There is now a fourth option.</p>
          <div className="pull-stat">30% depreciation</div>
        </section>

        {/* EXPLAINER */}
        <section className="explainer grid lg:grid-cols-2 gap-8 mt-12 items-start" data-animate>
          <div>
            <h3 className="text-2xl font-semibold mb-3">Your Purchasing Power, Protected.</h3>
            <p className="text-base text-muted-foreground">The PayChain Inflation Shield is a built-in KES-to-USDC conversion engine that lets you swap your KES balance to USDC stablecoin directly from your dashboard — at a transparent 0.5% rate with no forex bureau, no bank minimum, no waiting. USDC is a dollar-pegged stablecoin — its value tracks the US Dollar exactly, giving you a stable store of value that doesn't erode with the shilling.</p>
            <div className="usdc-callout mt-4">
              <button className="callout-toggle">What is USDC?</button>
              <div className="callout-body">USDC is a digital dollar. 1 USDC = $1 USD, always. It's issued by Circle, regulated in the US, and widely used globally.</div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-3">How it Works</h4>
            <ol className="steps-list">
              <li><strong>1 — Fund Your KES Balance:</strong> Collect payments through your PayChain Smart Till.</li>
              <li><strong>2 — Swap to USDC:</strong> Choose amount, see exact rate and fee, confirm. USDC balance updates instantly.</li>
              <li><strong>3 — Hold, Pay or Send:</strong> Hold USDC as stable savings, pay international suppliers, or convert back to KES when needed.</li>
            </ol>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features-section mt-12" data-animate>
          <h3 className="text-2xl font-semibold mb-6">Everything a Forex Bureau Does. Minus the Bureau.</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="feature-card p-6 rounded-2xl shadow-sm">
                  <div className="icon mb-3"><Icon className="w-6 h-6 text-amber-500" /></div>
                  <h4 className="font-semibold mb-2">{f.title}</h4>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* STATS */}
        <section className="stats-section mt-12" data-animate>
          <h3 className="text-2xl font-semibold mb-6">The Cost of Not Hedging</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card p-6 rounded-lg shadow-sm"><div className="stat-value" data-target="30">~0%</div><div className="stat-label">KES depreciation vs USD (2021–2024)</div></div>
            <div className="stat-card p-6 rounded-lg shadow-sm"><div className="stat-value" data-target="150000">KES 0</div><div className="stat-label">Purchasing power lost on KES 500K held in cash</div></div>
            <div className="stat-card p-6 rounded-lg shadow-sm"><div className="stat-value" data-target="0.5">0%</div><div className="stat-label">PayChain FX spread</div></div>
            <div className="stat-card p-6 rounded-lg shadow-sm"><div className="stat-value" data-target="10">0</div><div className="stat-label">USDC transfer time on Base Network</div></div>
          </div>
        </section>

        {/* WHO */}
        <section className="who-section mt-12" data-animate>
          <h3 className="text-2xl font-semibold mb-6">Built for Merchants Who Think Ahead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Import/Export Traders</h4> <p className="text-sm">Pay international suppliers in USDC without wire transfers or SWIFT delays.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">High Cash Flow Retail</h4> <p className="text-sm">Protect surplus KES from depreciation automatically.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Hospitality Businesses</h4> <p className="text-sm">Hold stable USDC reserves while running daily operations in KES.</p> </article>
            <article className="use-card p-4 rounded-lg"> <h4 className="font-semibold">Service Agencies</h4> <p className="text-sm">Receive and hold USDC from international clients, convert to KES when needed.</p> </article>
          </div>
        </section>

        {/* CTA */}
        <section className="final-cta mt-12 text-center p-12 rounded-2xl" data-animate>
          <h3 className="text-2xl font-semibold mb-3">Your Money Should Hold Its Value. Now It Can.</h3>
          <p className="text-muted-foreground mb-6">Join our closed beta launching Q2 2026.</p>
          <div className="inline-flex bg-primary/30 border border-primary/40 rounded-lg p-1 inline-block">
            <Link to="/waitlist" className="btn-primary px-5 py-2 rounded-lg h-10">Join the Waitlist</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default InflationShield;

