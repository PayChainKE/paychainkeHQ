import React, { useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import TrustBar from '@/components/TrustBar'
import './about.css'
import initAbout from './about.js'

/*
  About.tsx
  - Production-ready About page component for PayChain
  - Semantic HTML, accessibility-focused, imports BEM CSS and animation JS
  - Injects Open Graph meta and Organization JSON-LD on mount
*/

export default function About(): JSX.Element {
  useEffect(() => {
    // Initialize animations and interaction handlers defined in about.js
    // about.js respects prefers-reduced-motion and cleans up observers/listeners on return
    const cleanup = initAbout()

    // Inject OG meta tags and JSON-LD for Organization (idempotent)
    if (!document.querySelector('meta[property="og:title"][content="About PayChain — Built in Kenya for Kenya\'s Merchants"]')) {
      const ogs: { rel?: string; prop?: string; content: string }[] = [
        { prop: 'og:title', content: "About PayChain — Built in Kenya's Merchants" },
        { prop: 'og:description', content: 'PayChain is a Nairobi-born fintech company building Kenya\'s most trusted merchant OS — verified payments, bulk pay, KES→USDC swaps, and data-driven cash advances.' },
        { prop: 'og:url', content: 'https://www.paychain.co.ke/about' },
        { prop: 'og:image', content: '/assets/og-about.jpg' }
      ]
      ogs.forEach(o => {
        const m = document.createElement('meta')
        if (o.prop) m.setAttribute('property', o.prop)
        m.setAttribute('content', o.content)
        document.head.appendChild(m)
      })

      // Schema.org Organization structured data
      const ld = document.createElement('script')
      ld.type = 'application/ld+json'
      ld.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'PayChain',
        url: 'https://www.paychain.co.ke',
        logo: 'https://www.paychain.co.ke/assets/logo.png',
        sameAs: ['https://twitter.com/paychainke']
      })
      document.head.appendChild(ld)
    }

    // Preload display font for hero headline to avoid CLS
    if (!document.querySelector('link[data-paychain-preload]')) {
      const link = document.createElement('link')
      link.setAttribute('data-paychain-preload', '1')
      link.rel = 'preload'
      link.as = 'font'
      link.href = '/fonts/Fraunces.woff2'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }

    return () => cleanup && cleanup()
  }, [])

  return (
    <div className="about">
      <Navbar />

      {/* HERO SECTION: immersive, full-bleed */}
      <header className="about__hero" role="banner" aria-labelledby="about-hero-title">
        <div className="about__hero-bg" aria-hidden></div>
        <div className="about__hero-inner">
          
          <h1 id="about-hero-title" className="about__headline force-accent">
            <span className="about__headline-line">We Saw What the System Was Doing to Kenya's Merchants.</span>
            <span className="about__headline-line">We Decided to Fix It.</span>
          </h1>
          <p className="about__subhead">PayChain is a Nairobi-born fintech company on a mission to give every Kenyan merchant the financial infrastructure they deserve — verified, intelligent, and built entirely around how business actually works in Kenya.</p>
        </div>
      </header>

      <main className="about__main" id="content">
        {/* OPENING STATEMENT */}
        <section className="about__opening" aria-labelledby="opening-quote">
          <blockquote className="about__pullquote" id="opening-quote">
            <span className="about__quote-mark">“</span>
            Millions of Kenyan merchants move billions of shillings every single day. They are the engine of this economy. And yet the system built around them was never actually built for them.
          </blockquote>

          <div className="about__opening-body">
            <p>That is the sentence that started PayChain. Not a market report. Not a pitch deck. Not a slide about TAM. A simple, uncomfortable truth that anyone who has spent time in Kenyan markets already knew.</p>
            <p>The SMS verification system is broken. The shilling keeps sliding. The banks keep saying no. Every tool a Kenyan merchant needs lives in a different app — fragmented, inefficient, and designed for someone else.</p>
            <p>PayChain was not born in a boardroom. It was born out of proximity to that frustration. And it is being built to eliminate it — permanently.</p>
          </div>
        </section>

        {/* STATS */}
        <section className="about__stats" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="about__section-title">The Problem, in Numbers</h2>
          <ul className="about__stats-grid force-accent" role="list">
            <li className="about__stat" data-count="7400000">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>7,400,000</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>Registered SMEs in Kenya</div>
              <div className="about__stat-desc">The largest untapped merchant fintech market on the continent.</div>
            </li>
            {/* Shilling depreciation stat removed per request */}
            {/* Removed per request: M-PESA SMS fraud stat */}
            {/* Formal credit access stat removed per request */}

            {/* Added stats requested */}
            <li className="about__stat" data-count="83" data-suffix="%">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>83%</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>of transactions in Kenya happen via mobile money</div>
              <div className="about__stat-desc">Mobile money is the dominant payment rail across Kenya.</div>
            </li>

            <li className="about__stat" data-count="70" data-suffix="%">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>70%</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>of Kenyan SMEs lack access to formal credit</div>
              <div className="about__stat-desc">A widespread access gap constraining business growth.</div>
            </li>

            <li className="about__stat" data-count="20" data-suffix="%">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>20%</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>KES lost 20% of its value against the dollar in the last 3 years</div>
              <div className="about__stat-desc">Currency depreciation directly reduces merchant margins.</div>
            </li>

            <li className="about__stat" data-count="5" data-prefix="<" data-suffix="%">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>&lt;5%</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>Less than 5% of SMEs use more than one financial tool</div>
              <div className="about__stat-desc">Most merchants remain locked into a single, fragmented workflow.</div>
            </li>

            <li className="about__stat" data-count="5000">
              <div className="about__stat-value" style={{ color: 'var(--accent)' }}>5,000</div>
              <div className="about__stat-label" style={{ color: 'var(--accent)' }}>Target: 5,000 merchants by end of Year 1</div>
              <div className="about__stat-desc">Year‑1 adoption target for the public launch.</div>
            </li>
          </ul>
        </section>

        {/* OUR STORY */}
        <section className="about__story" aria-labelledby="story-heading">
          <div className="about__story-inner">
            <div className="about__story-text">
              <h2 id="story-heading" className="about__section-title">How PayChain Came to Be</h2>
              <p className="about__story-sub">Built in Kenya. Engineered for Kenya. Refusing to apologize for either.</p>

              <article className="about__story-block" data-anim>
                <div className="about__eyebrow-small">The Observation</div>
                <p>The starting point was not a technology. It was an observation — that the merchants running Kenya's most active markets were being failed, quietly and consistently, by the infrastructure that was supposed to help them. M-PESA changed everything. And then it stopped. The SMS confirmation that was revolutionary in 2007 is now the most exploited vulnerability in Kenyan commerce. Verification technology exists to fix it. Nobody had fixed it.</p>
              </article>

              <article className="about__story-block" data-anim>
                <div className="about__eyebrow-small">The Decision</div>
                <p>The decision to build PayChain was simple: the tools exist, the infrastructure exists, the market exists — the only thing missing was a team willing to put them together specifically for the Kenyan merchant. Not a watered-down version of a product designed for London or San Francisco. Something designed from the ground up for Nairobi, Juja, Mombasa, Kisumu, and every market in between.</p>
              </article>

              <article className="about__story-block" data-anim>
                <div className="about__eyebrow-small">The Build</div>
                <p>We started with verified payment collection and built outward. Bulk Pay, because merchants drowning in manual transfers needed relief. The Inflation Shield, because watching the shilling depreciate while holding KES is a tax on hard work nobody signed up for. Cash Advance, because the most powerful thing you can do for a growing business is give it access to its own future revenue — based on what it earns, not the paperwork it can produce.</p>
              </article>
            </div>

            <div className="about__story-deco" aria-hidden>
              <div className="about__deco-vertical">01</div>
            </div>
          </div>
        </section>

        {/* MISSION & VISION */}
        <section className="about__mission-vision" aria-labelledby="mv-heading">
          <h2 id="mv-heading" className="sr-only">Mission and Vision</h2>
          <div className="about__mv-grid">
            <div className="about__mv-card about__mv-card--mission">
              <div className="about__eyebrow-small">Our Mission</div>
              <p>To eliminate financial fragmentation and the digital trust deficit holding Kenyan SMEs back — by building the most trusted, most intelligent, and most accessible merchant operating system in Kenya.</p>
            </div>
            <div className="about__mv-card about__mv-card--vision">
              <div className="about__eyebrow-small">Our Vision</div>
              <p>A Kenya where every merchant — from the Jua Kali artisan in Gikomba to the import trader clearing goods at Mombasa port — has access to verified payments, stable financial tools, and credit built on the truth of their business. Not on who they know. Not on what they own. On what they have built.</p>
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className="about__values" aria-labelledby="values-heading">
          <h2 id="values-heading" className="about__section-title">What We Actually Believe</h2>
          <p className="about__values-sub">These are not values designed for a company brochure. They are the decisions we make when the easy choice and the right choice are not the same thing.</p>

          <ol className="about__values-list">
            <li className="about__value" data-anim>
              <div className="about__value-number">01</div>
              <div className="about__value-body">
                <div className="about__value-title">Truth Over Everything</div>
                <p>Every product we build is designed to surface the truth — the truth of a payment, the truth of a merchant's revenue, the truth of what credit should cost. In an environment where SMS fraud, opaque fees, and information asymmetry are standard practice, we have chosen to build the opposite. Transparency is not a feature. It is the architecture.</p>
              </div>
            </li>

            <li className="about__value" data-anim>
              <div className="about__value-number">02</div>
              <div className="about__value-body">
                <div className="about__value-title">The Merchant Is the Product</div>
                <p>In traditional finance, the merchant is valuable when their account grows, disposable when it doesn't. At PayChain, the merchant's success is the only metric that matters. Every feature, every design decision, every line of code is evaluated against one question: does this make a Kenyan merchant's life measurably better? If the answer is no, we do not ship it.</p>
              </div>
            </li>

            <li className="about__value" data-anim>
              <div className="about__value-number">03</div>
              <div className="about__value-body">
                <div className="about__value-title">Security Is Not a Feature. It Is the Foundation.</div>
                <p>We are building financial infrastructure. There is no version of that responsibility that allows for shortcuts on security. Every transaction that flows through PayChain is verified, logged, encrypted, and protected at institutional grade. We will never trade security for speed, convenience, or cost.</p>
              </div>
            </li>

            <li className="about__value" data-anim>
              <div className="about__value-number">04</div>
              <div className="about__value-body">
                <div className="about__value-title">Built Here. Built for Here.</div>
                <p>Kenya is not a developing market version of somewhere else. It is a sophisticated, complex, fast-moving economy with its own infrastructure and its own needs. PayChain is not localized for Kenya. It was built in Kenya — from the first line of code — designed to reflect the reality of how business actually works here.</p>
              </div>
            </li>

            <li className="about__value" data-anim>
              <div className="about__value-number">05</div>
              <div className="about__value-body">
                <div className="about__value-title">Data Belongs to the Merchant</div>
                <p>The transaction history that flows through PayChain belongs to the merchant who earned it. We use it — with consent — to build their Trust Score and unlock their Cash Advance. We do not sell it, share it, or use it for anything the merchant has not agreed to. In a world where data is the new oil, we have chosen to put that oil in the merchant's own hands.</p>
              </div>
            </li>

            <li className="about__value" data-anim>
              <div className="about__value-number">06</div>
              <div className="about__value-body">
                <div className="about__value-title">We Are Playing a Long Game</div>
                <p>PayChain is not optimized for the next quarter. It is optimized for the next decade. Every merchant, every transaction, every Trust Score — these are the compounding foundations of something that will matter in Kenya for a very long time. We are building accordingly.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* ROADMAP */}
        <section className="about__roadmap" aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className="about__section-title">Where We Are. Where We Are Going.</h2>
          <div className="about__timeline" aria-hidden>
            <div className="about__timeline-line" />
            <ol className="about__timeline-list">
              <li className="about__timeline-item about__timeline-item--active" data-node>
                <div className="about__timeline-node">1</div>
                <div className="about__timeline-content">
                  <div className="about__timeline-title">Build (Now → Q2 2026)</div>
                  <div className="about__timeline-badge">In Progress</div>
                  <p>Engineering underway. M-PESA Daraja API integration in development. Base Network blockchain rails configured. Merchant dashboard UI being built. CBK licensing initiated.</p>
                </div>
              </li>

              <li className="about__timeline-item" data-node>
                <div className="about__timeline-node">2</div>
                <div className="about__timeline-content">
                  <div className="about__timeline-title">Closed Beta (Q2 2026)</div>
                  <p>Hand-selected Nairobi and Juja merchants gain full platform access. Real transactions. Real Trust Scores. Real feedback shaping the product before public launch.</p>
                </div>
              </li>

              <li className="about__timeline-item" data-node>
                <div className="about__timeline-node">3</div>
                <div className="about__timeline-content">
                  <div className="about__timeline-title">Public Launch (Q3 2026)</div>
                  <p>PayChain opens to all Kenyan merchants. Target: 5,000 merchants in Year 1. Full product suite live from Day 1.</p>
                </div>
              </li>

              <li className="about__timeline-item" data-node>
                <div className="about__timeline-node">4</div>
                <div className="about__timeline-content">
                  <div className="about__timeline-title">Regional Expansion (Year 2–3)</div>
                  <p>Mombasa, Kisumu, and Nakuru in Year 2. Uganda and Tanzania in Year 3.</p>
                </div>
              </li>

              <li className="about__timeline-item" data-node>
                <div className="about__timeline-node">5</div>
                <div className="about__timeline-content">
                  <div className="about__timeline-title">Pan-African Infrastructure (Year 4–5)</div>
                  <p>1,000,000+ merchants. The dominant hybrid payment service provider for African SMEs.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* TRUST & INFRASTRUCTURE */}
      

        {/* CTA */}
        <section className="about__cta" aria-labelledby="cta-heading">
          <h2 id="cta-heading" className="about__cta-title">If You Believe Kenyan Merchants Deserve Better Infrastructure, We Should Talk.</h2>
          <p className="about__cta-body">Whether you are a merchant ready for early access, an investor who sees what we see in this market, a strategic partner looking to plug into Kenya's next payment infrastructure, or a talented operator who wants to build something that matters — we want to hear from you.</p>

          <div className="about__cta-actions">
            <a className="btn btn--primary" href="/waitlist" aria-label="Join the Beta Waitlist">Join the Beta Waitlist →</a>
          </div>
        </section>
      </main>

      <section className="about__supporting">
        <TrustBar />
      </section>

      <Footer />
    </div>
  )
}

