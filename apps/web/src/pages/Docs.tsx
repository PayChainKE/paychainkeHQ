import React from 'react';
import { Link } from 'react-router-dom';
import { Webhook, CreditCard, Link2, Receipt, ArrowRight, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// This route used to render a self-contained mock docs page (fake base URL,
// fake "Truth Ping"/"POS SDK" endpoints, an M-Pesa-callback framing that
// doesn't match the real NCBA-rail integration) — content that was simply
// wrong. The real Developer API isn't publicly self-serve yet, so rather
// than fake or pre-announce docs that don't exist for outside developers
// yet, this stays a "coming soon" page — now with a pointer to what's
// already live today (the no-code embed button, /integrations) so a
// visitor with an immediate need isn't stuck waiting on this one.
const upcoming = [
  { icon: CreditCard, title: 'Collections & payouts', description: 'Trigger M-Pesa/Airtel collections and send payouts to mobile money, bank, Paybill, or Till, all programmatically.' },
  { icon: Webhook, title: 'Real-time webhooks', description: 'Subscribe to payment and payout events instead of polling for status.' },
  { icon: Link2, title: 'Hosted checkout', description: 'Generate a payment page for any order without building your own checkout UI.' },
  { icon: Receipt, title: 'Electronic invoicing', description: 'Create, send, and track real, payable invoices, with delivery and payment status pushed to you.' },
];

const codePreview = `curl -X POST https://api.paychain.co.ke/payments/collect \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: order-4471" \\
  -d '{"amount": 2500, "phone": "2547XXXXXXXX"}'`;

const Docs: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-32 pb-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00bf63]/10 border border-[#00bf63]/20 text-xs font-bold uppercase tracking-widest text-[#00bf63] mb-6">
            Coming soon
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-5 leading-[1.1]">
            A payments API built for Kenya
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            One key, plain REST, no SDK required. Collect by STK push, pay out to a bank or wallet, and
            know the instant either happens, built directly on PayChain's own settlement infrastructure.
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6">
            {['One secret key', 'Plain REST, no SDK', 'Free sandbox, no approval needed'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                <CheckCircle2 className="w-4 h-4 text-[#00bf63]" />
                {t}
              </span>
            ))}
          </div>

          <a
            href="https://developer.paychain.co.ke/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 mt-8 text-sm font-bold text-white bg-[#0A192F] hover:bg-[#112240] rounded-lg transition-colors shadow-sm"
          >
            View Developer Docs
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="max-w-2xl mx-auto mt-14">
          <div className="rounded-2xl bg-[#0A192F] p-6 sm:p-7 shadow-xl shadow-[#0A192F]/10 overflow-x-auto">
            <div className="flex items-center gap-1.5 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
            </div>
            <pre className="text-emerald-300 text-xs sm:text-sm font-mono leading-relaxed whitespace-pre">{codePreview}</pre>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">A preview of the shape this API will take, not yet live for external integrations.</p>
        </div>

        <div className="max-w-4xl mx-auto mt-20 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {upcoming.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group p-7 rounded-3xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-[#00bf63]/30 hover:shadow-lg transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#00bf63]/10 group-hover:bg-[#00bf63]/15 flex items-center justify-center mb-5 transition-colors">
                <Icon className="w-5 h-5 text-[#00bf63]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-[15px]">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-20">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/60 p-8 sm:p-10 text-center">
            <p className="text-sm font-semibold text-gray-900 mb-1.5">Don't need an API right now?</p>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
              A no-code checkout button is already live, paste two lines into any website and start
              accepting payments today, no developer required.
            </p>
            <Link
              to="/integrations"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00bf63] hover:text-[#00a857] transition-colors"
            >
              See no-code integrations
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto mt-16 text-center">
          <p className="text-gray-600 mb-6">Want early access when the API launches?</p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] rounded-lg transition-colors shadow-sm"
          >
            Get in touch
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Docs;
