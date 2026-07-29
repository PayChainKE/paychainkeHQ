import React, { useState } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'

const SUPPORT_EMAIL = 'support@paychain.co.ke'
const SUPPORT_PHONE_DISPLAY = '+254 743 283 782'
const SUPPORT_PHONE_TEL = '+254743283782'
const SUPPORT_WHATSAPP = 'https://wa.me/254743283782'

export default function Support() {
  const { merchant } = useMerchantAuth()
  const [openFaq, setOpenFaq] = useState(0)

  const solutions = [
    { title: 'Payments failing', icon: 'error_outline', desc: 'Common issues with M-Pesa' },
    { title: 'Cash Advance', icon: 'payments', desc: 'Eligibility and repayment' },
    { title: 'KYC Verification', icon: 'verified_user', desc: 'Status and requirements' },
    { title: 'Settlement delay', icon: 'schedule', desc: 'Bank processing times' },
  ]

  const faqs = [
    { q: 'How do I withdraw my USDC balance?', a: 'Head to the Inflation Shield page and swap your USDC back to KES, then settle it straight to your bank account — no extra forms needed.' },
    { q: 'What are the transaction fees?', a: 'We charge a flat 1.5% on collections and 0.5% on FX swaps. Bulk Pay to your employees is completely free.' },
    { q: 'Is my data secure?', a: 'Yes. We use bank-level encryption, and every transaction is verified on-chain, so your money and your data stay protected.' },
    { q: 'How long does settlement take?', a: 'Most settlements land in your bank account within a few hours. If it takes longer than a business day, reach out and we\'ll look into it right away.' },
  ]

  const firstName = (merchant?.businessName || '').split(' ')[0]

  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sent, setSent] = useState(false)

  const submitMessage = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !messageBody.trim()) {
      setSendError('Please fill in a subject and your message.')
      return
    }
    setSending(true)
    setSendError('')
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      await axios.post(`${API_URL}/api/contact`, {
        name: merchant?.businessName || 'Merchant',
        email: merchant?.email || '',
        phone: merchant?.phone || '',
        contactType: 'merchant',
        subject: subject.trim(),
        message: messageBody.trim(),
      })
      setSent(true)
      setSubject('')
      setMessageBody('')
    } catch (err) {
      setSendError(err?.response?.data?.error || 'Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <MerchantLayout title="Support">
      <div className="px-1 lg:px-0 max-w-5xl mx-auto w-full space-y-8 lg:space-y-12">
        {/* Section 1 + 2: Hero Search & Quick Solutions */}
        <div className="animate-fade-in-up">
          <div className="text-center pt-8 lg:pt-16 pb-6 lg:pb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 lg:mb-6 border border-emerald-500/10 scale-in">
              <span className="material-symbols-outlined text-sm pulse">support_agent</span>
              Concierge Support
            </div>
            <h2 className="font-headline text-4xl lg:text-5xl text-primary tracking-tight mb-3 leading-tight">
              {firstName ? `Hi ${firstName}, how can we help?` : 'How can we help?'}
            </h2>
            <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium max-w-2xl mx-auto leading-relaxed opacity-80">
              Browse quick solutions below, or reach a real person on our team — we typically reply in minutes, not days.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {solutions.map((s, i) => (
              <div key={s.title} className={`p-5 lg:p-8 rounded-[24px] lg:rounded-[40px] border border-outline-variant/5 shadow-sm hover:translate-y-[-8px] transition-all cursor-pointer group editorial-shadow ${
                i % 4 === 0 ? 'bg-emerald-500/5' : i % 4 === 1 ? 'bg-amber-500/5' : i % 4 === 2 ? 'bg-blue-500/5' : 'bg-indigo-500/5'
              }`}>
                <span className="material-symbols-outlined text-primary text-2xl lg:text-3xl mb-4 lg:mb-6 block group-hover:scale-110 transition-transform">{s.icon}</span>
                <h4 className="text-sm font-bold text-primary mb-2">{s.title}</h4>
                <p className="text-[11px] text-on-surface-variant leading-relaxed opacity-70">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Send a message to the admin team */}
        <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 shadow-sm editorial-shadow overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left: promotional / trust panel */}
          <div className="lg:col-span-5 bg-[#062A22] text-white p-10 lg:p-12 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 rounded-full -ml-16 -mb-16 blur-3xl"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-8 border border-white/10">
                <span className="material-symbols-outlined text-sm text-[#5EFEB3]">workspace_premium</span>
                Priority Merchant Line
              </div>
              <h3 className="font-headline text-2xl lg:text-[28px] leading-tight mb-4">
                Write it once. A real person reads every word.
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-10">
                No bots, no ticket mazes. Messages sent here go directly into our team's inbox and are handled by the same people who manage your account.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#5EFEB3] text-xl mt-0.5">bolt</span>
                  <div>
                    <p className="text-[13px] font-bold">Fast turnaround</p>
                    <p className="text-[11px] text-white/50">Most messages are answered within a few hours.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#5EFEB3] text-xl mt-0.5">lock</span>
                  <div>
                    <p className="text-[13px] font-bold">Private &amp; secure</p>
                    <p className="text-[11px] text-white/50">Only your account team can see what you send.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#5EFEB3] text-xl mt-0.5">mark_email_read</span>
                  <div>
                    <p className="text-[13px] font-bold">Reply by email</p>
                    <p className="text-[11px] text-white/50">We'll follow up directly on your registered email.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 relative z-10">
              <div className="flex -space-x-2 mb-3">
                {['G', 'J', 'K'].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#062A22] bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-[#5EFEB3]">{i}</div>
                ))}
              </div>
              <p className="text-[11px] text-white/50">Trusted by merchants across Nairobi, Mombasa &amp; Kisumu.</p>
            </div>
          </div>

          {/* Right: the form */}
          <div className="lg:col-span-7 p-10 lg:p-12">
            <h3 className="font-headline text-xl text-primary leading-tight mb-1.5">Send us a message</h3>
            <p className="text-[12px] text-on-surface-variant leading-relaxed opacity-70 mb-8">
              Prefer to write it down? We'll reply straight to your email.
            </p>

            {sent ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-5">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <p className="text-base font-bold text-on-surface mb-1.5">Message sent!</p>
                <p className="text-[13px] text-on-surface-variant leading-relaxed opacity-70 mb-6 max-w-sm">
                  Our team has received it and will get back to you at {merchant?.email || 'your email'} shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submitMessage} className="space-y-5 max-w-xl">
                <div>
                  <label htmlFor="support-subject" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
                    Subject
                  </label>
                  <input
                    id="support-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    disabled={sending}
                    className="w-full px-4 py-3 border border-outline-variant/20 rounded-2xl text-[13px] font-medium focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="support-message" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
                    Message
                  </label>
                  <textarea
                    id="support-message"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    rows={6}
                    placeholder="Tell us what's going on…"
                    disabled={sending}
                    className="w-full px-4 py-3 border border-outline-variant/20 rounded-2xl text-[13px] leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none disabled:opacity-50"
                  />
                </div>
                {sendError && <p className="text-[12px] text-red-600 font-medium">{sendError}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-[#0B0E14] text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-black active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Section 4: FAQ & Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-headline text-2xl text-primary mb-6">Frequently Asked</h3>
            {faqs.map((f, i) => {
              const isOpen = openFaq === i
              return (
                <div key={f.q} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm editorial-shadow overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  >
                    <p className="text-sm font-bold text-on-surface">{f.q}</p>
                    <span className={`material-symbols-outlined text-lg text-primary shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>add</span>
                  </button>
                  {isOpen && (
                    <p className="px-6 pb-6 -mt-2 text-[13px] text-on-surface-variant leading-relaxed">{f.a}</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0A2540] p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full -ml-16 -mb-16 blur-3xl"></div>

              <div className="flex items-center gap-4 relative z-10 mb-6">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                    <span className="material-symbols-outlined text-2xl">support_agent</span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0A2540]"></span>
                </div>
                <div>
                  <p className="font-headline text-lg leading-tight">Our Support Team</p>
                  <p className="text-[11px] text-blue-100/60">Here to help, every step of the way</p>
                </div>
              </div>

              <p className="text-sm text-blue-100/70 mb-8 relative z-10 leading-relaxed">
                Reach out any time and a member of our Nairobi team will respond personally — usually within a couple of minutes.
              </p>

              <div className="space-y-3 relative z-10">
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined">chat</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">WhatsApp Support</p>
                    <p className="text-[10px] text-blue-100/40">Usually replies in under 2 mins</p>
                  </div>
                </a>
                <a href={`tel:${SUPPORT_PHONE_TEL}`} className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <span className="material-symbols-outlined">call</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">Call Us</p>
                    <p className="text-[10px] text-blue-100/40">{SUPPORT_PHONE_DISPLAY}</p>
                  </div>
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">Email Support</p>
                    <p className="text-[10px] text-blue-100/40">{SUPPORT_EMAIL}</p>
                  </div>
                </a>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                <p className="text-[10px] font-medium text-blue-100/50 leading-relaxed">
                  Mon – Sat, 7:00 AM – 9:00 PM (Nairobi time). Outside these hours, drop us a message and we'll respond first thing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
