import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, FileText, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const SECTIONS = [
  { id: 's1', title: '1. Definitions' },
  { id: 's2', title: '2. Eligibility and Registration' },
  { id: 's3', title: '3. The Services' },
  { id: 's4', title: '4. Fees and Payment' },
  { id: 's5', title: '5. Merchant Obligations' },
  { id: 's6', title: '6. Intellectual Property' },
  { id: 's7', title: '7. Data Protection' },
  { id: 's8', title: '8. Disclaimers and Limitation of Liability' },
  { id: 's9', title: '9. Indemnification' },
  { id: 's10', title: '10. Term and Termination' },
  { id: 's11', title: '11. Amendments' },
  { id: 's12', title: '12. Governing Law and Dispute Resolution' },
  { id: 's13', title: '13. General' },
];

const TermsOfService: React.FC = () => {
  const [activeSection, setActiveSection] = useState('s1');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden bg-[#00140c] pt-32 pb-20">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(0,191,99,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(0,191,99,0.25) 0%, transparent 40%)',
          }}
        />
        <div className="relative container mx-auto px-6 sm:px-8 lg:px-12 max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 rounded-2xl bg-white/95 p-3 shadow-lg shadow-black/20">
              <img
                src="/Home page/paychain official logo.png"
                alt="PayChain Financial Services Ltd"
                className="h-10 md:h-12 w-auto mix-blend-multiply"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 mb-6">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400">
                Governed by the Laws of Kenya
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-emerald-100/60 max-w-2xl text-sm md:text-base leading-relaxed">
              Please read these Terms of Service carefully before accessing or using the PayChain
              Platform. By registering, accessing, or using the Platform in any way, you confirm
              that you have read, understood, and agree to be bound by these Terms.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-x-8 gap-y-2 text-xs text-emerald-100/50">
              <span><span className="font-bold text-white">Effective Date:</span> July 13, 2026</span>
              <span className="hidden sm:inline text-emerald-400/30">|</span>
              <span><span className="font-bold text-white">Last Updated:</span> July 13, 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company strip */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="container mx-auto px-6 sm:px-8 lg:px-12 max-w-6xl py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <div className="font-bold text-gray-900 tracking-tight">
              PAYCHAIN FINANCIAL SERVICES LTD
              <span className="ml-3 font-normal text-gray-400">Company No. PVT-9L1QY658</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-gray-500">
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> Nairobi, Kenya</span>
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-emerald-600" /> admin@paychain.co.ke</span>
              <a href="https://www.paychain.co.ke" className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition-colors">paychain.co.ke</a>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-6 sm:px-8 lg:px-12 max-w-6xl py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">On this page</p>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      activeSection === s.id
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${activeSection === s.id ? 'text-emerald-600' : 'text-gray-300'}`} />
                    <span className="leading-snug">{s.title}</span>
                  </button>
                ))}
              </nav>
              <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-xs text-emerald-900/70 leading-relaxed">
                  Questions about these Terms? Contact us at{' '}
                  <a href="mailto:admin@paychain.co.ke" className="font-semibold text-emerald-700 underline underline-offset-2">
                    admin@paychain.co.ke
                  </a>
                </p>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9">
            <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-strong:text-gray-800 prose-a:text-emerald-600">
              <div className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-5 mb-8">
                <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                  PLEASE READ THESE TERMS OF SERVICE CAREFULLY BEFORE ACCESSING OR USING THE
                  PAYCHAIN PLATFORM. BY REGISTERING, ACCESSING, OR USING THE PLATFORM IN ANY WAY,
                  YOU CONFIRM THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS.
                </p>
              </div>

              <section id="s1" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">1. Definitions</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>1.1 "Agreement"</strong> means these Terms of Service, together with our Privacy Policy, any Acceptable Use Policy, and any other policies or supplemental terms incorporated by reference herein.</li>
                  <li><strong>1.2 "COLLECT"</strong> means PayChain's verified till-number payment collection service.</li>
                  <li><strong>1.3 "Company", "we", "us", or "our"</strong> means PayChain Financial Services Ltd, Company No. PVT-9L1QY658, Nairobi, Kenya.</li>
                  <li><strong>1.4 "GROW"</strong> means PayChain's data-driven merchant Trust Score and working capital access service.</li>
                  <li><strong>1.5 "Merchant" or "you"</strong> means any individual, sole proprietorship, partnership, or legal entity that registers for and uses the Platform.</li>
                  <li><strong>1.6 "PAY"</strong> means PayChain's bulk payroll and supplier payment settlement service.</li>
                  <li><strong>1.7 "Platform"</strong> means the PayChain web application, mobile application, APIs, and all associated services operated by the Company.</li>
                  <li><strong>1.8 "PROTECT"</strong> means PayChain's Inflation Shield service allowing conversion of KES balances to USDC stablecoins.</li>
                  <li><strong>1.9 "Services"</strong> means all products, features, and functionalities offered through the Platform, including COLLECT, PAY, PROTECT, and GROW.</li>
                  <li><strong>1.10 "Transaction"</strong> means any payment, transfer, conversion, or financial instruction initiated by a Merchant through the Platform.</li>
                  <li><strong>1.11 "Trust Score"</strong> means the proprietary merchant creditworthiness score generated by PayChain's algorithm based on transactional velocity and platform behaviour.</li>
                </ul>
              </section>

              <section id="s2" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">2. Eligibility and Registration</h2>
                <h3 className="text-lg mt-6 mb-2">2.1 Eligibility</h3>
                <p>To use the Platform, you must:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) be at least 18 years of age;</li>
                  <li>(b) be a duly registered business or individual operating lawfully in Kenya;</li>
                  <li>(c) have a valid KRA PIN and be registered for the applicable tax obligations;</li>
                  <li>(d) have a valid M-PESA registered mobile number;</li>
                  <li>(e) not be prohibited from using the Platform under any applicable law.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.2 Account Registration</h3>
                <p>
                  You must provide accurate, complete, and up-to-date information during
                  registration, including your business name, KRA PIN, M-PESA number, and bank
                  account details (where applicable). You agree to update your information
                  promptly if it changes.
                </p>

                <h3 className="text-lg mt-6 mb-2">2.3 Account Security</h3>
                <p>
                  You are solely responsible for maintaining the confidentiality of your login
                  credentials. You must immediately notify us at{' '}
                  <a href="mailto:admin@paychain.co.ke">admin@paychain.co.ke</a> of any suspected
                  unauthorised access to your account. We shall not be liable for any losses
                  arising from your failure to safeguard your credentials.
                </p>

                <h3 className="text-lg mt-6 mb-2">2.4 KYC and AML Compliance</h3>
                <p>
                  The Company operates under Kenyan financial regulations, including guidelines
                  from the Central Bank of Kenya (CBK) and the Financial Reporting Centre (FRC)
                  under the Proceeds of Crime and Anti-Money Laundering Act, 2009. You agree to
                  provide all information and documentation required for Know Your Customer (KYC)
                  and Anti-Money Laundering (AML) verification. The Company may suspend or
                  terminate your account if you fail to meet these requirements.
                </p>
              </section>

              <section id="s3" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">3. The Services</h2>

                <h3 className="text-lg mt-6 mb-2">3.1 COLLECT — Verified Payment Collection</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) PayChain assigns Merchants a verified till number linked to the PayChain blockchain-anchored verification system.</li>
                  <li>(b) The COLLECT service enables Merchants to receive M-PESA payments with real-time transaction verification, eliminating fake-SMS payment fraud.</li>
                  <li>(c) We do not guarantee uninterrupted availability of COLLECT, as it depends on the availability of the Safaricom M-PESA Daraja API, which is outside our control.</li>
                  <li>(d) Merchants must not modify, replicate, or misrepresent their verified till number.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">3.2 PAY — Bulk Payroll and Supplier Settlements</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) The PAY service enables Merchants to execute bulk payments to employees, suppliers, and counterparties via the M-PESA B2C gateway.</li>
                  <li>(b) Once a payment instruction is confirmed by you on the Platform, it is irrevocable. You are solely responsible for verifying recipient details before confirming any Transaction.</li>
                  <li>(c) PayChain shall not be liable for payments sent to incorrect recipients due to errors in information provided by you.</li>
                  <li>(d) Transaction processing times are subject to Safaricom network conditions and may vary.</li>
                  <li>(e) Bulk payment limits are subject to the Central Bank of Kenya regulations and Safaricom's B2C limits in force from time to time.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">3.3 PROTECT — Inflation Shield (KES to USDC)</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) The PROTECT service enables Merchants to convert KES balances to USDC (USD Coin), a stablecoin pegged to the US Dollar, via our blockchain infrastructure.</li>
                  <li>
                    (b) <strong>IMPORTANT RISK DISCLOSURE:</strong> Stablecoins, including USDC, are
                    not legal tender in Kenya. The KES/USD exchange rate fluctuates. Stablecoin
                    infrastructure may experience technical failures. Regulatory treatment of
                    stablecoins in Kenya is evolving and may change. By using PROTECT, you
                    acknowledge and accept these risks.
                  </li>
                  <li>(c) The Company does not provide financial advice. PROTECT is a treasury management tool; you should seek independent financial advice before making conversion decisions.</li>
                  <li>(d) Conversions are subject to applicable exchange rates, fees, and on-chain transaction costs at the time of execution. All fees will be disclosed before confirmation.</li>
                  <li>(e) You are responsible for your own tax compliance with respect to currency conversions, including any gains or losses.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">3.4 GROW — Trust Score and Working Capital</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) After maintaining a minimum of three (3) months of active transactional history on the Platform, Merchants may be eligible to apply for collateral-free working capital facilities.</li>
                  <li>(b) The Trust Score is a proprietary algorithm and PayChain does not warrant any specific credit outcome. Eligibility for and terms of any working capital facility are at the sole discretion of the Company and/or its lending partners.</li>
                  <li>(c) Working capital facilities are subject to separate loan agreements, which will set out repayment terms, interest rates, and default provisions.</li>
                  <li>(d) PayChain is not a deposit-taking institution and does not hold Merchant funds beyond what is necessary for transaction processing.</li>
                </ul>
              </section>

              <section id="s4" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">4. Fees and Payment</h2>
                <p><strong>4.1 Transaction Fees:</strong> The Company charges fees for certain Services as set out in the Pricing Schedule (which may be updated from time to time). All fees are exclusive of applicable taxes unless stated otherwise.</p>
                <p><strong>4.2 Subscription Fees:</strong> Where applicable, subscription fees are billed in advance on a monthly or annual basis. All subscription fees are non-refundable except as required by law.</p>
                <p><strong>4.3 Fee Changes:</strong> The Company reserves the right to change its fee structure at any time upon thirty (30) days' prior written notice to Merchants. Continued use of the Platform after the effective date of a fee change constitutes acceptance of the new fees.</p>
                <p><strong>4.4 Late Payment:</strong> If any amounts owed by you remain unpaid for more than seven (7) days after the due date, the Company may suspend your access to the Platform until outstanding amounts are settled.</p>
                <p><strong>4.5 Taxes:</strong> You are responsible for determining and paying all applicable taxes in respect of your use of the Services, including VAT, withholding taxes, and any taxes arising from currency conversions.</p>
              </section>

              <section id="s5" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">5. Merchant Obligations</h2>
                <p>5.1 You agree to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) use the Platform only for lawful business purposes;</li>
                  <li>(b) not use the Platform to process payments for illegal goods or services;</li>
                  <li>(c) not engage in any fraudulent or deceptive practices using the Platform;</li>
                  <li>(d) not attempt to circumvent the verification, KYC, or fraud-detection mechanisms of the Platform;</li>
                  <li>(e) comply with all applicable laws, including the Central Bank of Kenya's National Payment System regulations, the Proceeds of Crime and Anti-Money Laundering Act, 2009, and the Data Protection Act, 2019.</li>
                </ul>
                <p>
                  5.2 You represent and warrant that all information you provide is accurate and
                  that you have the authority to use the payment instruments and accounts you
                  connect to the Platform.
                </p>
              </section>

              <section id="s6" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">6. Intellectual Property</h2>
                <p>
                  6.1 All content, software, algorithms, brand elements, and documentation on the
                  Platform are the exclusive property of PayChain Financial Services Ltd, protected
                  by copyright, trademark, and other intellectual property laws.
                </p>
                <p>
                  6.2 We grant you a limited, non-exclusive, non-transferable, revocable licence to
                  access and use the Platform solely for your internal business purposes, in
                  accordance with this Agreement.
                </p>
                <p>6.3 You must not: copy, modify, or create derivative works of the Platform; reverse-engineer or decompile any part of the Platform; use the Platform to build a competing product; scrape, extract, or systematically download any data from the Platform.</p>
              </section>

              <section id="s7" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">7. Data Protection</h2>
                <p>
                  7.1 The Company processes personal and business data in accordance with the Data
                  Protection Act, 2019 (Kenya) and our{' '}
                  <Link to="/privacy-policy">Privacy Policy</Link> (paychain.co.ke/privacy).
                </p>
                <p>
                  7.2 By using the Platform, you consent to the collection, processing, and use of
                  your data as described in the Privacy Policy.
                </p>
                <p>
                  7.3 You grant the Company a non-exclusive, royalty-free licence to use anonymised
                  and aggregated transaction data derived from your use of the Platform for the
                  purpose of improving the Services, generating the Trust Score, and complying with
                  regulatory reporting obligations.
                </p>
              </section>

              <section id="s8" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">8. Disclaimers and Limitation of Liability</h2>
                <div className="not-prose rounded-xl border border-gray-200 bg-gray-50 p-5 my-4 space-y-3 text-sm text-gray-600 leading-relaxed">
                  <p><strong className="text-gray-800">8.1 AS-IS BASIS:</strong> THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY KENYAN LAW.</p>
                  <p><strong className="text-gray-800">8.2 SERVICE AVAILABILITY:</strong> We do not guarantee that the Platform will be available at all times. Planned and unplanned maintenance, third-party outages (including Safaricom M-PESA downtime), and force majeure events may result in service interruptions.</p>
                  <p><strong className="text-gray-800">8.3 LIMITATION OF LIABILITY:</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY'S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO THE COMPANY IN THE THREE (3) MONTHS PRECEDING THE CLAIM.</p>
                  <p><strong className="text-gray-800">8.4 EXCLUDED DAMAGES:</strong> IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFIT, LOSS OF REVENUE, LOSS OF DATA, OR LOSS OF GOODWILL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
                  <p><strong className="text-gray-800">8.5 THIRD-PARTY SERVICES:</strong> The Company is not responsible for the availability, terms, or conduct of third-party services integrated with the Platform, including Safaricom M-PESA, Circle (USDC), blockchain networks, or lending partners.</p>
                </div>
              </section>

              <section id="s9" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">9. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless the Company, its directors,
                  officers, employees, agents, and affiliates from and against any claims, losses,
                  damages, liabilities, costs, and expenses (including reasonable legal fees)
                  arising out of or related to:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) your use of the Platform;</li>
                  <li>(b) your breach of this Agreement;</li>
                  <li>(c) any violation of applicable law;</li>
                  <li>(d) any fraudulent or unauthorised Transaction on your account;</li>
                  <li>(e) your infringement of any third-party rights.</li>
                </ul>
              </section>

              <section id="s10" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">10. Term and Termination</h2>
                <p>10.1 This Agreement commences on the date you first access or register for the Platform and continues until terminated.</p>
                <p>
                  10.2 You may terminate your account at any time by contacting{' '}
                  <a href="mailto:admin@paychain.co.ke">admin@paychain.co.ke</a>. Pending
                  transactions will be completed before closure.
                </p>
                <p>10.3 The Company may terminate or suspend your account immediately, without notice, if:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) you breach any provision of this Agreement;</li>
                  <li>(b) you fail to complete required KYC/AML verification;</li>
                  <li>(c) we are required to do so by law or regulatory order;</li>
                  <li>(d) we reasonably suspect fraudulent or illegal activity on your account.</li>
                </ul>
                <p>
                  10.4 Upon termination, all licences granted to you cease immediately. Sections 6,
                  7, 8, 9, 12, and 13 of these Terms shall survive termination.
                </p>
              </section>

              <section id="s11" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">11. Amendments</h2>
                <p>
                  The Company reserves the right to amend these Terms at any time. We will notify
                  you of material changes via email or in-platform notification at least fourteen
                  (14) days before the changes take effect. Your continued use of the Platform
                  after the effective date constitutes acceptance.
                </p>
              </section>

              <section id="s12" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">12. Governing Law and Dispute Resolution</h2>
                <p>12.1 These Terms are governed by the laws of Kenya.</p>
                <p>
                  12.2 Any dispute shall first be submitted to good-faith negotiation. If unresolved
                  within thirty (30) days, the dispute shall be submitted to binding arbitration in
                  Nairobi under the Arbitration Act, 1995 (Kenya).
                </p>
                <p>12.3 Nothing prevents either party from seeking injunctive or other emergency relief from the courts.</p>
              </section>

              <section id="s13" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">13. General</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>13.1 Entire Agreement:</strong> These Terms (with the Privacy Policy) constitute the entire agreement between you and the Company regarding the Platform.</li>
                  <li><strong>13.2 Severability:</strong> If any provision is held unenforceable, the remaining provisions remain in effect.</li>
                  <li><strong>13.3 No Waiver:</strong> Failure to enforce any provision shall not constitute a waiver of that provision.</li>
                  <li><strong>13.4 Assignment:</strong> You may not assign your rights or obligations under this Agreement without the Company's prior written consent. The Company may assign this Agreement without restriction.</li>
                  <li><strong>13.5 Force Majeure:</strong> The Company shall not be liable for any delay or failure caused by circumstances beyond our reasonable control, including M-PESA network outages, acts of God, government action, or internet infrastructure failures.</li>
                </ul>
              </section>

              <div className="not-prose rounded-xl border border-emerald-100 bg-emerald-50/50 p-6 my-4">
                <p className="font-bold text-gray-900 mb-1">PayChain Financial Services Ltd</p>
                <p className="text-sm text-gray-500 mb-4">Company No. PVT-9L1QY658</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> Nairobi, Kenya</p>
                  <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-600" /> <a href="mailto:admin@paychain.co.ke" className="hover:text-emerald-700">admin@paychain.co.ke</a></p>
                  <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-600" /> +254 790 889 066</p>
                </div>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                © 2026 PayChain Financial Services Ltd. All rights reserved.
              </p>
              <Link to="/privacy-policy" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                View Privacy Policy →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsOfService;
