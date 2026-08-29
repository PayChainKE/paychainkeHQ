import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Youtube, Instagram, Phone, Mail } from 'lucide-react';
import NewsletterSignup from './NewsletterSignup';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.1h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.17 8.17 0 0 1-1.26-4.4c0-4.53 3.69-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.42a8.15 8.15 0 0 1 2.41 5.81c0 4.53-3.69 8.22-8.21 8.22Zm4.51-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14 0-.31-.02-.47-.02-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.06 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.68 4.25 3.75.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z"/>
  </svg>
);

const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1Z"/>
  </svg>
);

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
              <a href="https://whatsapp.com/channel/0029VbCCtVbG8l57njxDDK2D" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on WhatsApp Channel" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <WhatsAppIcon className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/paychainke/" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on LinkedIn" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://x.com/PayChainKE" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on X (Twitter)" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://www.instagram.com/paychainke_hq" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on Instagram" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://youtube.com/@paychainke" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on YouTube" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="https://www.tiktok.com/@paychain6" target="_blank" rel="noopener noreferrer" aria-label="PayChain KE on TikTok" className="text-emerald-100/30 hover:text-emerald-400 transition-colors">
                <TikTokIcon className="w-4 h-4" />
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
              <li><Link to="/products/bulk-pay" className="hover:text-emerald-400 transition-colors">Bulk Payments</Link></li>
              <li><Link to="/products/cash-advance" className="hover:text-emerald-400 transition-colors">Cash Advance</Link></li>
              <li><Link to="/products/operations-tools" className="hover:text-emerald-400 transition-colors">Operations Tools</Link></li>
              <li>
                <Link to="/products/inflation-shield" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                  <span>Inflation Shield</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70 border border-emerald-400/30 rounded-full px-2 py-0.5">Soon</span>
                </Link>
              </li>
              <li>
                <Link to="/docs" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                  <span>Developer API</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70 border border-emerald-400/30 rounded-full px-2 py-0.5">Coming Soon</span>
                </Link>
              </li>
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
                <span>0743283782</span>
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
                  <span>support@paychain.co.ke</span>
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
