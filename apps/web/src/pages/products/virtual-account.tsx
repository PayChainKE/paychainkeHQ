import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Activity,
  Database,
  Building2,
  GitMerge,
  TrendingUp,
  Check,
} from 'lucide-react';
import './virtual-account.css';
import useVirtualAccountAnimations from './useVirtualAccountAnimations';
import Breadcrumbs from '@/components/Breadcrumbs';

const features = [
  {
    title: 'Verified Inbound Payments',
    icon: ShieldCheck,
    desc: 'Every payment verified against Safaricom Daraja API before confirmation. Fake screenshots are impossible.',
  },
  {
    title: 'Real-Time Dashboard Confirmation',
    icon: Activity,
    desc: 'The moment a customer pays, it appears on your dashboard with amount, timestamp, phone number, and reference.',
  },
  {
    title: 'Immutable Transaction Ledger',
    icon: Database,
    desc: 'Every payment logged on blockchain rails — a permanent, tamper-proof record that builds your Trust Score.',
  },
  {
    title: 'Aggregator-Backed Virtual Account',
    icon: Building2,
    desc: 'Registered through a licensed payment aggregator — institutional credibility behind every transaction.',
  },
  {
    title: 'Hybrid M-PESA + Blockchain Rails',
    icon: GitMerge,
    desc: 'M-PESA reach. Blockchain security. You get both without needing to understand either.',
  },
  {
    title: 'Automatic Trust Score Building',
    icon: TrendingUp,
    desc: 'Every verified collection builds your credit profile. 3 months unlocks your Cash Advance eligibility.',
  },
];

const VirtualAccount: React.FC = () => {
  useVirtualAccountAnimations();

  return (
    <div className="virtual-account-page bg-background text-foreground min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Breadcrumbs currentPage="PayChain Virtual Account" />

        {/* HERO */}
        <section className="virtual-account__hero grid lg:grid-cols-2 gap-12 items-center md:mt-8" aria-labelledby="va-hero-title">
          <div>
            <h1 id="va-hero-title" className="mt-[1cm] text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4">Your Account. Verified. Secured. Intelligent.</h1>
            <p className="text-lg text-muted-foreground mb-6">The PayChain Virtual Account replaces your basic M-PESA till with a registered, aggregator-backed payment channel that kills SMS fraud, logs every shilling, and builds your business credit — automatically.</p>

            <div className="flex gap-3">
              <div className="bg-primary/30 border border-primary/40 rounded-lg p-1 inline-flex">
                <Link to="/waitlist" className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg h-10">Get Your Virtual Account</Link>
              </div>
            </div>
          </div>

          <div className="hero-visual hidden md:block" aria-hidden="true" data-animate>
            <svg className="account-svg" viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Payment notification animation">





              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="#94A3B8" />
                </marker>
              </defs>
            </svg>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="virtual-account__problem mt-16 p-8 rounded-lg" data-animate>
          <h2 className="text-2xl font-semibold mb-3">The SMS Till Is Broken. And Fraudsters Know It.</h2>
          <p className="text-base text-white/90">Every day, Kenyan merchants lose money to one of the oldest tricks in the book — a fake M-PESA confirmation SMS. A customer shows a screenshot. You believe it. The money was never sent. Basic M-PESA tills were never designed to protect you. They were designed to move money. The PayChain Virtual Account was designed to do both.</p>
        </section>

        {/* EXPLAINER */}
        <section className="virtual-account__explainer grid lg:grid-cols-2 gap-8 mt-12 items-center">
          <div data-animate>
            <h2 className="text-2xl font-semibold mb-3">One Account. Two Rails. Zero Fraud.</h2>
            <p className="text-base text-muted-foreground">The PayChain Virtual Account operates across both M-PESA infrastructure and blockchain rails simultaneously — giving you the familiarity of M-PESA with the security of blockchain confirmation. Every inbound payment is confirmed on the Safaricom Daraja API in real time, logged on-chain for a tamper-proof record, instantly visible on your dashboard, and automatically added to your Trust Score.</p>
          </div>

          <div className="explainer-diagram" data-animate aria-hidden>
            <svg viewBox="0 0 380 200" className="diagram-svg" role="img" aria-label="Dual rail flow diagram">
              <rect x="10" y="20" rx="8" width="110" height="40" fill="#fff" className="box" />

              <rect x="140" y="20" rx="8" width="110" height="40" fill="#fff" className="box" />

              <rect x="270" y="20" rx="8" width="100" height="40" fill="#fff" className="box" />

              <path d="M120 40 L140 40" stroke="#94A3B8" strokeWidth="2" markerEnd="url(#a)" />
              <path d="M250 40 L270 40" stroke="#94A3B8" strokeWidth="2" markerEnd="url(#a)" />

              <defs>
                <marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="#94A3B8" />
                </marker>
              </defs>
            </svg>
          </div>
        </section>

        {/* FEATURES */}
        <section className="virtual-account__features mt-12" aria-labelledby="features-title">
          <h2 id="features-title" className="text-2xl font-semibold mb-6">Everything Your Account Should Have Always Done</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="feature-card p-6 rounded-2xl shadow-sm" data-animate>
                  <div className="icon-wrap mb-3"><Icon className="w-6 h-6 text-primary" aria-hidden /></div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="virtual-account__how mt-12" aria-labelledby="how-title">
          <h2 id="how-title" className="text-2xl font-semibold mb-6">How it works</h2>
          <ol className="steps-list grid sm:grid-cols-3 gap-6">
            <li className="step p-4 rounded-lg shadow-sm" data-animate>
              <div className="step-num">1</div>
              <h4 className="font-semibold">Get Verified</h4>
              <p className="text-sm text-muted-foreground">Complete KYC and receive your dedicated PayChain Virtual Account — backed by a licensed aggregator.</p>
            </li>
            <li className="step p-4 rounded-lg shadow-sm" data-animate>
              <div className="step-num">2</div>
              <h4 className="font-semibold">Share & Collect</h4>
              <p className="text-sm text-muted-foreground">Customers pay via M-PESA as normal. You see confirmed payment on your dashboard instantly — no SMS needed.</p>
            </li>
            <li className="step p-4 rounded-lg shadow-sm" data-animate>
              <div className="step-num">3</div>
              <h4 className="font-semibold">Build & Grow</h4>
              <p className="text-sm text-muted-foreground">Every transaction builds your Trust Score and working capital eligibility automatically.</p>
            </li>
          </ol>
        </section>

        {/* COMPARISON */}
        <section className="virtual-account__compare mt-12 p-6 rounded-lg" aria-labelledby="compare-title">
          <h2 id="compare-title" className="text-2xl font-semibold mb-6">PayChain Virtual Account vs Basic M-PESA Till</h2>
          <div className="overflow-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="text-left w-1/3 text-sm text-muted-foreground">Feature</th>
                  <th className="text-left text-sm">Basic M-PESA Till</th>
                  <th className="text-left text-sm">PayChain Virtual Account <span className="badge">Recommended</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Payment verification</td>
                  <td className="py-3 text-sm text-muted-foreground">SMS confirmation</td>
                  <td className="py-3 text-sm text-primary">Daraja API + blockchain</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Fraud protection</td>
                  <td className="py-3 text-sm text-muted-foreground">None</td>
                  <td className="py-3 text-sm text-primary">Real-time fraud elimination</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Transaction records</td>
                  <td className="py-3 text-sm text-muted-foreground">SMS inbox</td>
                  <td className="py-3 text-sm text-primary">Immutable digital ledger</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Business credit building</td>
                  <td className="py-3 text-sm text-muted-foreground">No</td>
                  <td className="py-3 text-sm text-primary">Yes — automatic Trust Score</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Dashboard visibility</td>
                  <td className="py-3 text-sm text-muted-foreground">No</td>
                  <td className="py-3 text-sm text-primary">Real-time, full history</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">Regulatory backing</td>
                  <td className="py-3 text-sm text-muted-foreground">Basic</td>
                  <td className="py-3 text-sm text-primary">Licensed aggregator</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="virtual-account__cta mt-12 text-center p-12 rounded-2xl" data-animate>
          <h2 className="text-2xl font-semibold mb-3">Stop Trusting Screenshots. Start Running a Verified Business.</h2>
          <p className="text-muted-foreground mb-6">Join our closed beta launching Q2 2026. Limited spots for Nairobi merchants.</p>
          <div className="inline-flex bg-primary/30 border border-primary/40 rounded-lg p-1">
            <Link to="/waitlist" className="btn-primary px-5 py-2 rounded-lg h-10">Get Early Access</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default VirtualAccount;

/*
  Inline notes / decisions:
  - Uses lightweight SVGs for hero and explainer to avoid large images and match site's minimal aesthetic.
  - Animations (scroll reveal + simple SVG play) are initialized in `useVirtualAccountAnimations.ts` so logic is testable and isolated.
  - Icons use `lucide-react` components consistent with the rest of the site.
  - Semantic sections and ARIA labels added for accessibility.
*/
