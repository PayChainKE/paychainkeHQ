import React from 'react';
import { Link } from 'react-router-dom';
import { LinkIcon, ClipboardCopy, PartyPopper, Code2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Two real ways to put PayChain checkout on a website today: paste a
// snippet (no code, live now — apps/merchant-dashboard/public/paychain-button.js)
// or build against the REST API (apps/v1/developer/*, also live, but this
// site's own /docs page deliberately still says "coming soon" for it — see
// that page's own comment. This page doesn't relitigate that; it stays
// focused on the no-code path and only briefly points technical readers
// onward, the same way Docs.tsx already does.
const steps = [
  {
    icon: LinkIcon,
    title: '1. Create a Payment Link',
    description: 'From your PayChain dashboard, Request Money → Payment Link. Set the amount, generate it — takes a few seconds, no setup.',
  },
  {
    icon: ClipboardCopy,
    title: '2. Copy the embed code',
    description: 'Right below your new link, click "Embed this as a button." Copy the two lines it gives you.',
  },
  {
    icon: Code2,
    title: '3. Paste it into your site',
    description: 'Drop it into a "Custom HTML" / "Embed" block on Wix, Shopify, WordPress, Squarespace, or any page builder that lets you add HTML. Save.',
  },
  {
    icon: PartyPopper,
    title: '4. You\'re live',
    description: 'A real "Pay with PayChain" button appears on your site. A customer clicks it, pays via M-Pesa, and you get paid, no developer involved.',
  },
];

const snippet = `<script src="https://app.paychain.co.ke/paychain-button.js" defer></script>
<div data-paychain-link="YOUR_LINK_ID" data-paychain-label="Pay KES 2,500"></div>`;

const Integrations: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#00bf63] mb-4">Live now</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Add PayChain checkout to your site. No code required.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Selling tickets, running an online store, or taking bookings on Wix, Shopify, or WordPress?
            Paste two lines into your site and get a real "Pay with PayChain" button, no developer needed.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-12">
          <div className="rounded-2xl bg-[#0A192F] p-5 sm:p-6 overflow-x-auto">
            <pre className="text-emerald-300 text-xs sm:text-sm font-mono leading-relaxed whitespace-pre">{snippet}</pre>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            That's the whole integration. <code className="text-gray-700">YOUR_LINK_ID</code> comes from your dashboard — nothing to install, nothing to configure.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {steps.map(({ icon: Icon, title, description }) => (
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
          <p className="text-gray-600 mb-6">
            Have a merchant account already? Get your embed code from your dashboard.
          </p>
          <Link
            to="/signin"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] rounded-lg transition-colors shadow-sm"
          >
            Go to your dashboard
          </Link>
        </div>

        <div className="max-w-3xl mx-auto mt-16 pt-10 border-t border-gray-100 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">Building something more custom?</p>
          <p className="text-sm text-gray-600 mb-4">
            A full REST API is available too, for carts, subscriptions, or your own checkout flow.
          </p>
          <Link to="/docs" className="text-sm font-bold text-[#00bf63] hover:text-[#00a857] transition-colors">
            See the Developer API →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Integrations;
