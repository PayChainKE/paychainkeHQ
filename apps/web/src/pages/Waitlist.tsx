import React, { useState } from 'react';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ShieldCheck, Users, TrendingUp, Banknote, LayoutDashboard, Check, AlertTriangle, TrendingDown, XCircle } from 'lucide-react';

const featurePills = [
  'Verified Smart Till',
  'Bulk Pay',
  'KES→USDC Inflation Shield',
  'Cash Advance',
];

const businessTypes = ['Retail Shop', 'Restaurant or Café', 'Import & Export', 'Service Agency', 'Other'];

function phoneSanitize(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits;
}

const Waitlist: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [challenge, setChallenge] = useState('');

  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!businessName.trim()) e.businessName = 'Business name is required';
    const digits = phoneSanitize(phone);
    if (!digits) e.phone = 'Phone number is required';
    else if (!(digits.length === 10 && digits.startsWith('07')) && !(digits.length === 12 && digits.startsWith('2547'))) e.phone = 'Enter a valid M-PESA number (07XX XXX XXX)';
    return e;
  };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      await api.post('/api/waitlist', {
        fullName,
        businessName,
        phone,
        email,
        businessType,
        challenge,
      });

      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      console.error('Waitlist error:', axiosError);
      const msg = axiosError.response?.data?.error || 'Unable to submit. Please try again.';
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  const whatsappText = encodeURIComponent(`I just joined the PayChain beta waitlist — Kenya's new merchant payment OS. Join here: https://www.paychain.co.ke`);
  const whatsappHref = `https://wa.me/?text=${whatsappText}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main style={{ marginTop: '2cm' }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* HERO */}
          <section className="flex-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4">Kenya's Smartest Merchant Dashboard<br/>Is Almost Here.</h1>

            <p className="text-lg text-muted-foreground max-w-2xl mb-6">PayChain is a verified M-PESA collection, bulk pay, KES→USDC swap, and working capital platform — built for Kenyan SMEs who are done with fraud, fragmentation, and banks that say no.</p>

            <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
              {featurePills.map((p) => (
                <div key={p} className="flex-shrink-0 bg-white/60 dark:bg-white/8 border border-gray-100 rounded-full px-4 py-2 text-sm font-medium shadow-sm">{p}</div>
              ))}
            </div>

            

            {/* SUPPORTING ZONE B (short preview) */}
            <section className="space-y-8 mt-6">
              <h2 className="text-xl font-semibold">Sound Familiar?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3 mb-3"><AlertTriangle className="w-5 h-5 text-amber-500" /><div className="font-semibold">The Fraud</div></div>
                  <p className="text-sm text-slate-600">A customer flashes a phone screen. The SMS looked real — but the money never arrived, and the goods are gone.</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3 mb-3"><TrendingDown className="w-5 h-5 text-rose-500" /><div className="font-semibold">The Shilling</div></div>
                  <p className="text-sm text-slate-600">You worked hard for that KES 300,000. Then the exchange rate moved and a third of your purchasing power disappeared.</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3 mb-3"><XCircle className="w-5 h-5 text-gray-700" /><div className="font-semibold">The Credit Wall</div></div>
                  <p className="text-sm text-slate-600">The bank wants collateral you don't have. So you borrow at punishing rates or don't grow.</p>
                </div>
              </div>
            </section>
          </section>

          {/* FORM CARD */}
          <aside className="w-full max-w-md lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl p-6 shadow-lg border">
              {!success ? (
                <form onSubmit={onSubmit} aria-labelledby="waitlist-title">
                  <h3 id="waitlist-title" className="text-xl font-semibold mb-1">Reserve Your Beta Spot</h3>
                  <p className="text-sm text-muted-foreground mb-4">Takes 60 seconds. No credit card required.</p>

                  <div className="space-y-3">
                    <label className="block">
                      <div className="text-sm font-medium">Full Name</div>
                      <input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Your full name" />
                      {errors.fullName && <div className="text-rose-500 text-sm mt-1">{errors.fullName}</div>}
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium">Business Name</div>
                      <input value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Your business name" />
                      {errors.businessName && <div className="text-rose-500 text-sm mt-1">{errors.businessName}</div>}
                    </label>

                    <label className="block">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Phone Number</span>
                      </div>
                      <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="07XX XXX XXX (M-PESA number)" />
                      <div className="text-xs text-muted-foreground mt-1">This is the number linked to your M-PESA account</div>
                      {errors.phone && <div className="text-rose-500 text-sm mt-1">{errors.phone}</div>}
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium">Email Address <span className="text-sm text-muted-foreground">(optional)</span></div>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="you@example.com" />
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium">Business Type</div>
                      <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">
                        <option value="">Select your business type</option>
                        {businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                      </select>
                    </label>

                    

                    <label className="block">
                      <div className="text-sm font-medium">What's your biggest payment challenge? <span className="text-sm text-muted-foreground">(optional)</span></div>
                      <textarea value={challenge} onChange={e => setChallenge(e.target.value)} placeholder="e.g. SMS fraud, manual payroll, forex costs..." className="mt-1 w-full rounded-md border px-3 py-2 h-24" />
                    </label>
                  </div>

                  {errors.form && <div className="text-rose-500 text-sm mt-3">{errors.form}</div>}

                  <div className="mt-6">
                    <button type="submit" disabled={loading} className="w-full h-13 px-4 py-3 bg-primary text-white rounded-lg text-lg font-medium flex items-center justify-center transform transition hover:scale-105">
                      {loading ? (
                        <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                      ) : null}
                      {loading ? 'Submitting...' : 'Reserve My Beta Spot →'}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">By joining you agree to our <a href="/privacy-policy" className="underline">privacy policy</a>. We never share your data with third parties.</p>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-2">You're on the list.</h3>
                  <p className="text-sm text-slate-600 mb-4">We'll be in touch before Q2 2026. In the meantime, share PayChain with a merchant who needs this.</p>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg">Share on WhatsApp</a>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Waitlist;
