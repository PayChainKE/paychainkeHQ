import React from "react";
import { Link } from "react-router-dom";
import { Twitter, Linkedin, Youtube, Mail } from "lucide-react";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle mt-10">
      <div className="max-w-[90rem] mx-auto px-6 lg:px-12 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="text-[12.5px] text-ink-faint leading-6 mt-3 max-w-xs">
              The financial operating system built for how business works in Kenya — collect, pay,
              and reconcile from one API.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="https://x.com/PayChainKE" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors" aria-label="X (Twitter)"><Twitter className="w-3.5 h-3.5" /></a>
              <a href="https://www.linkedin.com/company/paychainke/" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors" aria-label="LinkedIn"><Linkedin className="w-3.5 h-3.5" /></a>
              <a href="https://youtube.com/@paychainke?si=Gd-JO-cJpvQYhdui" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors" aria-label="YouTube"><Youtube className="w-3.5 h-3.5" /></a>
              <a href="mailto:support@paychain.co.ke" className="text-ink-faint hover:text-brand-bright transition-colors" aria-label="Email"><Mail className="w-3.5 h-3.5" /></a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">Products</p>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/payment-collection" className="text-ink-muted hover:text-ink transition-colors">Payment Collection</Link></li>
              <li><Link to="/send-money" className="text-ink-muted hover:text-ink transition-colors">Send Money</Link></li>
              <li><Link to="/invoices" className="text-ink-muted hover:text-ink transition-colors">Invoices</Link></li>
              <li><Link to="/bulk-payments" className="text-ink-muted hover:text-ink transition-colors">Bulk Payments</Link></li>
              <li><Link to="/webhooks" className="text-ink-muted hover:text-ink transition-colors">Webhooks</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">Resources</p>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/integration-guide" className="text-ink-muted hover:text-ink transition-colors">Integration guide</Link></li>
              <li><Link to="/guides" className="text-ink-muted hover:text-ink transition-colors">Guides</Link></li>
              <li><Link to="/errors" className="text-ink-muted hover:text-ink transition-colors">Errors &amp; idempotency</Link></li>
              <li><a href="https://paychain.co.ke" className="text-ink-muted hover:text-ink transition-colors">paychain.co.ke</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">Support</p>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/help" className="text-ink-muted hover:text-ink transition-colors">Help &amp; support</Link></li>
              <li><Link to="/contact" className="text-ink-muted hover:text-ink transition-colors">Contact us</Link></li>
              <li><a href="mailto:support@paychain.co.ke" className="text-ink-muted hover:text-ink transition-colors">support@paychain.co.ke</a></li>
              <li><a href="tel:+254743283782" className="text-ink-muted hover:text-ink transition-colors">+254 743 283 782</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-medium text-ink-faint">
            © {new Date().getFullYear()} PayChain Financial Services Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-[11px] font-medium text-ink-faint">
            <Link to="/privacy-policy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
