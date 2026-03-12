import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Mail, Phone, MapPin, Clock, CheckCircle } from 'lucide-react'

const spring = { type: 'spring', stiffness: 120, damping: 18 }

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', subject: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Please enter your name.'
    if (!form.email.trim()) e.email = 'Please enter your email.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Please enter a valid email.'
    if (!form.message.trim()) e.message = 'Please write a short message.'
    return e
  }

  function handleChange(key: string, value: string) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    setSuccess(false)
    // simulate API
    setTimeout(() => {
      setSubmitting(false)
      setSuccess(true)
      setForm({ name: '', email: '', company: '', phone: '', subject: '', message: '' })
    }, 900)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-[#0A192F] font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-20">
        <motion.header className="text-center mb-10" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0, transition: { ...spring } }} viewport={{ once: true }}>
          <h1 className="text-4xl font-extrabold">Contact & Support</h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">We're here to help: sales, partnerships, and technical support. Use the form or reach out directly using the contact details.</p>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.section className="bg-white border border-gray-100 rounded-2xl p-8 shadow-md" initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0, transition: { ...spring } }} viewport={{ once: true }}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Send us a message</h2>
              <div className="text-sm text-slate-500">Typical response: 24 hours</div>
            </div>

            {success && (
              <div className="mt-6 p-4 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-start gap-3">
                <CheckCircle className="w-5 h-5" />
                <div>Thanks — your message was sent. We'll respond shortly.</div>
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Full name</span>
                  <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} className="mt-2 px-3 py-2 border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#10B981]/20" placeholder="Jane Doe" aria-invalid={!!errors.name} />
                  {errors.name && <div className="mt-1 text-xs text-red-600">{errors.name}</div>}
                </label>

                <label className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Email</span>
                  <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="mt-2 px-3 py-2 border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#10B981]/20" placeholder="you@company.com" aria-invalid={!!errors.email} />
                  {errors.email && <div className="mt-1 text-xs text-red-600">{errors.email}</div>}
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Company (optional)</span>
                  <input value={form.company} onChange={(e) => handleChange('company', e.target.value)} className="mt-2 px-3 py-2 border border-gray-200 rounded-md bg-white" placeholder="Company name" />
                </label>

                <label className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Phone (optional)</span>
                  <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="mt-2 px-3 py-2 border border-gray-200 rounded-md bg-white" placeholder="+254 790 889 066" />
                </label>
              </div>

              <label className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">Subject</span>
                <input value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} className="mt-2 px-3 py-2 border border-gray-200 rounded-md bg-white" placeholder="Short summary" />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">Message</span>
                <textarea value={form.message} onChange={(e) => handleChange('message', e.target.value)} className="mt-2 px-3 py-3 border border-gray-200 rounded-md bg-white min-h-[160px] resize-y focus:ring-2 focus:ring-[#10B981]/20" placeholder="Describe your request" aria-invalid={!!errors.message} />
                {errors.message && <div className="mt-1 text-xs text-red-600">{errors.message}</div>}
              </label>

              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-600">Prefer a quicker reply? Email <a href="mailto:support@paychainke.co" className="text-[#0A192F] font-medium">support@paychainke.co</a></div>
                <button type="submit" disabled={submitting} className="inline-flex items-center px-6 py-2 bg-[#10B981] text-white rounded-md font-semibold hover:opacity-95 transition whitespace-nowrap">
                  {submitting ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </form>
          </motion.section>

          <motion.aside className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md" initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0, transition: { ...spring } }} viewport={{ once: true }}>
            <div className="p-6">
              <h3 className="text-lg font-semibold">Contact details</h3>
              <p className="mt-2 text-sm text-slate-600">Call or email for immediate assistance.</p>

              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
                    <Mail className="w-5 h-5 text-[#0A192F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <a href="mailto:hello@paychainke.co" className="text-[#0A192F] font-medium">hello@paychainke.co</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
                    <Phone className="w-5 h-5 text-[#0A192F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Phone</div>
                    <a href="tel:+254790889066" className="text-[#0A192F] font-medium">+254 790 889 066</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
                    <MapPin className="w-5 h-5 text-[#0A192F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Office</div>
                    <div className="text-slate-600">Nairobi, Kenya</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-md bg-gray-50 border border-gray-100">
                    <Clock className="w-5 h-5 text-[#0A192F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Hours</div>
                    <div className="text-slate-600">Mon — Fri: 9:00 — 17:00 EAT</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full h-44 p-4">
              <div className="w-full h-full rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                  <iframe
                    title="Nairobi map"
                    src="https://maps.google.com/maps?q=Nairobi&z=15&output=embed"
                    className="w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
              </div>
            </div>
          </motion.aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
