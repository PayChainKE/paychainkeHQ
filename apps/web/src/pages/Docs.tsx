import React from 'react';
import { Link } from 'react-router-dom';
import { Webhook, CreditCard, Link2, FileCheck2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// This route used to render a self-contained mock docs page (fake base URL,
// fake "Truth Ping"/"POS SDK" endpoints, an M-Pesa-callback framing that
// doesn't match the real NCBA-rail integration) — content that was simply
// wrong. The real Developer API isn't publicly self-serve yet, so rather
// than fake or pre-announce docs that don't exist for outside developers
// yet, this is a straightforward "coming soon" page.
const upcoming = [
  { icon: CreditCard, title: 'Collections & payouts', description: 'Trigger M-Pesa/Airtel collections and send payouts to mobile money, bank, Paybill, or Till — all programmatically.' },
  { icon: Webhook, title: 'Real-time webhooks', description: 'Subscribe to payment and payout events instead of polling for status.' },
  { icon: Link2, title: 'Hosted checkout', description: 'Generate a payment page for any order without building your own checkout UI.' },
  { icon: FileCheck2, title: 'KRA-compliant receipts', description: 'Fiscal receipts signed through KRA eTIMS on every sale, ready for tax compliance.' },
];

const Docs: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#00bf63] mb-4">Coming Soon</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">The PayChain API</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            A developer API for building custom payment flows directly on PayChain's infrastructure —
            not yet publicly available, but on its way.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {upcoming.map(({ icon: Icon, title, description }) => (
            <div key={title} className="p-6 rounded-2xl border border-gray-100 bg-gray-50/60">
              <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#00bf63]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-16 text-center">
          <p className="text-gray-600 mb-6">Want early access when it launches?</p>
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
