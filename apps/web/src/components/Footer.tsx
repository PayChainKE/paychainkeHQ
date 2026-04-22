import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: 'Successfully subscribed!' });
        setEmail('');
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to subscribe' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Unable to connect to server' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Newsletter Section */}
        <div className="mb-12 pb-12 border-b border-border">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-left max-w-md">
              <h3 className="text-2xl font-bold text-foreground mb-2">Join the PayChain Newsletter</h3>
              <p className="text-muted-foreground text-sm">
                Get the latest insights on Kenya's fintech landscape, fraud prevention, and product updates delivered to your inbox.
              </p>
            </div>
            <div className="w-full max-w-md">
              <form onSubmit={onSubscribe} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-white rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
              {status && (
                <div className={`mt-3 text-sm font-medium ${status.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {status.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo 2.png" alt="PayChain KE Logo" className="h-20 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Blockchain-verified payment verification for Kenyan merchants. Eliminating fake SMS fraud with
              real-time M-Pesa verification.
            </p>
            <div className="flex gap-4 mt-4">
              <a href="tel:0790889066" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
              <a href="https://x.com/PayChainKE" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/company/paychainke/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">API Reference</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
              <li>
                <div className="hover:text-primary transition-colors">
                  <div className="font-medium">Contact</div>
                  <div className="text-xs mt-1">Call: 0790889066</div>
                </div>
              </li>
              <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-black font-bold">
            © 2026 payChainKE.
          </p>
          <div className="flex gap-6 text-xs">
            <Link to="/privacy-policy" className="text-black font-bold hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="text-black font-bold hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
