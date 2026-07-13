import React, { useState } from 'react';
import { AxiosError } from 'axios';
import { motion, type Variants } from 'framer-motion';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  ShieldCheck, Users, TrendingUp, Banknote, LayoutDashboard, 
  Check, AlertTriangle, TrendingDown, XCircle, ArrowRight,
  Zap, FileCheck, Wallet, ChevronRight
} from 'lucide-react';

const featurePills = [
  { label: 'Verified Virtual Account', icon: Zap },
  { label: 'Bulk Pay', icon: Users },
  { label: 'Inflation Shield', icon: ShieldCheck },
  { label: 'Cash Advance', icon: TrendingUp },
];

const businessTypes = ['Retail Shop', 'Restaurant or Café', 'Import & Export', 'Service Agency', 'Other'];

function phoneSanitize(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

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
    
    // Phone Validation
    const digits = phoneSanitize(phone);
    if (!digits) {
      e.phone = 'Phone number is required';
    } else if (!((digits.length === 10 && digits.startsWith('07')) || (digits.length === 12 && digits.startsWith('2547')))) {
      e.phone = 'Enter a valid M-PESA number (07XX XXX XXX)';
    }

    // Email Validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      e.email = 'Email address is required';
    } else if (!emailRe.test(email.trim())) {
      e.email = 'Please enter a valid email address';
    }
    
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
      
      if (msg.toLowerCase().includes('email')) {
        setErrors({ email: msg });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const whatsappText = encodeURIComponent(`I just joined the PayChain beta waitlist, Kenya's new merchant payment OS. Join here: https://www.paychain.co.ke`);
  const whatsappHref = `https://wa.me/?text=${whatsappText}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-foreground font-display selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />
      <a href="/" className="inline-block mb-4 text-sm text-emerald-600 hover:underline">Back to Home</a>

      <main className="relative pt-28 pb-20 lg:pt-40 lg:pb-40 overflow-hidden">
        {/* Top Professional Angled Separator */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] z-10 pointer-events-none rotate-180">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-12 sm:h-20 lg:h-48">
            <polygon points="0,100 1440,0 1440,100" className="fill-[#00351d]" />
          </svg>
        </div>

        {/* Professional Grid Pattern */}
        <div className="absolute inset-0 -z-10 pointer-events-none opacity-[0.03]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}>
        </div>

        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center"
          >
            {/* LEFT COLUMN: Content */}
            <div className="lg:col-span-6 space-y-6 lg:space-y-8">
              <motion.div variants={itemVariants} className="space-y-4">
            <a href="/" className="inline-block mb-4 text-sm text-emerald-600 hover:underline">Back to Home</a>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.2] lg:leading-[1.1]">
              Kenya's Smartest <br/>
              <span className="text-emerald-600">Merchant Dashboard</span> <br/>
              Is Almost Here.
            </h1>

                <p className="text-base sm:text-lg text-slate-600 max-w-lg leading-relaxed">
                  PayChain is the unified operating system for Kenyan SMEs. Verified M-PESA collection, bulk pay, and inflation-shielded treasury management all in one place.
                </p>

                <div className="flex flex-wrap gap-3">
                  {featurePills.map((p) => (
                    <div key={p.label} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-default">
                      <p.icon className="w-4 h-4 text-emerald-500" />
                      {p.label}
                    </div>
                  ))}
                </div>
              </motion.div>


            </div>

            {/* RIGHT COLUMN: Form Card */}
            <aside className="lg:col-span-6 lg:sticky lg:top-32 h-fit">
              <motion.div 
                variants={itemVariants}
                className="relative"
              >
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_40px_-12px_rgba(10,25,47,0.08)] border border-slate-100">
                  {!success ? (
                    <form onSubmit={onSubmit} className="space-y-5">
                      <div className="space-y-1 text-center mb-6">
                        <h3 className="text-2xl font-bold text-slate-900">Secure Your Spot</h3>
                        <p className="text-sm text-slate-500">Join the elite 1% of Kenyan merchants.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 ml-1">Full Name</label>
                          <input 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 text-sm" 
                            placeholder="e.g. John Doe" 
                          />
                          {errors.fullName && <p className="text-rose-500 text-[10px] font-medium ml-1">{errors.fullName}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 ml-1">Business Name</label>
                          <input 
                            value={businessName} 
                            onChange={e => setBusinessName(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 text-sm" 
                            placeholder="e.g. Acme Retail" 
                          />
                          {errors.businessName && <p className="text-rose-500 text-[10px] font-medium ml-1">{errors.businessName}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 ml-1">Phone Number</label>
                          <input 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 text-sm" 
                            placeholder="07XX XXX XXX" 
                          />
                          {errors.phone && <p className="text-rose-500 text-[10px] font-medium ml-1">{errors.phone}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 ml-1">Email Address</label>
                          <input 
                            type="email"
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 text-sm" 
                            placeholder="john@example.com" 
                          />
                          {errors.email && <p className="text-rose-500 text-[10px] font-medium ml-1">{errors.email}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 ml-1">Business Type</label>
                          <select 
                            value={businessType} 
                            onChange={e => setBusinessType(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 appearance-none text-sm"
                          >
                            <option value="">Select category</option>
                            {businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                          </select>
                        </div>
                      </div>

                      {errors.form && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 flex items-center gap-2 text-rose-600 text-xs font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          {errors.form}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-500/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {loading ? (
                          <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            Join Waitlist
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold">
                        Institutional Grade Security · Verified VASP
                      </p>
                    </form>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12 space-y-8"
                    >
                      <div className="mx-auto w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
                        <Check className="w-12 h-12 text-emerald-600 relative z-10" />
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-bold text-slate-900">Success!</h3>
                        <p className="text-slate-600">You're officially on the waitlist. We'll be in touch soon with next steps.</p>
                      </div>
                      <div className="pt-4">
                        <a 
                          href={whatsappHref} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-2xl font-bold shadow-lg shadow-green-500/20 hover:scale-105 transition-transform"
                        >
                          Share on WhatsApp
                        </a>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </aside>
          </motion.div>
        </div>

        {/* Professional Angled Separator */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] z-10 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-20 sm:h-32 lg:h-48">
            <polygon points="0,100 1440,0 1440,100" className="fill-[#00351d]" />
          </svg>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Waitlist;
