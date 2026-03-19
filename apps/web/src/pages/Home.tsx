import React, { useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import './home.css'
import initHome from './home.js'

/*
  Home.tsx
  - Homepage for PayChain
  - Uses existing `Hero` component (LOCKED) and implements the Key Tools section exactly
  - Other sections implemented per provided copy
  - Initializes animations and interactions from `home.js`
*/

export default function Home(): JSX.Element {
  useEffect(() => {
    const cleanup = initHome()
    return () => cleanup && cleanup()
  }, [])

  return (
    <div className="home">
      <Navbar />
      {/* HERO: locked — use existing component */}
      <Hero />

      {/* SOCIAL PROOF BAR */}
      <section className="home__social" aria-hidden>
        <div className="home__container">
          <div className="home__social-left">Trusted infrastructure:</div>
          <div className="home__social-divider" aria-hidden />
          <div className="home__social-items">
            <div className="trust-item">M-PESA Daraja API</div>
            <div className="trust-item">Base Network — Coinbase</div>
            <div className="trust-item">KRA e-TIMS</div>
            <div className="trust-item">CBK Licensed (Pursuing)</div>
            <div className="trust-item">256-bit Encryption</div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="home__problems" id="problems">
        <div className="home__container">
          <h3 className="home__eyebrow">The Real Cost of Broken Infrastructure</h3>
          <h2 className="home__headline">Kenya's Merchants Are Running on a System That Was Never Built for Them.</h2>
          <p className="home__sub">Three problems. Billions lost. One fix.</p>

          <div className="home__cards">
            <article className="home__card" data-anim>
              <div className="home__card-stat">Billions Lost</div>
              <div className="home__card-title">SMS Fraud Is Bleeding Kenyan Merchants Dry.</div>
              <div className="home__card-body">Every day, merchants across Kenya accept payments by reading an SMS notification — a system fraudsters have exploited for years. A fake confirmation. Goods leave the shop. Money never arrives.</div>
              <hr />
              <div className="home__card-fix-label">PayChain fix:</div>
              <div className="home__card-fix">Verified inbound payments via Safaricom Daraja API — confirmed on-chain in under 100ms. No SMS. No fraud.</div>
            </article>

            <article className="home__card" data-anim>
              <div className="home__card-stat">30%+</div>
              <div className="home__card-title">The Shilling Is Quietly Destroying Your Purchasing Power.</div>
              <div className="home__card-body">You work hard. You collect revenue. And then, gradually, silently — the shilling slips. Import costs jump. Holding KES cash is a tax on every Kenyan merchant who deals in imported goods or foreign currency.</div>
              <hr />
              <div className="home__card-fix-label">PayChain fix:</div>
              <div className="home__card-fix">Instant KES→USDC swaps at a flat 0.5% rate from your merchant dashboard. Protect purchasing power in seconds.</div>
            </article>

            <article className="home__card" data-anim>
              <div className="home__card-stat">&lt;10%</div>
              <div className="home__card-title">Banks Keep Saying No to the Businesses That Need Capital Most.</div>
              <div className="home__card-body">Your business is real. Your revenue is real. But the bank wants a title deed, a guarantor, and three years of audited accounts. Most Kenyan merchants will never tick those boxes — not because they aren't worthy, but because the system was designed for someone else.</div>
              <hr />
              <div className="home__card-fix-label">PayChain fix:</div>
              <div className="home__card-fix">Cash Advance based entirely on your verified PayChain transaction history. No collateral. No paperwork. Just the truth of what you earn.</div>
            </article>
          </div>

          <p className="home__problems-trans">We built PayChain because these are not unsolvable problems. They are just unsolved ones — until now.</p>
        </div>
      </section>

      {/* KEY TOOLS (LOCKED) */}
      <section className="home__tools" aria-labelledby="tools-heading">
        <div className="home__container">
          <h2 id="tools-heading" className="home__section-title">Key tools to drive your business forward</h2>
          <p className="home__lead">We understand that you want more customers coming through the door. That is why PayChain's tools seamlessly weave into how your business operates, making it easier than ever to run, grow, and prosper.</p>

          <div className="home__tools-eyebrow">How it works</div>

          <div className="home__tools-grid">
            <article className="home__tool" data-anim>
              <div className="home__tool-media" aria-hidden />
              <div className="home__tool-body">
                <h4 className="home__tool-title">Easy and safe way to accept payments</h4>
                <p className="home__tool-text">With a PayChain merchant account, go fully cashless and make it easy for your customers to pay via Lipa Na M-Pesa, USDC on Base, card, or bank transfer, all verified on-chain in under 100ms.</p>
                <a className="home__tool-link" href="/how-it-works">Learn more →</a>
              </div>
            </article>

            <article className="home__tool home__tool--alt" data-anim>
              <div className="home__tool-media" aria-hidden />
              <div className="home__tool-body">
                <h4 className="home__tool-title">Manage your business anywhere, anytime</h4>
                <p className="home__tool-text">Our dedicated merchant dashboard gives you real-time visibility into transactions, customer payments, e-TIMS receipts, and analytics, from any device, at any time.</p>
                <a className="home__tool-link" href="/how-it-works">Learn more →</a>
              </div>
            </article>

            <article className="home__tool" data-anim>
              <div className="home__tool-media" aria-hidden />
              <div className="home__tool-body">
                <h4 className="home__tool-title">Quick financing to grow your business</h4>
                <p className="home__tool-text">Access capital when you need it. Whether it's working capital or funds to expand, PayChain Business Advance uses your transaction history to get you credit fast, no paperwork.</p>
                <a className="home__tool-link" href="/cash-advance">Learn more →</a>
              </div>
            </article>

            <article className="home__tool home__tool--alt" data-anim>
              <div className="home__tool-media" aria-hidden />
              <div className="home__tool-body">
                <h4 className="home__tool-title">Conveniently pay your suppliers or employees</h4>
                <p className="home__tool-text">Use PayChain Bulk Pay to batch-disburse salaries, supplier invoices, and utility bills in one click, directly to M-Pesa or bank. PAYE auto-calculated.</p>
                <a className="home__tool-link" href="/bulk-pay">Learn more →</a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* TRUST SCORE */}
      <section className="home__trustscore">
        <div className="home__container home__trust-grid">
          <div className="home__trust-text">
            <h3 className="home__eyebrow">The PayChain Difference</h3>
            <h2 className="home__headline">Every Transaction You Make Builds Something More Valuable Than Revenue.</h2>
            <p className="home__sub">It builds your Trust Score — the financial identity Kenyan merchants have always deserved but never had.</p>
            <p>The PayChain Trust Score is a proprietary creditworthiness measure built entirely from your verified merchant activity. The more consistently you collect, pay, and transact through PayChain, the stronger your score becomes.</p>
            <p>Your Trust Score is the bridge between your business activity and your access to working capital — replacing the bank's demand for a title deed with something far more honest: a real-time record of what your business actually earns.</p>

            <div className="home__trust-checks">
              <div className="home__check">Verified inbound collections</div>
              <div className="home__check">Consistency and frequency of transactions</div>
              <div className="home__check">Revenue trajectory over time</div>
              <div className="home__check">Repayment history on previous Cash Advances</div>
              <div className="home__check">Merchant tenure on the platform</div>
            </div>
          </div>

          <aside className="home__trust-card" aria-hidden data-anim>
            <div className="trustcard__header">Trust Score</div>
            <div className="trustcard__ring" data-score="74"> 
              <div className="trustcard__score">74</div>
              <div className="trustcard__sub">/100</div>
              <div className="trustcard__badge">Cash Advance Eligible</div>
            </div>
            <div className="trustcard__meta">847 transactions | Since Jan 2026</div>
            <div className="trustcard__milestones">Next milestone: 80/100 → Higher limit unlocked</div>
          </aside>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="home__stats">
        <div className="home__container">
          <h3 className="home__eyebrow">The Opportunity</h3>
          <h2 className="home__headline">The Numbers Behind Why We Built PayChain.</h2>

          <div className="home__stats-grid">
            <div className="stat-card" data-count="7400000">
              <div className="stat-card__value">7.4M</div>
              <div className="stat-card__label">Registered SMEs in Kenya</div>
              <div className="stat-card__sub">The largest untapped merchant fintech opportunity on the continent.</div>
            </div>

            <div className="stat-card" data-count="7700000000000">
              <div className="stat-card__value">KES 7.7T</div>
              <div className="stat-card__label">Annual M-PESA transaction value</div>
              <div className="stat-card__sub">The infrastructure PayChain is built directly on top of.</div>
            </div>

            <div className="stat-card" data-count="30" data-suffix="%">
              <div className="stat-card__value">30%+</div>
              <div className="stat-card__label">Shilling depreciation (2021–2024)</div>
              <div className="stat-card__sub">Absorbed directly by Kenyan merchants with no protection.</div>
            </div>

            <div className="stat-card" data-count="10" data-prefix="<" data-suffix="%">
              <div className="stat-card__value">&lt;10%</div>
              <div className="stat-card__label">Kenyan SMEs with formal business credit</div>
              <div className="stat-card__sub">Despite most generating consistent, verifiable revenue.</div>
            </div>
          </div>

          <p className="home__stats-note">PayChain represents under 2% penetration of Kenya's registered SME market. The opportunity ahead is extraordinary.</p>
        </div>
      </section>

      {/* WHO IT'S FOR, TESTIMONIALS, TRUST BADGES, FAQ, FINAL CTA — simplified static implementations per copy */}
      <section className="home__who">
        <div className="home__container">
          <h3 className="home__eyebrow">Built for Every Kind of Kenyan Business</h3>
          <h2 className="home__headline">Whether You Run One Shop or Twenty, PayChain Was Built for You.</h2>
          <div className="who__grid">
            <div className="who__card">Retail &amp; Hospitality — Shops, supermarkets, caf e9s, restaurants</div>
            <div className="who__card">Import &amp; Export Traders — Merchants sourcing or selling internationally</div>
            <div className="who__card">Service Agencies — Agencies, consultancies, professional services</div>
            <div className="who__card">Growing SMEs Seeking Capital — Any business ready to scale, rejected by banks</div>
          </div>
        </div>
      </section>

      <section className="home__testimonials">
        <div className="home__container">
          <h3 className="home__eyebrow">What Early Merchants Are Saying</h3>
          <h2 className="home__headline">Real Merchants. Real Problems. Real Relief.</h2>
          <div className="testimonials__grid">
            <blockquote className="testimonial">"I've been running my shop in Juja for six years. I've lost money to fake M-PESA confirmations more times than I can count. If PayChain actually makes that impossible, it's the most important product I've ever used." — Retail shop owner, Juja Town, Kiambu County</blockquote>
            <blockquote className="testimonial">"Running payroll for my 14 staff on M-PESA manually takes me most of a Friday afternoon. I signed up for the waitlist the same day I heard about Bulk Pay. That alone is worth everything." — Restaurant owner, Westlands, Nairobi</blockquote>
            <blockquote className="testimonial">"My import margins have been getting squeezed for three years by the shilling. A KES-to-USDC swap directly from the dashboard I already use to collect payments? That is a completely different way of doing business." — Import trader, Industrial Area, Nairobi</blockquote>
            <blockquote className="testimonial">"Banks have said no to me three times. My business turns over KES 800,000 a month but I can't prove it in a way they accept. PayChain building credit from my actual transaction history is the first time the system has felt like it was designed for me." — Service agency founder, Kilimani, Nairobi</blockquote>
          </div>
        </div>
      </section>

      <section className="home__trustbadges">
        <div className="home__container">
          <h3 className="home__eyebrow">Enterprise-Grade Infrastructure</h3>
          <h2 className="home__headline">Built on the Rails the World's Most Trusted Institutions Already Use.</h2>
          <div className="trustbadges__row">
            <div className="trustbadge">Safaricom M-PESA Daraja API — Kenya's official mobile money developer infrastructure</div>
            <div className="trustbadge">Base Network (Coinbase) — Ethereum Layer 2, processing billions globally</div>
            <div className="trustbadge">KRA e-TIMS Compliant — Automatic electronic tax invoicing compliance</div>
            <div className="trustbadge">CBK Licensed (Pursuing) — Central Bank of Kenya payment aggregator licensing</div>
            <div className="trustbadge">256-Bit AES Encryption — Bank-grade security on all merchant data</div>
          </div>
        </div>
      </section>

      <section className="home__faq">
        <div className="home__container">
          <h3 className="home__eyebrow">Common Questions</h3>
          <h2 className="home__headline">Everything You Need to Know Before You Join.</h2>
          <div className="faq__list">
            <details open>
              <summary>Is PayChain free to use?</summary>
              <p>There are no monthly fees, no setup costs, and no subscription charges. PayChain earns a transaction fee of 1.5%–2.5% on verified inbound collections, and a flat 0.5% FX spread on KES→USDC swaps. Beta merchants receive locked-in preferential rates at public launch.</p>
            </details>
            <details>
              <summary>Do I need to understand blockchain or crypto?</summary>
              <p>Not at all. PayChain works exactly like a standard merchant dashboard. The blockchain infrastructure runs entirely in the background — you see faster, more secure, more verifiable payments. No wallets, no seed phrases, no technical knowledge required.</p>
            </details>
            <details>
              <summary>What happens to my existing M-PESA till?</summary>
              <p>You keep it. PayChain issues you an additional verified till number. You can run both simultaneously during transition, or switch fully to PayChain at your own pace.</p>
            </details>
            <details>
              <summary>When does Cash Advance become available?</summary>
              <p>After 3 months of verified transaction history through your PayChain Smart Till, your business automatically becomes eligible for an advance offer. The offer appears directly on your dashboard — no application form required.</p>
            </details>
            <details>
              <summary>Is PayChain only for Nairobi merchants?</summary>
              <p>The closed beta focuses on Nairobi and Juja. We expand to Mombasa, Kisumu, and Nakuru in Year 2. If you are outside these areas, join the waitlist and we will notify you when PayChain launches in your region.</p>
            </details>
            <details>
              <summary>What does KRA e-TIMS compliance mean for my business?</summary>
              <p>KRA's e-TIMS system requires merchants to electronically submit transaction records for tax purposes. PayChain automatically formats every transaction to meet e-TIMS requirements — giving you downloadable, audit-ready tax records with no manual data entry.</p>
            </details>
            <details>
              <summary>How is PayChain different from a regular M-PESA till?</summary>
              <p>A regular M-PESA till collects money and sends you an SMS. PayChain verifies the payment against the Safaricom Daraja API in real time, logs it on blockchain rails for an immutable record, adds it to your Trust Score, provides a full analytics dashboard, handles your bulk payments, converts your balance to USDC, and makes you eligible for working capital after 3 months. It is a different category of product entirely.</p>
            </details>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home__finalcta">
        <div className="home__container">
          <div className="beta-badge">Closed Beta — Q2 2026</div>
          <h2 className="home__headline">The Merchants Who Join Now Get More Than Early Access.</h2>
          <p className="home__final-body">Beta merchants get locked-in preferential transaction rates at public launch, a 3-month head start on their Trust Score and Cash Advance eligibility, hands-on onboarding support from the PayChain team, and a direct line to shape what PayChain becomes before it launches to the public.</p>
          <a className="btn btn--cta" href="/waitlist">Join the Beta Waitlist →</a>
          <div className="home__micro">No credit card · No commitment · Limited spots available</div>
          <div className="home__micro">Already a merchant with questions? partnerships@paychain.co.ke</div>
          <div className="home__pills">✓ No monthly fees &nbsp; ✓ No collateral required &nbsp; ✓ Built on M-PESA infrastructure</div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
