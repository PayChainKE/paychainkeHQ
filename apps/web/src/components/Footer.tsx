import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Youtube, Phone, Mail } from 'lucide-react';
import NewsletterSignup from './NewsletterSignup';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#00140c] text-gray-400 border-t border-emerald-900/20">
      <div className="container mx-auto px-6 py-12 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Link to="/" className="inline-block mb-4">
              <img src="/Home page/dark logo.png" alt="PayChain KE Logo" className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-emerald-100/50 max-w-sm leading-relaxed mb-6">
              The financial operating system built specifically for how business works in Kenya. Collect, pay, protect, and grow from one unified dashboard.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/PayChainKE" target="_blank" rel="noopener noreferrer" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/paychainke/" target="_blank" rel="noopener noreferrer" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://youtube.com/@paychainke?si=Gd-JO-cJpvQYhdui" target="_blank" rel="noopener noreferrer" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="text-white font-bold text-xs mb-4 uppercase tracking-widest">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-emerald-400 transition-colors">Home</Link></li>
              <li><Link to="/about" className="hover:text-emerald-400 transition-colors">Who We Are</Link></li>
              <li><Link to="/faq" className="hover:text-emerald-400 transition-colors">FAQs</Link></li>
              <li><Link to="/blog" className="hover:text-emerald-400 transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-emerald-400 transition-colors">Contact Us</Link></li>
              <li><Link to="/book-demo" className="hover:text-emerald-400 transition-colors">Book a Demo</Link></li>
            </ul>
          </div>

          {/* Solutions Links */}
          <div className="lg:col-span-3">
            <h4 className="text-white font-bold text-xs mb-4 uppercase tracking-widest">Solutions</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products/virtual-account" className="hover:text-emerald-400 transition-colors">Virtual Account</Link></li>
              <li><Link to="/products/inflation-shield" className="hover:text-emerald-400 transition-colors">Inflation Shield</Link></li>
              <li><Link to="/products/bulk-pay" className="hover:text-emerald-400 transition-colors">Bulk Payments</Link></li>
              <li><Link to="/products/cash-advance" className="hover:text-emerald-400 transition-colors">Cash Advance</Link></li>
            </ul>
          </div>

          {/* Stay Updated / Contact */}
          <div className="lg:col-span-3">
            <h4 className="text-white font-bold text-xs mb-4 uppercase tracking-widest text-center lg:text-left">Stay Updated</h4>
            <div className="scale-90 origin-left lg:origin-left flex justify-center lg:justify-start">
              <NewsletterSignup />
            </div>
            <div className="mt-4 space-y-2 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 text-xs text-emerald-100/40">
                <Phone className="w-3 h-3" />
                <span>0743283382</span>
              </div>
              <div className="flex flex-col gap-1 items-center lg:items-start">
                <div className="flex items-center gap-2 text-xs text-emerald-100/40">
                  <Mail className="w-3 h-3" />
                  <span className="font-bold text-emerald-400/60 uppercase text-[9px] tracking-wider">General:</span>
                  <span>info@paychain.co.ke</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-100/40">
                  <Mail className="w-3 h-3" />
                  <span className="font-bold text-emerald-400/60 uppercase text-[9px] tracking-wider">Support:</span>
                  <span>support@pychain.co.ke</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-emerald-900/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-bold text-emerald-100/50 tracking-[0.2em] uppercase">
            © 2026 PayChain Financial Services Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase text-emerald-100/50">
            <Link to="/privacy-policy" className="hover:text-emerald-400 transition-colors">Privacy</Link>
            <Link to="/terms-of-service" className="hover:text-emerald-400 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
