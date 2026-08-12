
import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '@/pages/how-it-works.css';
import { UserCheck, ShieldCheck, CreditCard, Zap, Users, Repeat, BarChart3, Star } from 'lucide-react';

// Lucide icons via CDN in index.html or use inline SVGs for production
// All animations and Trust Score handled in how-it-works.js

const steps = [
  {
    title: 'Sign Up & Get Verified',
    desc: 'Create your PayChain merchant account and complete a simple KYC verification. Once approved, you receive your registered PayChain Virtual Account — a dedicated, aggregator-backed M-PESA channel that is fully secure and verified. No queues. No paperwork. Verification is digital, fast, and done entirely on your dashboard.',
    Icon: UserCheck,
  },
  {
    title: 'Start Collecting Payments Securely',
    desc: 'Share your PayChain Virtual Account with customers and start receiving verified inbound payments instantly. Every transaction is logged, timestamped, and stored in your merchant ledger — creating an unbreakable record of your real business activity. No more fake screenshots. No more SMS fraud.',
    Icon: ShieldCheck,
  },
  {
    title: 'Pay, Convert & Manage Your Money',
    desc: 'From one dashboard, run payroll via Bulk Pay, swap KES to USDC to protect against shilling depreciation, pay international suppliers in stablecoin, and manage team spending — all in one verified, auditable system.',
    Icon: CreditCard,
  },
  {
    title: 'Unlock Your Cash Advance',
    desc: 'After 3 months of verified PayChain transaction history, your business automatically qualifies for a PayChain Cash Advance. We use your real transaction data — not collateral, not land titles — to determine your working capital limit.',
    Icon: Zap,
  },
];

const features = [
  {
    title: 'Verified Virtual Account',
    desc: 'Fraud-proof M-PESA collections, every time',
    Icon: ShieldCheck,
  },
  {
    title: 'Bulk Pay',
    desc: 'Payroll & supplier payments in one click',
    Icon: Users,
  },
  {
    title: 'KES → USDC Swap',
    desc: 'Protect purchasing power from shilling drops',
    Icon: Repeat,
  },
  {
    title: 'Real-Time Dashboard',
    desc: 'Full visibility of every shilling in and out',
    Icon: BarChart3,
  },
  {
    title: 'Trust Score',
    desc: 'Your transaction history becomes your credit',
    Icon: Star,
  },
  {
    title: 'Cash Advance',
    desc: 'Working capital without collateral',
    Icon: Zap,
  },
];

const timeline = [
  { label: 'Day 1', desc: 'Verified Collections + Bulk Pay + FX Swaps unlocked' },
  { label: 'Month 3', desc: 'Cash Advance eligibility unlocked' },
  { label: 'Ongoing', desc: 'Trust Score grows, credit limits increase' },
];

const HowItWorks: React.FC = () => {
  useEffect(() => {
    // Scroll reveal + Trust Score animation (client-side only)
    const elements = Array.from(document.querySelectorAll('.fadein-up'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      elements.forEach(el => el.classList.add('visible'));
      const _bar = document.getElementById('trustscore-bar');
      const _label = document.getElementById('trustscore-label');
      if (_bar && _bar.style && typeof _bar.style.setProperty === 'function') {
        _bar.style.setProperty('width', '85%');
      }
      if (_label) _label.textContent = '85';
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      const visibleEntries = entries.filter(e => e.isIntersecting);
      visibleEntries.sort((a, b) => {
        const ai = elements.indexOf(a.target);
        const bi = elements.indexOf(b.target);
        return ai - bi;
      });
      visibleEntries.forEach((entry, idx) => {
        setTimeout(() => {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
          const nums = entry.target.querySelectorAll('.step-number');
          nums.forEach((n, i) => setTimeout(() => n.classList.add('visible'), i * 120));
        }, idx * 140);
      });
    }, { threshold: 0.18 });

    elements.forEach(el => observer.observe(el));

    // Trust Score meter
    const trustBar = document.getElementById('trustscore-bar');
    const trustLabel = document.getElementById('trustscore-label');
    if (trustBar && trustLabel) {
      let started = false;
      const trustObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !started) {
            started = true;
            let val = 0;
            const target = 85;
            trustBar.style.width = '0%';
            trustLabel.textContent = '0';
            const stepTime = 12;
            const interval = setInterval(() => {
              val += 1;
              trustBar.style.width = val + '%';
              trustLabel.textContent = val.toString();
              if (val >= target) clearInterval(interval);
            }, stepTime);
          }
        });
      }, { threshold: 0.5 });
      trustObs.observe(trustBar);
    }
    // cleanup
    return () => {
      // no-op; IntersectionObservers are GC'd with elements unobserved on navigation
    };
  }, []);

  return (
    <div className="howitworks-root min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="howitworks-main mx-auto max-w-[1200px] px-4 sm:px-8">
        {/* HERO SECTION */}
        <section className="howitworks-hero pt-24 pb-20 flex flex-col items-center text-center fadein-up">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-primary-foreground leading-tight">
            One Dashboard. Everything Your Business Needs to Move Money.
          </h1>
          <p className="font-sans text-lg md:text-xl max-w-2xl mb-8 text-muted-foreground">
            PayChain replaces five fragmented tools with one verified, intelligent merchant operating system — built on M-PESA infrastructure and blockchain rails.
          </p>
          <a href="https://app.paychain.co.ke" className="howitworks-cta-btn inline-block px-8 py-4 rounded-lg font-semibold text-lg bg-primary text-primary-foreground shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:scale-105 hover:shadow-xl hover:glow-green" aria-label="Sign Up">
            Sign Up
          </a>
        </section>

        {/* 4-STEP HOW IT WORKS FLOW */}
        <section className="howitworks-steps py-20 fadein-up">
          <ol className="howitworks-steps-list flex flex-col md:flex-row md:justify-between gap-16 md:gap-0 relative">
            {steps.map((step, i) => {
              const Icon = step.Icon;
              return (
                <li key={step.title} className="howitworks-step flex-1 flex flex-col items-center md:items-start text-center md:text-left relative z-10">
                  <div className="howitworks-step-icon mb-4 flex flex-col items-center">
                    <span className="step-number" aria-label={`Step ${i+1}`}>{i+1}</span>
                    <span className="step-icon mt-2" aria-hidden="true">
                      <Icon size={32} strokeWidth={2.2} className="text-primary" />
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold mb-3 text-primary-foreground">{step.title}</h3>
                  <p className="font-sans text-base text-muted-foreground max-w-xs">{step.desc}</p>
                  {i < steps.length - 1 && (
                    <span className="howitworks-step-connector md:block hidden absolute top-8 right-0 left-auto w-[calc(100%+32px)] h-1 bg-gradient-to-r from-primary/30 to-primary/80 z-0" aria-hidden="true"></span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* TRUST SCORE CALLOUT SECTION */}
        <section className="howitworks-trustscore py-24 bg-secondary text-secondary-foreground text-center fadein-up">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Every Transaction Builds Your Trust Score</h2>
          <p className="font-sans text-lg max-w-2xl mx-auto mb-10">
            PayChain converts your verified payment history into a proprietary Trust Score — a real-time measure of your business's financial health and creditworthiness. The longer you use PayChain, the more working capital you can unlock. This is credit built on truth — not collateral.
          </p>
          <div className="howitworks-trustscore-meter mx-auto my-8" aria-label="Trust Score Meter">
            <div className="trustscore-meter-bg">
              <div className="trustscore-meter-bar" id="trustscore-bar" style={{ width: '0%' }}></div>
            </div>
            <span className="trustscore-meter-label" id="trustscore-label">0</span>
          </div>
        </section>

        {/* FEATURES SUMMARY SECTION */}
        <section className="howitworks-features py-24 fadein-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {features.map((f) => {
              const Icon = f.Icon;
              return (
                <article key={f.title} className="howitworks-feature-card bg-card rounded-2xl shadow-card p-8 flex flex-col items-center text-center">
                  <span className="feature-icon mb-4">
                    <Icon size={32} strokeWidth={2.2} className="text-primary" />
                  </span>
                  <h3 className="font-serif text-xl font-bold mb-2 text-primary-foreground">{f.title}</h3>
                  <p className="font-sans text-base text-muted-foreground">{f.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* TIMELINE SECTION */}
        <section className="howitworks-timeline py-24 fadein-up">
          <div className="timeline-container flex flex-col md:flex-row items-center justify-center gap-12 md:gap-0">
            {timeline.map((t, i) => (
              <div key={t.label} className="timeline-step flex flex-col items-center md:items-start text-center md:text-left relative">
                <span className="timeline-label font-serif text-lg font-bold mb-2 text-primary-foreground">{t.label}</span>
                <span className="timeline-desc font-sans text-base text-muted-foreground mb-2">{t.desc}</span>
                {i < timeline.length - 1 && (
                  <span className="timeline-connector hidden md:block absolute top-4 right-[-60px] w-[120px] h-1 bg-gradient-to-r from-primary/30 to-primary/80 z-0" aria-hidden="true"></span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="howitworks-cta py-24 text-center fadein-up">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Ready to Run Your Business on Better Infrastructure?</h2>
          <p className="font-sans text-lg max-w-2xl mx-auto mb-8">Sign up in minutes and start accepting payments today.</p>
          <a href="https://app.paychain.co.ke" className="howitworks-cta-btn inline-block px-8 py-4 rounded-lg font-semibold text-lg bg-primary text-primary-foreground shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:scale-105 hover:shadow-xl hover:glow-green" aria-label="Sign Up">
            Sign Up
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default HowItWorks;