import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ShieldCheck, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const SECTIONS = [
  { id: 's1', title: '1. Who We Are — Data Controller' },
  { id: 's2', title: '2. Personal Data We Collect' },
  { id: 's3', title: '3. How We Collect Personal Data' },
  { id: 's4', title: '4. Legal Basis for Processing' },
  { id: 's5', title: '5. How We Use Your Personal Data' },
  { id: 's6', title: '6. Sharing of Personal Data' },
  { id: 's7', title: '7. International Data Transfers' },
  { id: 's8', title: '8. Data Retention' },
  { id: 's9', title: '9. Your Rights Under the DPA 2019' },
  { id: 's10', title: '10. Cookies and Tracking Technologies' },
  { id: 's11', title: '11. Security Measures' },
  { id: 's12', title: "12. Children's Privacy" },
  { id: 's13', title: '13. Updates to This Privacy Policy' },
  { id: 's14', title: '14. Contact Us' },
];

const PrivacyPolicy: React.FC = () => {
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
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400">
                Data Protection Act, 2019 (Kenya) Compliant
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-emerald-100/60 max-w-2xl text-sm md:text-base leading-relaxed">
              How PayChain Financial Services Ltd collects, uses, stores, shares, and protects
              your personal data across the PayChain Platform.
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
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-emerald-600" /> info@paychain.co.ke</span>
              <a href="https://www.paychain.co.ke" className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition-colors">www.paychain.co.ke</a>
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
                  Questions about your data? Reach our Data Protection Officer at{' '}
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
              <p className="text-gray-600 leading-relaxed">
                This Privacy Policy explains how PayChain Financial Services Ltd ("PayChain", "we",
                "us", or "our") collects, uses, stores, shares, and protects personal data in
                connection with the PayChain Platform (paychain.co.ke) and all associated services.
              </p>
              <p className="text-gray-600 leading-relaxed">
                We are committed to protecting your privacy and processing your personal data in
                accordance with the Data Protection Act, 2019 (Kenya) ("DPA 2019"), the regulations
                and guidelines issued by the Office of the Data Protection Commissioner (ODPC) of
                Kenya, and any other applicable data protection laws.
              </p>
              <p className="text-gray-600 leading-relaxed">
                By accessing or using the PayChain Platform, you acknowledge that you have read,
                understood, and agree to the terms of this Privacy Policy.
              </p>

              <hr className="my-10 border-gray-200" />

              <section id="s1" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">1. Who We Are — Data Controller</h2>
                <p>
                  PayChain Financial Services Ltd is the Data Controller in respect of personal data
                  processed through the Platform.
                </p>
                <p>Contact details for data protection matters:</p>
                <div className="not-prose rounded-xl border border-gray-200 bg-gray-50 p-5 my-4 text-sm space-y-1.5">
                  <p><strong className="text-gray-800">Data Controller:</strong> <span className="text-gray-600">PayChain Financial Services Ltd</span></p>
                  <p><strong className="text-gray-800">Registration No.:</strong> <span className="text-gray-600">PVT-9L1QY658</span></p>
                  <p><strong className="text-gray-800">Address:</strong> <span className="text-gray-600">Nairobi, Kenya</span></p>
                  <p><strong className="text-gray-800">Email:</strong> <span className="text-gray-600">info@paychain.co.ke</span></p>
                  <p><strong className="text-gray-800">Phone:</strong> <span className="text-gray-600">+254 743 283 782</span></p>
                </div>
                <p>
                  We are in the process of registering with the Office of the Data Protection
                  Commissioner (ODPC) as required under Section 17 of the DPA 2019.
                </p>
              </section>

              <section id="s2" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">2. Personal Data We Collect</h2>
                <p>We collect the following categories of personal data:</p>

                <h3 className="text-lg mt-6 mb-2">2.1 Identity and Registration Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Full legal name</li>
                  <li>National ID number or Passport number</li>
                  <li>Date of birth</li>
                  <li>KRA Personal Identification Number (PIN)</li>
                  <li>Business registration number (where applicable)</li>
                  <li>Selfie / facial image (for identity verification)</li>
                  <li>Scanned copies of identification documents</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.2 Contact Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Mobile phone number (M-PESA registered number)</li>
                  <li>Email address</li>
                  <li>Physical business address</li>
                  <li>Postal address</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.3 Financial and Transaction Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>M-PESA till number, Paybill details, and your PayChain Virtual Account number</li>
                  <li>Transaction history: payment amounts, dates, counterparties, reference numbers</li>
                  <li>Bank account details (where provided for settlements)</li>
                  <li>USDC wallet address (for PROTECT users)</li>
                  <li>Credit and payment behaviour data (used to compute the Trust Score under GROW)</li>
                  <li>Loan application and repayment data (where applicable)</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.4 Business Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Business name, type, and sector</li>
                  <li>Business revenue and cash flow patterns (derived from transaction data)</li>
                  <li>Merchant payment verification records</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.5 Technical and Usage Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device type, operating system, and unique device identifiers</li>
                  <li>Log data: pages visited, features used, time spent, click patterns</li>
                  <li>API call logs</li>
                  <li>Session tokens and authentication records</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.6 Communications Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Customer support communications (email, in-app chat)</li>
                  <li>Survey responses and feedback</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">2.7 Sensitive Data</h3>
                <p>
                  PayChain does not intentionally collect special categories of sensitive personal
                  data (as defined in Section 45 of the DPA 2019). If any such data is inadvertently
                  collected, it will be deleted promptly. We do not collect biometric data beyond
                  facial images used strictly for identity verification.
                </p>
              </section>

              <section id="s3" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">3. How We Collect Personal Data</h2>
                <p>We collect personal data through the following means:</p>
                <p>
                  <strong>(a) Directly from you:</strong> when you register, complete KYC
                  verification, make transactions, contact support, or complete surveys.
                </p>
                <p>
                  <strong>(b) Automatically:</strong> through our Platform, APIs, and analytics
                  tools when you access the service (e.g., log files, cookies, device
                  fingerprinting).
                </p>
                <p><strong>(c) From third parties:</strong> including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Safaricom / NCBA Bank (M-PESA integration): transaction confirmations and mobile number data;</li>
                  <li>IPRS (Integrated Population Registration Service) / KRA: identity and PIN verification;</li>
                  <li>Credit Reference Bureaus (CRBs) licensed by the CBK: where relevant to GROW credit assessments;</li>
                  <li>Blockchain networks: on-chain transaction data for PROTECT;</li>
                  <li>KYC/AML verification partners (where engaged).</li>
                </ul>
              </section>

              <section id="s4" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">4. Legal Basis for Processing</h2>
                <div className="not-prose overflow-x-auto rounded-xl border border-gray-200 my-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 font-semibold">Purpose of Processing</th>
                        <th className="px-4 py-3 font-semibold">Legal Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ['Account registration and onboarding', 'Performance of contract / Consent'],
                        ['KYC and AML verification', 'Legal obligation (CBK/FRC regulations)'],
                        ['Processing payment transactions', 'Performance of contract'],
                        ['PROTECT (KES → USDC conversion)', 'Performance of contract / Consent'],
                        ['GROW Trust Score computation', 'Legitimate interest / Consent'],
                        ['Customer support', 'Performance of contract / Legitimate interest'],
                        ['Platform security and fraud prevention', 'Legitimate interest / Legal obligation'],
                        ['Regulatory and tax reporting (KRA)', 'Legal obligation'],
                        ['Platform analytics and improvement', 'Legitimate interest'],
                        ['Marketing communications', 'Consent (opt-in only)'],
                        ['Credit assessment (GROW lending)', 'Performance of contract / Consent'],
                      ].map(([purpose, basis]) => (
                        <tr key={purpose} className="text-gray-600">
                          <td className="px-4 py-3">{purpose}</td>
                          <td className="px-4 py-3">{basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="s5" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">5. How We Use Your Personal Data</h2>
                <p>We use your personal data for the following purposes:</p>

                <h3 className="text-lg mt-6 mb-2">5.1 Service Delivery</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Creating and managing your PayChain account;</li>
                  <li>(b) Processing payment transactions through COLLECT and PAY;</li>
                  <li>(c) Executing currency conversions through PROTECT;</li>
                  <li>(d) Computing your Trust Score and facilitating access to working capital under GROW;</li>
                  <li>(e) Sending transaction confirmations and notifications.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">5.2 Identity Verification and Compliance</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Verifying your identity and business registration for KYC compliance;</li>
                  <li>(b) Screening against watchlists and sanctions lists as required under the Proceeds of Crime and Anti-Money Laundering Act, 2009 (POCAMLA);</li>
                  <li>(c) Reporting suspicious transactions to the Financial Reporting Centre (FRC);</li>
                  <li>(d) Fulfilling tax reporting obligations to KRA.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">5.3 Security and Fraud Prevention</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Detecting, investigating, and preventing fraud, money laundering, and other financial crimes;</li>
                  <li>(b) Maintaining platform security and integrity;</li>
                  <li>(c) Monitoring for unauthorised access or unusual activity.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">5.4 Platform Improvement</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Analysing usage patterns to improve the Platform's features and user experience;</li>
                  <li>(b) Developing new products and services;</li>
                  <li>(c) Generating anonymised and aggregated insights (which do not identify you) for internal analytics and investor reporting.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">5.5 Marketing and Communications</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Sending you product updates, new feature announcements, and relevant offers — only where you have given your explicit consent;</li>
                  <li>(b) Responding to your support enquiries and feedback.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">5.6 Trust Score and Credit Decisions</h3>
                <p>
                  Your transaction data will be used to calculate your Trust Score. We will inform
                  you of the factors used in this calculation. Automated credit decisions based on
                  the Trust Score will be subject to human review upon your request.
                </p>
              </section>

              <section id="s6" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">6. Sharing of Personal Data</h2>
                <p>
                  We do not sell your personal data. We may share your personal data only in the
                  following circumstances:
                </p>

                <h3 className="text-lg mt-6 mb-2">6.1 Service Providers (Data Processors)</h3>
                <p>
                  We share data with trusted third-party service providers who process data on our
                  behalf under appropriate data processing agreements, including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Cloud infrastructure providers (e.g., AWS / GCP)</li>
                  <li>M-PESA / Safaricom / NCBA Bank (payment integration)</li>
                  <li>USDC / Circle (stablecoin services)</li>
                  <li>KYC/AML verification providers</li>
                  <li>Email and communication service providers</li>
                  <li>Analytics platforms</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">6.2 Financial Institutions and Lending Partners</h3>
                <p>
                  Under GROW, your anonymised or identified transaction data may be shared with
                  CBK-licensed lending partners or microfinance institutions for the purpose of
                  underwriting working capital facilities. We will obtain your explicit consent
                  before any such sharing.
                </p>

                <h3 className="text-lg mt-6 mb-2">6.3 Regulatory and Law Enforcement Authorities</h3>
                <p>We may disclose personal data to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The Central Bank of Kenya (CBK)</li>
                  <li>The Financial Reporting Centre (FRC)</li>
                  <li>Kenya Revenue Authority (KRA)</li>
                  <li>The Office of the Data Protection Commissioner (ODPC)</li>
                  <li>Law enforcement agencies — when required by law, court order, or legal process.</li>
                </ul>

                <h3 className="text-lg mt-6 mb-2">6.4 Business Transfers</h3>
                <p>
                  In the event of a merger, acquisition, or sale of the Company, personal data may
                  be transferred to the successor entity, subject to the acquirer agreeing to
                  honour the obligations of this Privacy Policy.
                </p>

                <h3 className="text-lg mt-6 mb-2">6.5 Consent</h3>
                <p>
                  We may share your data with other third parties where you have given your
                  explicit prior consent.
                </p>
              </section>

              <section id="s7" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">7. International Data Transfers</h2>
                <p>
                  Some of our service providers and infrastructure partners may be located outside
                  Kenya. Where personal data is transferred outside Kenya, we ensure that
                  appropriate safeguards are in place as required by Section 48 of the DPA 2019,
                  including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Transferring only to countries that the ODPC has determined provide an adequate level of data protection; or</li>
                  <li>(b) Entering into Standard Contractual Clauses (SCCs) or equivalent contractual protections with the recipient; or</li>
                  <li>(c) Obtaining your explicit consent for the transfer.</li>
                </ul>
              </section>

              <section id="s8" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">8. Data Retention</h2>
                <p>
                  We retain your personal data for as long as necessary to fulfil the purposes for
                  which it was collected, or as required by law:
                </p>
                <div className="not-prose overflow-x-auto rounded-xl border border-gray-200 my-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 font-semibold">Data Category</th>
                        <th className="px-4 py-3 font-semibold">Retention Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ['Account and identity data', 'Duration of account + 7 years after closure'],
                        ['Transaction records', '7 years (CBK / KRA regulatory requirement)'],
                        ['AML/KYC records', '7 years (POCAMLA requirement)'],
                        ['Communications and support records', '3 years from last interaction'],
                        ['Marketing consent records', 'Until consent is withdrawn + 3 years'],
                        ['Technical/log data', '12 months (rolling)'],
                        ['Trust Score computation data', 'Duration of account + 3 years'],
                      ].map(([category, period]) => (
                        <tr key={category} className="text-gray-600">
                          <td className="px-4 py-3">{category}</td>
                          <td className="px-4 py-3">{period}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Upon expiry of the applicable retention period, data will be securely deleted or
                  anonymised.
                </p>
              </section>

              <section id="s9" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">9. Your Rights Under the DPA 2019</h2>
                <p>
                  Under the Data Protection Act, 2019 (Kenya), you have the following rights in
                  respect of your personal data:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>9.1 Right of Access (Section 26):</strong> You have the right to obtain confirmation of whether we process your personal data, and to receive a copy of that data.</li>
                  <li><strong>9.2 Right to Rectification (Section 27):</strong> You have the right to require us to correct inaccurate or incomplete personal data.</li>
                  <li><strong>9.3 Right to Erasure (Section 39):</strong> You have the right to request deletion of your personal data where it is no longer necessary for the purpose for which it was collected, you withdraw consent, or the data has been unlawfully processed. This right is subject to statutory retention obligations.</li>
                  <li><strong>9.4 Right to Restrict Processing (Section 40):</strong> You have the right to request that we limit the processing of your data in certain circumstances.</li>
                  <li><strong>9.5 Right to Data Portability (Section 38):</strong> You have the right to receive your personal data in a structured, commonly used, machine-readable format and to transmit it to another controller.</li>
                  <li><strong>9.6 Right to Object (Section 41):</strong> You have the right to object to processing based on our legitimate interests.</li>
                  <li><strong>9.7 Rights Relating to Automated Decision-Making:</strong> Where the Trust Score or any credit decision is made solely by automated means with significant effects on you, you have the right to request human review, express your point of view, and contest the decision.</li>
                  <li><strong>9.8 Right to Withdraw Consent:</strong> Where processing is based on your consent, you may withdraw it at any time.</li>
                </ul>
                <p>
                  To exercise any of these rights, contact us at{' '}
                  <a href="mailto:admin@paychain.co.ke">admin@paychain.co.ke</a>. We will respond
                  within thirty (30) days. We may require you to verify your identity before
                  processing your request.
                </p>
                <p>
                  If you are dissatisfied with our response, you have the right to lodge a
                  complaint with the Office of the Data Protection Commissioner (ODPC):{' '}
                  <a href="https://odpc.go.ke" target="_blank" rel="noopener noreferrer">odpc.go.ke</a>.
                </p>
              </section>

              <section id="s10" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">10. Cookies and Tracking Technologies</h2>
                <p>
                  10.1 We use cookies and similar tracking technologies on our web Platform.
                  Cookies are small text files stored on your device that help us improve your
                  experience and analyse usage.
                </p>
                <p>10.2 Types of cookies we use:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Essential cookies:</strong> Required for the Platform to function (login sessions, security tokens).</li>
                  <li><strong>Analytics cookies:</strong> Help us understand how users interact with the Platform (e.g., Google Analytics or equivalent).</li>
                  <li><strong>Preference cookies:</strong> Store your settings and preferences.</li>
                </ul>
                <p>
                  10.3 You can control cookies through your browser settings. Disabling essential
                  cookies may impair Platform functionality.
                </p>
                <p>10.4 We do not use advertising or cross-site tracking cookies.</p>
              </section>

              <section id="s11" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">11. Security Measures</h2>
                <p>
                  We implement appropriate technical and organisational security measures to
                  protect your personal data against unauthorised access, disclosure, alteration,
                  or destruction, including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>(a) Encryption of all data in transit (TLS 1.3+) and at rest (AES-256);</li>
                  <li>(b) Role-based access controls (RBAC) limiting data access to authorised personnel;</li>
                  <li>(c) Multi-factor authentication (MFA) on all internal systems;</li>
                  <li>(d) Regular security audits and penetration testing;</li>
                  <li>(e) Comprehensive audit logging of all data access events;</li>
                  <li>(f) Strict vendor due diligence and data processing agreements with all processors;</li>
                  <li>(g) Incident response and breach notification procedures.</li>
                </ul>
                <p>
                  In the event of a personal data breach that is likely to result in a risk to your
                  rights, we will notify the ODPC within seventy-two (72) hours of becoming aware,
                  and notify affected data subjects without undue delay, as required by Section 43
                  of the DPA 2019.
                </p>
              </section>

              <section id="s12" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">12. Children's Privacy</h2>
                <p>
                  The PayChain Platform is not directed at, and we do not knowingly collect
                  personal data from, persons under the age of 18. If we become aware that we have
                  inadvertently collected data from a minor, we will delete it immediately. If you
                  believe we have collected data from a minor, please contact us at{' '}
                  <a href="mailto:admin@paychain.co.ke">admin@paychain.co.ke</a>.
                </p>
              </section>

              <section id="s13" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">13. Updates to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our
                  practices, the Platform, or applicable laws. We will notify you of material
                  changes by posting the updated policy on our website and, where required, by
                  direct notification via email or in-app alert. The updated policy will be
                  effective from the date indicated at the top of the document.
                </p>
              </section>

              <section id="s14" className="scroll-mt-24 mb-10">
                <h2 className="text-2xl mb-4">14. Contact Us</h2>
                <p>For all privacy-related enquiries, access requests, or complaints:</p>
                <div className="not-prose rounded-xl border border-emerald-100 bg-emerald-50/50 p-6 my-4">
                  <p className="font-bold text-gray-900 mb-1">PayChain Financial Services Ltd</p>
                  <p className="text-sm text-gray-500 mb-4">Attn: Data Protection Officer</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> Nairobi, Kenya</p>
                    <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-600" /> <a href="mailto:admin@paychain.co.ke" className="hover:text-emerald-700">admin@paychain.co.ke</a></p>
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-600" /> +254 743 283 782</p>
                    <p className="flex items-center gap-2">
                      Web:{' '}
                      <a href="https://www.paychain.co.ke/privacy-policy" className="hover:text-emerald-700">
                        https://www.paychain.co.ke/privacy-policy
                      </a>
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                © 2026 PayChain Financial Services Ltd. All rights reserved.
              </p>
              <Link to="/terms-of-service" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                View Terms of Service →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
