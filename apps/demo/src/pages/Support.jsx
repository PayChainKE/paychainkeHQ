import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'

export default function Support() {
  const [search, setSearch] = useState('')
  
  const solutions = [
    { title: 'Payments failing', icon: 'error_outline', desc: 'Common issues with M-Pesa' },
    { title: 'Cash Advance', icon: 'payments', desc: 'Eligibility and repayment' },
    { title: 'KYC Verification', icon: 'verified_user', desc: 'Status and requirements' },
    { title: 'Settlement delay', icon: 'schedule', desc: 'Bank processing times' },
  ]

  const faqs = [
    { q: 'How do I withdraw my USDC balance?', a: 'You can swap USDC back to KES in the Inflation Shield page and then settle to your bank account.' },
    { q: 'What are the transaction fees?', a: 'Paychain charges a flat 1.5% for collections and 0.5% for FX swaps. Bulk pay is free for employees.' },
    { q: 'Is my data secure?', a: 'Yes, we use bank-level encryption and all transactions are verified on-chain for maximum security.' },
  ]

  return (
    <MerchantLayout title="Support">
      <div className="px-1 lg:px-0 max-w-5xl mx-auto w-full space-y-8 lg:space-y-12">
        {/* Section 1: Hero Search */}
        <div className="text-center py-8 lg:py-16 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 lg:mb-6 border border-emerald-500/10 scale-in">
            <span className="material-symbols-outlined text-sm pulse">verified_user</span>
            Concierge Support
          </div>
          <h2 className="font-headline text-3xl lg:text-6xl text-primary tracking-tight mb-4 lg:mb-6 leading-tight">How can we help?</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mb-8 lg:mb-12 max-w-2xl mx-auto leading-relaxed opacity-80">Search our automated knowledge base or navigate the solution grid for instant resolution.</p>
          <div className="relative max-w-3xl mx-auto group">
            <span className="material-symbols-outlined absolute left-6 lg:left-8 top-1/2 -translate-y-1/2 text-primary text-2xl lg:text-3xl opacity-40 group-focus-within:opacity-100 transition-opacity">search</span>
            <input 
              className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-[24px] lg:rounded-[32px] py-4 lg:py-7 pl-14 lg:pl-20 pr-6 lg:pr-8 text-lg lg:text-xl font-medium shadow-2xl focus:ring-2 focus:ring-primary focus:shadow-[0_0_80px_rgba(0,105,92,0.1)] transition-all placeholder:text-outline-variant editorial-shadow"
              placeholder="Describe your issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mr-2 py-2 opacity-60">Trending:</span>
            {['Settlement', 'KYC Verification', 'M-Pesa API', 'USDC Protection'].map(t => (
              <button key={t} className="bg-surface-container-low/50 hover:bg-emerald-500/10 px-5 py-2 rounded-xl text-[10px] font-bold text-primary transition-all active:scale-95 border border-outline-variant/5">{t}</button>
            ))}
          </div>
        </div>

        {/* Section 2: Quick Solutions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up [animation-delay:100ms]">
          {solutions.map((s, i) => (
            <div key={i} className={`p-8 rounded-[40px] border border-outline-variant/5 shadow-sm hover:translate-y-[-8px] transition-all cursor-pointer group editorial-shadow ${
              i === 0 ? 'bg-emerald-500/5' : i === 1 ? 'bg-amber-500/5' : i === 2 ? 'bg-blue-500/5' : 'bg-indigo-500/5'
            }`}>
              <div className="w-14 h-14 rounded-[20px] bg-white/80 shadow-sm flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">{s.icon}</span>
              </div>
              <h4 className="text-sm font-bold text-primary mb-2">{s.title}</h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed opacity-70">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Section 3: FAQ & Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-headline text-2xl text-primary mb-6">Frequently Asked</h3>
            {faqs.map((f, i) => (
              <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm editorial-shadow">
                <div className="flex items-center justify-between cursor-pointer">
                  <p className="text-sm font-bold text-on-surface">{f.q}</p>
                  <span className="material-symbols-outlined text-sm text-primary">add</span>
                </div>
                <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed hidden">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0A2540] p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full -ml-16 -mb-16 blur-3xl"></div>
              <h3 className="font-headline text-2xl mb-2 relative z-10">Talk to us</h3>
              <p className="text-sm text-blue-100/60 mb-8 relative z-10 leading-relaxed">Our support team is available 24/7 to help you scale your business.</p>
              
              <div className="space-y-4 relative z-10">
                <button className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined">chat</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">WhatsApp Support</p>
                    <p className="text-[10px] text-blue-100/40">Instant response (2 mins)</p>
                  </div>
                </button>
                <button className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">Email Support</p>
                    <p className="text-[10px] text-blue-100/40">hello@paychainke.co</p>
                  </div>
                </button>
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0A2540] bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">S{i}</div>
                  ))}
                </div>
                <span className="text-[10px] font-medium text-blue-100/60">Sarah and 2 others are online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
