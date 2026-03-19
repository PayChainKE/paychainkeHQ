import React, { useEffect, useRef } from "react";
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import './cash-advance.css';
import {
  TrendingUp,
  Zap,
  RefreshCw,
  Database,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import useCashAdvanceAnimations from './useCashAdvanceAnimations';

const CashAdvance: React.FC = () => {
  const rootRef = useRef<HTMLElement | null>(null);
  useCashAdvanceAnimations(rootRef);

  useEffect(() => {
    document.title = 'PayChain Cash Advance — Working Capital for Kenyan Merchants';
    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('og:title', 'PayChain Cash Advance — Working Capital for Kenyan Merchants');
    setMeta('og:description', 'Access working capital based on your real M-PESA transaction history — no collateral, no bank queues, no credit history needed. Join the PayChain beta.');
    setMeta('og:url', 'https://www.paychain.co.ke/cash-advance');
    setMeta('og:image', '/assets/og-cash-advance.jpg');
  }, []);

  return (
    <div className="cash-advance-page font-sans text-[#0A192F]">
      <Navbar />

      <main className="max-w-[1200px] mx-auto px-6 py-12" ref={rootRef}>
        <section className="hero grid md:grid-cols-2 gap-8 items-center" style={{ paddingTop: '100px' }}>
          <div className="hero-copy">
            <div className="eyebrow inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm animate-pulse">
              Unlocks after 3 months of verified PayChain transactions
            </div>

            <h1 className="hero-headline mt-6">
              <span className="block text-4xl md:text-6xl font-medium">Your Transaction History</span>
              <span className="block text-4xl md:text-6xl font-extrabold text-primary">Is Your Collateral.</span>
            </h1>

            <p className="mt-4 text-lg leading-7">
              PayChain Cash Advance gives Kenyan merchants access to working capital based on real verified business data — not land titles, not guarantors, not bank relationships. Just the truth of how your business moves money.
            </p>

            <ul className="trust-pills flex gap-3 mt-6">
              <li className="pill">No collateral required</li>
              <li className="pill">No credit history needed</li>
              <li className="pill">No bank queues</li>
            </ul>

            <div className="mt-6">
              <a href="/waitlist" className="btn-primary btn-cta text-[#0A192F]" aria-label="Join the Waitlist">Join the Waitlist</a>
            </div>

            <div className="text-sm text-muted-foreground mt-3">Closed beta Q2 2026 · Limited merchant spots</div>
          </div>

          <div className="hero-visual" aria-hidden>
            <div className="dashboard-mock">
              <div className="chart-placeholder" />
              <div className="offer-card" role="status" aria-live="polite">
                <div className="offer-title">Cash Advance Offer</div>
                <div className="offer-amount">KES 150,000</div>
                <div className="offer-meta">Repayment: 6% of daily collections</div>
                <button className="btn-accept">Accept Offer</button>
              </div>
            </div>
          </div>
        </section>

        <section className="problem section-dark mt-12 py-12 text-white">
          <h2 className="text-3xl font-semibold text-center max-w-3xl mx-auto">Kenya's Banks Were Not Built for Kenya's Merchants.</h2>
          <blockquote className="pull-quote text-center mt-6">"The bank asked for a title deed. You left empty-handed — not because your business isn't real, but because their system was never designed to see it."</blockquote>

          <div className="mt-8 max-w-3xl mx-auto text-lg leading-8">
            <p>Every Kenyan SME owner knows this story. Business is good. Orders are coming in. You have the customers, the suppliers, the reputation — but not the cash right now to fulfill the opportunity in front of you.</p>

            <p className="mt-4">So you go to the bank. They ask for a title deed. A guarantor. Three years of audited accounts. You leave empty-handed. You go to a SACCO. The rates are punishing. You borrow from family. It works until it doesn't. Meanwhile, the opportunity is gone.</p>

            <p className="mt-4">PayChain Cash Advance was built for the moment between the opportunity and the cash.</p>
          </div>
        </section>

        <section className="explainer mt-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-semibold">Working Capital That Understands Your Business.</h3>
            <p className="mt-4 text-lg leading-7">PayChain Cash Advance is a data-driven working capital facility embedded in your merchant dashboard. After 3 months of verified transaction history through your PayChain Smart Till, your business automatically becomes eligible — with a limit determined entirely by your real revenue data. No application forms. No collateral valuation. No credit committee. Just your data, a transparent offer, and funds in your account.</p>
          </div>

          <div className="mock-right">
            <div className="offer-mock p-4 bg-white rounded-md shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">Approved limit</div>
                  <div className="text-2xl font-semibold">KES 150,000</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Repayment</div>
                  <div className="font-medium">6% daily</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground">Origination fee: KES 4,500</div>
              <div className="mt-4">
                <button className="btn-accept">Accept</button>
              </div>
            </div>
          </div>
        </section>

        <section className="how-it-works mt-16">
          <h3 className="text-2xl font-semibold">From Transaction to Working Capital in 5 Steps</h3>
          <ol className="timeline mt-6">
            <li className="step">
              <div className="step-number">1</div>
              <div className="step-body">
                <h4 className="font-semibold">Transact Through PayChain (Months 1–3)</h4>
                <p>Every verified collection through your Smart Till builds your merchant ledger — a tamper-proof record of your real business activity.</p>
              </div>
            </li>
            <li className="step">
              <div className="step-number">2</div>
              <div className="step-body">
                <h4 className="font-semibold">Your Trust Score Builds Automatically</h4>
                <p>PayChain's Trust Score algorithm analyzes your revenue consistency, transaction frequency, and growth trajectory. Watch it build in real time on your dashboard. No action required.</p>
              </div>
            </li>
            <li className="step">
              <div className="step-number">3</div>
              <div className="step-body">
                <h4 className="font-semibold">You Receive a Cash Advance Offer</h4>
                <p>At month 3, if eligible, PayChain presents a personalized offer on your dashboard — approved limit, repayment terms, origination fee, and total cost. Fully visible before you commit.</p>
              </div>
            </li>
            <li className="step">
              <div className="step-number">4</div>
              <div className="step-body">
                <h4 className="font-semibold">Accept and Receive Funds</h4>
                <p>Accept your offer. Funds arrive in your PayChain merchant balance immediately — ready for Bulk Pay, supplier payments, or M-PESA withdrawal. No 3–5 day bank delays.</p>
              </div>
            </li>
            <li className="step">
              <div className="step-number">5</div>
              <div className="step-body">
                <h4 className="font-semibold">Repay as You Earn</h4>
                <p>Repayment is a fixed percentage of your daily PayChain collections — automatic, no manual transfers. Strong month = repay faster. Slow week = smaller repayment. Works with your cash flow, not against it.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="trust-score mt-16 py-12 bg-deep rounded-md">
          <div className="grid md:grid-cols-3 items-center gap-6">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-semibold text-[#0A192F]">The Credit System Built on Truth.</h3>
              <div className="mt-4 grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-[#0A192F]">What builds your Trust Score</h4>
                  <ul className="mt-3 space-y-2 text-[#0A192F]">
                    <li>Transaction Volume — total verified inbound collections</li>
                    <li>Transaction Consistency — regularity of payments received</li>
                    <li>Revenue Trajectory — growth, stability, or fluctuation pattern</li>
                    <li>Average Transaction Size — typical customer payment value</li>
                    <li>Merchant Tenure — time active on PayChain</li>
                    <li>Repayment History — reliability on previous advances</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-[#0A192F]">What doesn't affect your score</h4>
                  <ul className="mt-3 space-y-2 text-[#0A192F]">
                    <li>Your personal credit history ✗</li>
                    <li>Whether you own property ✗</li>
                    <li>Your bank account balance ✗</li>
                    <li>Your education or employment ✗</li>
                    <li>Your relationship with any bank ✗</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="score-center text-center">
              <div className="score-ring" data-target="78" aria-hidden>
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  <path className="circle"
                    strokeDasharray="0,100"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"/>
                </svg>
                <div className="score-label">Trust Score</div>
                <div className="score-value">78%</div>
              </div>
            </div>
          </div>
        </section>

        <section className="features mt-16">
          <h3 className="text-2xl font-semibold">A Cash Advance Built the Way Business Actually Works</h3>
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><Database /><h4 className="font-semibold">Data-Driven Eligibility</h4></div>
              <p className="mt-2 text-sm">Advance limit calculated entirely from your verified PayChain transaction history. No collateral, guarantors, or credit bureaus.</p>
            </article>
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><Eye /><h4 className="font-semibold">Full Transparency Before You Commit</h4></div>
              <p className="mt-2 text-sm">See your approved limit, origination fee, repayment %, and total cost before accepting. No surprises. No fine print that changes.</p>
            </article>
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><RefreshCw /><h4 className="font-semibold">Revenue-Based Repayment</h4></div>
              <p className="mt-2 text-sm">Repayments auto-collected as a % of daily collections. Adjusts with your revenue — no penalties for slow business cycles.</p>
            </article>
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><Zap /><h4 className="font-semibold">Instant Disbursement</h4></div>
              <p className="mt-2 text-sm">Funds arrive in your PayChain balance immediately on acceptance. Available for Bulk Pay, suppliers, or M-PESA withdrawal.</p>
            </article>
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><TrendingUp /><h4 className="font-semibold">Grows with Your Business</h4></div>
              <p className="mt-2 text-sm">Repay your first advance and your next offer comes faster, at a higher limit, and on better terms. Compounds with every cycle.</p>
            </article>
            <article className="feature-card p-4 bg-white rounded-md">
              <div className="flex items-center gap-3"><ShieldCheck /><h4 className="font-semibold">Zero Hidden Fees</h4></div>
              <p className="mt-2 text-sm">Transparent origination fee + revenue share. That is the total cost. No late fees, penalty interest, or early repayment charges.</p>
            </article>
          </div>
        </section>

        <section className="comparison mt-16">
          <h3 className="text-2xl font-semibold">Why PayChain Cash Advance Wins</h3>
          <div className="mt-6 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th></th>
                  <th className="text-muted-foreground">Bank Loan</th>
                  <th className="text-muted-foreground">SACCO Loan</th>
                  <th className="paychain-col">PayChain Cash Advance</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Eligibility</td><td>Title deed + audited accounts</td><td>Savings + membership</td><td className="paychain-col">3 months PayChain transactions</td></tr>
                <tr><td>Application</td><td>Weeks of paperwork</td><td>1–2 weeks</td><td className="paychain-col">Automatic dashboard offer</td></tr>
                <tr><td>Disbursement</td><td>Days to weeks</td><td>Days</td><td className="paychain-col">Immediate</td></tr>
                <tr><td>Repayment</td><td>Fixed monthly installment</td><td>Fixed monthly installment</td><td className="paychain-col">% of daily collections</td></tr>
                <tr><td>Collateral</td><td>Required</td><td>Required</td><td className="paychain-col">None</td></tr>
                <tr><td>Credit history</td><td>Required</td><td>Partial</td><td className="paychain-col">Not required</td></tr>
                <tr><td>Slow month penalty</td><td>Yes</td><td>Yes</td><td className="paychain-col">No — auto-adjusts</td></tr>
                <tr><td>Builds future access</td><td>Bank only</td><td>SACCO only</td><td className="paychain-col">Strengthens Trust Score</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="who mt-16 grid md:grid-cols-2 gap-6">
          <h3 className="text-2xl font-semibold md:col-span-2">Built for the Moment Between the Opportunity and the Cash</h3>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Retail & Hospitality</h4>
            <p className="mt-2 text-sm">Stock up before peak season without draining operational cash. Repay as the season's revenue comes in.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Import & Export Traders</h4>
            <p className="mt-2 text-sm">Bridge the gap between placing an international order and receiving inventory. Cover deposits, freight, and customs — repay as stock sells.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Service Agencies</h4>
            <p className="mt-2 text-sm">Take on larger contracts than current cash flow allows. Cover upfront costs, repay from the contract revenue.</p>
          </div>
          <div className="card p-4 bg-white rounded-md">
            <h4 className="font-semibold">Any Cash Flow Gap</h4>
            <p className="mt-2 text-sm">Delayed payment. Unexpected equipment. Seasonal trough before a peak. PayChain Cash Advance is for the moments that matter.</p>
          </div>
        </section>

        <section className="eligibility mt-16 grid md:grid-cols-2 gap-6">
          <div className="on-track p-6 bg-emerald-50 rounded-md">
            <h4 className="font-semibold">You're on track if:</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Active PayChain Smart Till for 3+ months</li>
              <li>Trust Score at or above eligibility threshold</li>
              <li>KYC-verified merchant account in Kenya</li>
              <li>No defaulted PayChain advance</li>
            </ul>
          </div>

          <div className="not-yet p-6 bg-amber-50 rounded-md">
            <h4 className="font-semibold">Not yet eligible if:</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Joined PayChain less than 3 months ago</li>
              <li>Trust Score below current threshold</li>
            </ul>
          </div>

          <div className="md:col-span-2 text-center mt-4">
            <div className="text-lg font-medium">Every merchant who joined PayChain today is 3 months away from their first offer. The clock starts with your first payment.</div>
          </div>
        </section>

        <section className="faq mt-16">
          <h3 className="text-2xl font-semibold">Questions We Get Asked About Cash Advance</h3>
          <div className="mt-4 accordion">
            <details>
              <summary>How much can I borrow?</summary>
              <div className="p-4">Your limit is calculated from your verified transaction history. Higher, more consistent revenue through PayChain = higher limit. Limits grow with each successfully repaid advance.</div>
            </details>
            <details>
              <summary>What does it cost?</summary>
              <div className="p-4">A transparent origination fee plus a repayment % of daily collections. The full cost is shown before you accept — no hidden fees, no penalty interest.</div>
            </details>
            <details>
              <summary>What if my business has a slow month?</summary>
              <div className="p-4">Repayments are a fixed % of your actual daily collections. Slow month = smaller repayment. No missed payment penalties for normal revenue variation.</div>
            </details>
            <details>
              <summary>Can I get a second advance before repaying the first?</summary>
              <div className="p-4">Once a significant portion is repaid, PayChain may present a top-up offer. Full second advances are available after full repayment.</div>
            </details>
            <details>
              <summary>Does this affect my credit record?</summary>
              <div className="p-4">PayChain operates on your internal Trust Score — a proprietary measure. It does not interact with external credit bureaus.</div>
            </details>
            <details>
              <summary>Can I repay early?</summary>
              <div className="p-4">Yes — with no penalty. Early repayment strengthens your Trust Score faster and accelerates your next offer.</div>
            </details>
          </div>
        </section>

        <section className="final-cta mt-16 py-12 text-white bg-deep rounded-md text-center">
            <h3 className="text-3xl font-semibold text-[#0A192F]">The Sooner You Start Transacting, the Sooner You Unlock Working Capital.</h3>
          <p className="mt-4 text-[#0A192F]">Every verified collection through PayChain brings you closer to your first Cash Advance offer. Join our closed beta and start your 3-month clock today.</p>
          <div className="mt-6">
            <a href="/waitlist" className="btn-primary btn-cta text-[#0A192F]">Join the Beta Waitlist →</a>
          </div>
          <div className="mt-3 text-sm text-[#0A192F]">Closed beta Q2 2026 · Limited merchant spots · No collateral · No bank queue</div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CashAdvance;
