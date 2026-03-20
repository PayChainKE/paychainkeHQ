import React, { useEffect, useMemo, useRef, useState } from 'react';
import './contact.css';

type ContactType =
  | 'merchant'
  | 'investor'
  | 'partnership'
  | 'press'
  | 'developer'
  | 'careers'
  | 'other'
  | '';

const CONTACT_EMAIL = 'hello@paychainke.co';
const CONTACT_PHONE = '+254 790 889 066';

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'merchant', label: 'Merchant or Business Owner' },
  { value: 'investor', label: 'Investor' },
  { value: 'partnership', label: 'Partnership or Business Development' },
  { value: 'press', label: 'Journalist or Media' },
  { value: 'developer', label: 'Developer or Technical Partner' },
  { value: 'careers', label: 'Job Applicant' },
  { value: 'other', label: 'Other' }
];

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7.5v9A2.5 2.5 0 005.5 19h13A2.5 2.5 0 0021 16.5v-9" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 7l-9 6-9-6" stroke="#1D9E75" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 013.08 4.18 2 2 0 015.09 2h3a2 2 0 012 1.72c.12.87.36 1.72.72 2.5a2 2 0 01-.45 2.11L9.91 9.91a12.18 12.18 0 005.17 5.17l1.58-1.58a2 2 0 012.11-.45c.78.36 1.63.6 2.5.72A2 2 0 0122 16.92z" stroke="#1D9E75" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1118 0z" stroke="#1D9E75" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="#1D9E75" strokeWidth="1.2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#1D9E75" strokeWidth="1.4" />
      <path d="M12 7v6l4 2" stroke="#1D9E75" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Contact(): JSX.Element {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    contactType: '' as ContactType,
    subject: '',
    message: '',
    referralSource: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setCharCount(form.message.length), [form.message]);

  const validate = () => {
    const v: Record<string, string> = {};
    if (!form.name || form.name.trim().length < 2) v.name = 'Please enter your full name';
    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) v.email = 'Please enter a valid email address';
    if (!form.contactType) v.contactType = 'Please select the option that best describes you';
    if (!form.subject || form.subject.trim().length < 3) v.subject = 'Please enter a subject line';
    if (!form.message || form.message.trim().length < 10) v.message = 'Please enter your message (minimum 10 characters)';
    return v;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }

    setSending(true);
    setErrors({});

    // TODO: Replace simulation with API call
    // POST /api/contact
    // Body: { name, email, phone, contactType, subject, message, referralSource }

    // Simulate network call per requirements (1.5s)
    setTimeout(() => {
      setSending(false);
      setSuccessEmail(form.email);
      setForm({ name: '', email: '', phone: '', contactType: '', subject: '', message: '', referralSource: '' });
      setCharCount(0);
      if (messageRef.current) messageRef.current.blur();
    }, 1500);
  };

  const contactCards = useMemo(() => [
    {
      id: 'merchant',
      icon: <MailIcon />,
      label: 'Merchant Support',
      headline: "Questions about your account, the waitlist, or how PayChain works?",
      body: "Our support team is Nairobi-based and responds to every message personally. Whether you want to understand how Cash Advance eligibility works, need help with your waitlist application, or just want to know if PayChain is right for your business — ask us directly.",
      response: 'We respond within 24 hours on business days',
      email: `mailto:${CONTACT_EMAIL}`,
      phone: `tel:+254790889066`
    },
    {
      id: 'partnerships',
      icon: <MapPinIcon />,
      label: 'Partnerships',
      headline: 'Looking to partner, integrate, or build with PayChain?',
      body: "We are actively pursuing partnerships with Kenyan trade associations, SACCOs, financial institutions, accounting software providers, and any organization whose members would benefit from PayChain's infrastructure. If you work with Kenyan SMEs — let's talk.",
      response: 'We respond within 48 hours',
      email: `mailto:partnerships@paychain.co.ke`
    },
    {
      id: 'investors',
      icon: <PhoneIcon />,
      label: 'Investor Relations',
      headline: 'Interested in what we\'re building and the market we\'re building it in?',
      body: "PayChain is currently raising its pre-seed round. We are looking for investors who understand the Kenyan SME market, believe that merchant data is more valuable than collateral, and want to back a team building infrastructure that will matter in East Africa for decades.",
      response: 'We respond within 48 hours',
      email: `mailto:investors@paychain.co.ke`
    },
    {
      id: 'press',
      icon: <ClockIcon />,
      label: 'Press & Media',
      headline: "Writing about Kenyan fintech, M-PESA innovation, or SME financial inclusion?",
      body: "We are happy to speak on the record about the state of merchant payments in Kenya, the role of blockchain in East African commerce, and what PayChain is building to address it. Press kit and assets available on request.",
      response: 'We respond within 24 hours',
      email: `mailto:press@paychain.co.ke`
    }
  ], []);

  return (
    <main className="contact-page">
      <header className="hero-spot">
        <div className="hero-inner">
          <div className="eyebrow">Get in Touch</div>
          <h1 className="hero-title">
            <span className="line">We're a Real Team.</span>
            <span className="line">Based in Nairobi.</span>
            <span className="line">And We Actually Reply.</span>
          </h1>
          <p className="hero-sub">Whether you're a merchant with a question, an investor who sees what we see, a partner who wants to build with us, or a journalist covering Kenya's fintech story — reach out. Every message goes directly to the PayChain team. No bots. No ticket queues. No automated holding responses.</p>
        </div>
      </header>

      <section className="details-strip" aria-hidden>
        <div className="details-inner">
          <a className="detail-block" href={`mailto:${CONTACT_EMAIL}`}>
            <span className="icon-circle"><MailIcon /></span>
            <span className="text"><span className="label">Email</span><span className="value">{CONTACT_EMAIL}</span></span>
          </a>
          <div className="divider" />
          <a className="detail-block" href={`tel:+254790889066`}>
            <span className="icon-circle"><PhoneIcon /></span>
            <span className="text"><span className="label">Phone</span><span className="value">{CONTACT_PHONE}</span></span>
          </a>
          <div className="divider" />
          <div className="detail-block">
            <span className="icon-circle"><MapPinIcon /></span>
            <span className="text"><span className="label">Office</span><span className="value">Nairobi, Kenya 🇰🇪</span></span>
          </div>
          <div className="divider" />
          <div className="detail-block">
            <span className="icon-circle"><ClockIcon /></span>
            <span className="text"><span className="label">Hours</span><span className="value">Mon — Fri: 9:00 — 17:00 EAT</span></span>
          </div>
        </div>
      </section>

      <section className="cards-section">
        <div className="cards-inner">
          <div className="cards-epigraph">
            <div className="epigraph">How can we help?</div>
            <h2 className="cards-head">Reach the Right Person Directly.</h2>
          </div>

          <div className="cards-grid">
            {contactCards.map(c => (
              <article key={c.id} className="contact-card" tabIndex={0}>
                <div className="card-top">
                  <div className="icon-circle-lg">{c.icon}</div>
                  <div className="label-pill">{c.label}</div>
                </div>
                <h3 className="card-title">{c.headline}</h3>
                <p className="card-body">{c.body}</p>
                <div className="card-response"><span className="clock">⏱</span><span>{c.response}</span></div>
                <a className="card-cta" href={c.email}>{c.email.replace('mailto:', '')} <span className="arrow">→</span></a>
                {c.phone && <a className="card-cta phone" href={c.phone}>{c.phone.replace('tel:', '')}</a>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-inner">
          <div className="form-left">
            <h2>Send Us a Message</h2>
            <p className="lead">Fill in the form below and we will get back to you directly. No automated responses — a real member of the PayChain team will reply.</p>

            <ul className="reassurances">
              <li>Real person replies — not a bot</li>
              <li>Within 24–48 hours on business days</li>
              <li>Your information is never shared</li>
            </ul>

            <div className="contact-block">
              <div className="small-label">Or reach us directly</div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="contact-link">{CONTACT_EMAIL}</a>
              <a href={`tel:+254790889066`} className="contact-link">{CONTACT_PHONE}</a>
            </div>
          </div>

          <div className="form-right">
            {!successEmail ? (
              <form onSubmit={handleSubmit} noValidate aria-live="polite">
                <div className="field">
                  <label htmlFor="name">Full Name <span className="req">*</span></label>
                  <input id="name" name="name" value={form.name} onChange={handleChange} aria-required="true" aria-describedby={errors.name ? 'err-name' : undefined} />
                  {errors.name && <div id="err-name" className="field-error">{errors.name}</div>}
                </div>

                <div className="two-col">
                  <div className="field">
                    <label htmlFor="email">Email Address <span className="req">*</span></label>
                    <input id="email" name="email" type="email" value={form.email} onChange={handleChange} aria-required="true" aria-describedby={errors.email ? 'err-email' : undefined} />
                    {errors.email && <div id="err-email" className="field-error">{errors.email}</div>}
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone (optional)</label>
                    <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="contactType">I am a... <span className="req">*</span></label>
                  <select id="contactType" name="contactType" value={form.contactType} onChange={handleChange} aria-required="true" aria-describedby={errors.contactType ? 'err-type' : undefined}>
                    <option value="">Select the option that best describes you</option>
                    {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {errors.contactType && <div id="err-type" className="field-error">{errors.contactType}</div>}
                </div>

                <div className="field">
                  <label htmlFor="subject">Subject <span className="req">*</span></label>
                  <input id="subject" name="subject" value={form.subject} onChange={handleChange} aria-required="true" aria-describedby={errors.subject ? 'err-subject' : undefined} />
                  {errors.subject && <div id="err-subject" className="field-error">{errors.subject}</div>}
                </div>

                <div className="field">
                  <label htmlFor="message">Message <span className="req">*</span></label>
                  <textarea id="message" name="message" ref={messageRef} rows={6} maxLength={2000} value={form.message} onChange={handleChange} aria-required="true" aria-describedby={errors.message ? 'err-message' : undefined} />
                  <div className={`char-counter ${charCount > 1800 ? (charCount > 1999 ? 'red' : 'amber') : ''}`}>{charCount} / 2000</div>
                  {errors.message && <div id="err-message" className="field-error">{errors.message}</div>}
                </div>

                <div className="field">
                  <label htmlFor="referralSource">How did you hear about PayChain? <span className="optional">(optional)</span></label>
                  <select id="referralSource" name="referralSource" value={form.referralSource} onChange={handleChange}>
                    <option value="">Select one (optional)</option>
                    <option value="google">Google Search</option>
                    <option value="social">Social Media</option>
                    <option value="whatsapp">WhatsApp or Word of Mouth</option>
                    <option value="youtube">YouTube</option>
                    <option value="press">News or Press Coverage</option>
                    <option value="referral">Referred by someone</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="field">
                  <button className="submit" type="submit" disabled={sending} aria-disabled={sending}>
                    {sending ? <span className="loader" aria-hidden /> : null}
                    {sending ? 'Sending...' : 'Send Message →'}
                  </button>
                  <p className="privacy">By submitting this form you agree to our privacy policy. We never share your information.</p>
                </div>
              </form>
            ) : (
              <div className="success-card" role="status" aria-live="assertive">
                <svg className="check" width="96" height="96" viewBox="0 0 96 96" aria-hidden>
                  <circle cx="48" cy="48" r="44" className="check-circle" />
                  <path d="M30 50 L44 64 L66 40" className="check-mark" />
                </svg>
                <h3>Message received.</h3>
                <p>Thank you for reaching out. A member of the PayChain team will reply to <strong>{successEmail}</strong> within 24–48 hours.</p>
                <div className="success-ctas">
                  <a className="btn" href="/how-it-works">How PayChain Works →</a>
                  <a className="btn ghost" href="/waitlist">Join the Waitlist →</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="location-section">
        <div className="location-inner">
          <div className="loc-card">
            <div className="wordmark">PayChain</div>
            <div className="loc-head">Nairobi, Kenya 🇰🇪</div>
            <hr />
            <div className="hours-block">
              <div className="label">Working Hours</div>
              <div className="hours-row"><span>Mon — Fri</span><span>9:00 AM — 5:00 PM EAT</span></div>
            </div>
            <div className="muted">We respond to emails outside these hours — just not instantly.</div>
          </div>
          <div className="loc-map" aria-hidden>
            {/* Decorative abstract Kenya map / placeholder */}
            <div className="map-placeholder">Map — Nairobi, Kenya</div>
          </div>
        </div>
      </section>

      <section className="careers-strip">
        <div className="careers-inner">
          <div>
            <p className="eyebrow accent">Join the Team</p>
            <h3>Want to Build PayChain With Us?</h3>
            <p className="muted">We are a small, focused team building financial infrastructure that will matter in Kenya for a long time. If you are a talented engineer, business developer, compliance specialist, or community builder who believes Kenyan merchants deserve better — we want to hear from you.</p>
            <p className="support">We review every application personally.</p>
          </div>
          <div className="careers-card">
            <div className="mail-icon">✉️</div>
            <a href={`mailto:careers@paychain.co.ke`} className="careers-email">careers@paychain.co.ke</a>
            <div className="hint">Subject: Careers — [Your Role / Skill]</div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-inner">
          <h3>Not Sure Where to Start? Just Join the Waitlist.</h3>
          <p className="muted">If you're a Kenyan merchant and you're not sure which contact option is right for you — the waitlist is the best first step. Join in 60 seconds and our team will reach out to you directly before the Q2 2026 beta launch.</p>
          <a className="btn large" href="/waitlist">Join the Beta Waitlist →</a>
          <p className="small-muted">No credit card · No commitment · Limited beta spots available</p>
        </div>
      </section>
    </main>
  );
}






























































































































































































































































































































































}  );    </div>      </section>        </div>          <p className="small muted">No credit card · No commitment · Limited beta spots available</p>          <a className="btn big" href="/waitlist">Join the Beta Waitlist →</a>          <p className="muted">If you're a Kenyan merchant and you're not sure which contact option is right for you — the waitlist is the best first step. Join in 60 seconds and our team will reach out to you directly before the Q2 2026 beta launch.</p>          <h3>Not Sure Where to Start? Just Join the Waitlist.</h3>        <div className="container cta-center">      <section className="final-cta">      </section>        </div>          </div>            <div className="hint">Subject: Careers — [Your Role / Skill]</div>            <a href={`mailto:${CONTACT_EMAIL}?subject=Careers%20—%20%5BRole%20%2F%20Skill%5D`}>{CONTACT_EMAIL}</a>            <div className="mail-icon">✉️</div>          <div className="careers-card">          </div>            <p className="muted small italic">We review every application personally.</p>            <p className="muted">We are a small, focused team building financial infrastructure that will matter in Kenya for a long time. If you are a talented engineer, business developer, compliance specialist, or community builder who believes Kenyan merchants deserve better — we want to hear from you.</p>            <h3>Want to Build PayChain With Us?</h3>            <div className="eyebrow accent">Join the Team</div>          <div>        <div className="container careers-grid">      <section className="careers">      </section>        </div>          </div>            <div className="map-note">Kenya map SVG: simplify path for performance; keep <5KB path data.</div>            </svg>              </g>                <text x="0" y="32" fill="#0B4D2E" fontSize="12" textAnchor="middle">Nairobi</text>                <circle cx="0" cy="0" r="14" fill="#0BFF81" />              <g transform="translate(220,150)">              <path d="M50 30 L350 30 L300 260 L80 260 Z" fill="#0B4D2E" opacity="0.08" stroke="#0B4D2E" strokeOpacity="0.3" strokeWidth="1.5" />              <rect width="100%" height="100%" fill="#fff" />            <svg width="100%" height="100%" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">            {/* Kenya SVG stub - replace with optimized path (see comments) */}          <div className="map" role="img" aria-label="Map showing PayChain's location in Nairobi, Kenya">          </div>            </div>              <a href="https://www.instagram.com/PayChainKE" target="_blank" rel="noopener">Instagram ↗</a>              <a href="https://www.linkedin.com/company/paychain" target="_blank" rel="noopener">LinkedIn ↗</a>              <a href="https://twitter.com/PayChainKE" target="_blank" rel="noopener">X @PayChainKE ↗</a>            <div className="socials">            <div className="small-label">Find Us Online</div>            <hr />            <p className="muted italic">We respond to emails outside these hours — just not instantly.</p>            </div>              <div>Sunday</div><div className="muted">Closed</div>              <div>Saturday</div><div className="muted">Closed</div>              <div>Mon — Fri</div><div className="muted">9:00 AM — 5:00 PM EAT</div>            <div className="hours-grid">            <div className="small-label">Working Hours</div>            <hr />            <div className="row"><span className="icon">📞</span><a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`}>{CONTACT_PHONE}</a></div>            <div className="row"><span className="icon">✉️</span><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>            <div className="small-label">Contact</div>            <hr />            <h3>Nairobi, Kenya 🇰🇪</h3>            <div className="wordmark">PayChain</div>          <div className="loc-card">        <div className="container two-col">      <section className="location">      </section>        </div>          </div>            </form>              <p className="privacy">By submitting this form you agree to our privacy policy. We never share your information.</p>              </button>                {sending ? 'Sending…' : 'Send Message →'}              <button className="submit" type="submit" disabled={sending} aria-disabled={sending}>              </label>                </select>                  <option value="other">Other</option>                  <option value="referral">Referred by someone</option>                  <option value="press">News or Press Coverage</option>                  <option value="youtube">YouTube</option>                  <option value="whatsapp">WhatsApp or Word of Mouth</option>                  <option value="social">Social Media</option>                  <option value="google">Google Search</option>                  <option value="">Select one (optional)</option>                <select name="referralSource" value={form.referralSource} onChange={handleChange}>              <label className="label">How did you hear about PayChain? <span className="optional">(optional)</span>              </label>                <div className="row between"><div>{errors.message && <div id="err-message" className="field-error">⚠️ {errors.message}</div>}</div><div className={`char-count ${charCount > 1800 ? (charCount > 1999 ? 'red' : 'amber') : ''}`}>{charCount} / 2000</div></div>                <textarea name="message" rows={6} maxLength={2000} ref={messageRef} value={form.message} onChange={handleChange} aria-required="true" aria-describedby={errors.message ? 'err-message' : undefined} placeholder={`Tell us what's on your mind. The more detail you give us, the better we can help.`} />              <label className="label">Message <span className="required">*</span>              </label>                {errors.subject && <div id="err-subject" className="field-error">⚠️ {errors.subject}</div>}                <input name="subject" value={form.subject} onChange={handleChange} aria-required="true" aria-describedby={errors.subject ? 'err-subject' : undefined} />              <label className="label">Subject <span className="required">*</span>              </label>                {errors.contactType && <div id="err-type" className="field-error">⚠️ {errors.contactType}</div>}                </select>                  {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}                  <option value="">Select the option that best describes you</option>                <select name="contactType" value={form.contactType} onChange={handleChange} aria-required="true" aria-describedby={errors.contactType ? 'err-type' : undefined}>              <label className="label">I am a... <span className="required">*</span>              </div>                </label>                  <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="07XX XXX XXX" />                <label className="label">Phone Number <span className="optional">(optional)</span>                </label>                  {errors.email && <div id="err-email" className="field-error">⚠️ {errors.email}</div>}                  <input name="email" type="email" value={form.email} onChange={handleChange} aria-required="true" aria-describedby={errors.email ? 'err-email' : undefined} />                <label className="label">Email Address <span className="required">*</span>              <div className="two-cols">              </label>                {errors.name && <div id="err-name" className="field-error">⚠️ {errors.name}</div>}                <input name="name" value={form.name} onChange={handleChange} aria-required="true" aria-describedby={errors.name ? 'err-name' : undefined} />              <label className="label">Full Name <span className="required">*</span>              {networkError && <div className="network-error" role="alert">⚠️ {networkError} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or <a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`}>{CONTACT_PHONE}</a></div>}            <form onSubmit={handleSubmit} noValidate aria-live="polite">          <div className="form-right">          </div>            </div>              <div className="hours">⏱ Mon — Fri, 9:00 — 17:00 EAT</div>              <div className="row"><span className="icon">📞</span><a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`}>{CONTACT_PHONE}</a></div>              <div className="row"><span className="icon">✉️</span><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>              <div className="small-label">Or reach us directly</div>            <div className="direct-contact">            </ul>              <li>✅ Your information is never shared</li>              <li>✅ Within 24 hours on business days</li>              <li>✅ Real person replies — not a bot</li>            <ul className="reassurance">            <p className="muted">Fill in the form below and we will get back to you directly. No automated responses — a real member of the PayChain team will reply.</p>            <h2>Send Us a Message</h2>          <div className="form-left">        <div className="container form-grid">      <section className="form-section">      </section>        </div>          </article>            </div>              <div className="hint">Subject: Press — [Publication Name]</div>              <a href={`mailto:${CONTACT_EMAIL}`} className="cta">Email {CONTACT_EMAIL} →</a>            <div className="card-links">            <div className="response">⏱ We respond within 24 hours.</div>            <p>We are happy to speak on the record about the state of merchant payments in Kenya, the role of blockchain in East African commerce, and what PayChain is building to address it. Press kit and assets available on request.</p>            <h3>Writing about Kenyan fintech, M-PESA innovation, or SME financial inclusion?</h3>            <div className="card-top"><div className="card-icon">📰</div><div className="card-label">Press & Media</div></div>          <article className="card">          </article>            </div>              <div className="hint">Subject: Investment — [Your Name / Fund]</div>              <a href={`mailto:${CONTACT_EMAIL}`} className="cta">Email {CONTACT_EMAIL} →</a>            <div className="card-links">            <div className="response">⏱ We respond within 48 hours.</div>            <p>PayChain is currently raising its pre-seed round. We are looking for investors who understand the Kenyan SME market, believe that merchant data is more valuable than collateral, and want to back a team building infrastructure that will matter in East Africa for decades.</p>            <h3>Interested in what we're building and the market we're building it in?</h3>            <div className="card-top"><div className="card-icon">📈</div><div className="card-label">Investor Relations</div></div>          <article className="card">          </article>            </div>              <div className="hint">Subject: Partnership — [Your Organization]</div>              <a href={`mailto:${CONTACT_EMAIL}`} className="cta">Email {CONTACT_EMAIL} →</a>            <div className="card-links">            <div className="response">⏱ We respond within 48 hours.</div>            <p>We are actively pursuing partnerships with Kenyan trade associations, SACCOs, financial institutions, accounting software providers, and any organization whose members would benefit from PayChain's infrastructure. If you work with Kenyan SMEs — let's talk.</p>            <h3>Looking to partner, integrate, or build with PayChain?</h3>            <div className="card-top"><div className="card-icon">🔗</div><div className="card-label">Partnerships</div></div>          <article className="card">          </article>            </div>              <a href="/waitlist" className="hint">Or join the waitlist →</a>              <a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`} className="cta secondary">Call {CONTACT_PHONE}</a>              <a href={`mailto:${CONTACT_EMAIL}`} className="cta">Email {CONTACT_EMAIL} →</a>            <div className="card-links">            <div className="response">⏱ We respond within 24 hours on business days.</div>            <p>Our support team is Nairobi-based and responds to every message personally. Whether you want to understand how Cash Advance eligibility works, need help with your waitlist application, or just want to know if PayChain is right for your business — ask us directly.</p>            <h3>Questions about your account, the waitlist, or how PayChain works?</h3>            <div className="card-top"><div className="card-icon">💬</div><div className="card-label">Merchant Support</div></div>          <article className="card">        <div className="container cards-grid">      <section className="cards">      </section>        </div>          </div>            </div>              <div className="value">Mon — Fri: 9:00 — 17:00 EAT</div>              <div className="label">Hours</div>            <div>            <div className="icon">⏰</div>          <div className="detail">          </div>            </div>              <div className="value">Nairobi, Kenya 🇰🇪</div>              <div className="label">Office</div>            <div>            <div className="icon">📍</div>          <div className="detail">          </div>            </div>              <div className="value"><a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`}>{CONTACT_PHONE}</a></div>              <div className="label">Phone</div>            <div>            <div className="icon">📞</div>          <div className="detail">          </div>            </div>              <div className="value"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>              <div className="label">Email</div>            <div>            <div className="icon">✉️</div>          <div className="detail">        <div className="container grid-4">      <section className="details-strip" aria-label="Contact details">      </section>        </div>          <p className="subhead">Whether you're a merchant with a question, an investor who sees what we see, a partner who wants to build with us, or a journalist covering Kenya's fintech story — reach out. Every message goes directly to the PayChain team. No bots. No ticket queues. No automated holding responses.</p>          </h1>            <span>And We Actually Reply.</span>            <span>Based in Nairobi.</span>            <span>We're a Real Team.</span>          <h1 className="headline">          <div className="eyebrow">Get in Touch</div>        <div className="container">      <section className="hero">    <div className="contact-page">  return (  }    );      </div>        </div>          <a className="btn" href="/waitlist">Join the Waitlist →</a>          <a className="btn btn-ghost" href="/how-it-works">How PayChain Works →</a>        <div className="success-ctas">        <p className="muted">Or reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or <a href={`tel:${CONTACT_PHONE.replace(/\s+/g,'')}`}>{CONTACT_PHONE}</a></p>        <p>Thank you for reaching out. A member of the PayChain team will reply to <strong>{success.email}</strong> within 24 hours on business days.</p>        <h2>Message received.</h2>        </svg>          <path d="M30 50 L44 64 L66 40" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />          <circle cx="48" cy="48" r="44" stroke="#22C55E" strokeWidth="4" fill="none" />        <svg className="success-svg" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">      <div className="contact-success" aria-live="assertive">    return (  if (success) {  }    }      setSending(false);    } finally {      }        setNetworkError('Something went wrong. Please try again or contact us directly.');      } else {        setErrors(serverErrs);        });          if (e.param) serverErrs[e.param] = e.msg;        err.response.data.errors.forEach(e => {        const serverErrs = {};        // map server validation errors      if (err.response && err.response.data && err.response.data.errors) {      console.error(err);    } catch (err) {      setErrors({});      setCharCount(0);      setForm({ name: '', email: '', phone: '', contactType: '', subject: '', message: '', referralSource: '' });      setSuccess({ email: form.email });      const res = await axios.post(`${base}/api/contact`, form);      const base = import.meta.env.VITE_API_URL || '';    try {    setSending(true);    }      return;      setErrors(v);    if (Object.keys(v).length) {    const v = validate();    setNetworkError('');    e.preventDefault();  async function handleSubmit(e) {  }    return errs;    if (!form.message || form.message.trim().length < 10) errs.message = 'Please enter your message (minimum 10 characters)';    if (!form.subject || form.subject.trim().length < 3) errs.subject = 'Please enter a subject line';    if (!form.contactType) errs.contactType = 'Please select an option';    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Please enter a valid email address';    if (!form.name || form.name.trim().length < 2) errs.name = 'Please enter your full name';    const errs = {};  function validate() {  }    setErrors(prev => ({ ...prev, [name]: null }));    setForm(prev => ({ ...prev, [name]: value }));    const { name, value } = e.target;  function handleChange(e) {  }, [form.message]);    setCharCount(form.message.length);  useEffect(() => {  const messageRef = useRef(null);  const [charCount, setCharCount] = useState(0);  const [networkError, setNetworkError] = useState('');  const [success, setSuccess] = useState(null);  const [sending, setSending] = useState(false);  const [errors, setErrors] = useState({});  });    referralSource: '',    message: '',    subject: '',    contactType: '',    phone: '',    email: '',    name: '',  const [form, setForm] = useState({export default function Contact() {];  { value: 'other', label: 'Other' },  { value: 'careers', label: 'Job Applicant' },  { value: 'developer', label: 'Developer or Technical Partner' },  { value: 'press', label: 'Journalist or Media' },  { value: 'partnership', label: 'Partnership or Business Development' },  { value: 'investor', label: 'Investor' },  { value: 'merchant', label: 'Merchant or Business Owner' },const CONTACT_TYPES = [const CONTACT_PHONE = '+254 790 889 066';const CONTACT_EMAIL = 'hello@paychainke.co';import './contact.css';import axios from 'axios';import axios from 'axios';
import './contact.css';

const CONTACT_EMAIL = 'hello@paychainke.co';
const CONTACT_PHONE = '+254 790 889 066';

const CONTACT_TYPES = [
  { value: 'merchant', label: 'Merchant or Business Owner' },
  { value: 'investor', label: 'Investor' },
  { value: 'partnership', label: 'Partnership or Business Development' },
  { value: 'press', label: 'Journalist or Media' },
  { value: 'developer', label: 'Developer or Technical Partner' },
  { value: 'careers', label: 'Job Applicant' },
  { value: 'other', label: 'Other' }
];

export default function Contact() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', contactType: '', subject: '', message: '', referralSource: ''
  });
  const [errors, setErrors] = useState<any>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [networkError, setNetworkError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setCharCount(form.message.length), [form.message]);

  useEffect(() => {
    if (success && messageRef.current) messageRef.current.blur();
  }, [success]);

  function validateClient() {
    const e: any = {};
    if (!form.name || form.name.trim().length < 2) e.name = 'Please enter your full name';
    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Please enter a valid email address';
    if (!form.contactType) e.contactType = 'Please select an option';
    if (!form.subject || form.subject.trim().length < 3) e.subject = 'Please enter a subject line';
    if (!form.message || form.message.trim().length < 10) e.message = 'Please enter your message (minimum 10 characters)';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNetworkError('');
    const clientErr = validateClient();
    setErrors(clientErr);
    if (Object.keys(clientErr).length) return;

    setSending(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      await axios.post(`${apiBase}/api/contact`, form);
      setSuccess(true);
      setForm({ name: '', email: '', phone: '', contactType: '', subject: '', message: '', referralSource: '' });
      setErrors({});
    } catch (err: any) {
      if (err?.response?.data?.errors) {
        const mapped: any = {};
        (err.response.data.errors || []).forEach((it: any) => mapped[it.param] = it.msg);
        setErrors(mapped);
      } else {
        setNetworkError('Something went wrong. Please try again or contact us directly:');
      }
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return (
      <main className="contact-page">
        <section className="contact-hero" aria-hidden="false">
          <div className="container">
            <p className="eyebrow">Get in Touch</p>
            <h1 className="hero-title">We're a Real Team. Based in Nairobi.\nAnd We Actually Reply.</h1>
            <p className="hero-sub">Whether you're a merchant with a question, an investor who sees what we see, a partner who wants to build with us, or a journalist covering Kenya's fintech story — reach out. Every message goes directly to the PayChain team. No bots. No ticket queues. No automated holding responses.</p>
          </div>
        </section>

        <section className="success-card" aria-live="assertive">
          <svg className="check-svg" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="54" stroke="#22C55E" strokeWidth="4" fill="none" strokeDasharray="339" strokeDashoffset="339">
            </circle>
            <path d="M36 62 L52 78 L84 44" stroke="#fff" strokeWidth="6" fill="none" strokeDasharray="100" strokeDashoffset="100"></path>
          </svg>
          <h2>Message received.</h2>
          <p>Thank you for reaching out. A member of the PayChain team will reply to <span className="emph">{form.email || 'your email'}</span> within 24 hours on business days.</p>
          <p className="muted">Or reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or <a href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>{CONTACT_PHONE}</a></p>
          <div className="success-ctas">
            <a className="btn btn-outline" href="/how-it-works">How PayChain Works →</a>
            <a className="btn" href="/waitlist">Join the Waitlist →</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="container">
          <p className="eyebrow">Get in Touch</p>
          <h1 className="hero-title">
            <span>We're a Real Team.</span>
            <span>Based in Nairobi.</span>
            <span>And We Actually Reply.</span>
          </h1>
          <p className="hero-sub">Whether you're a merchant with a question, an investor who sees what we see, a partner who wants to build with us, or a journalist covering Kenya's fintech story — reach out. Every message goes directly to the PayChain team. No bots. No ticket queues. No automated holding responses.</p>
        </div>
      </section>

      <section className="details-strip" aria-hidden="false">
        <div className="container details-grid">
          <div className="detail">
            <div className="icon">✉️</div>
            <div className="text">
              <div className="label">Email</div>
              <div className="value"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>
            </div>
          </div>
          <div className="detail">
            <div className="icon">📞</div>
            <div className="text">
              <div className="label">Phone</div>
              <div className="value"><a href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>{CONTACT_PHONE}</a></div>
            </div>
          </div>
          <div className="detail">
            <div className="icon">📍</div>
            <div className="text">
              <div className="label">Office</div>
              <div className="value">Nairobi, Kenya 🇰🇪</div>
            </div>
          </div>
          <div className="detail">
            <div className="icon">⏰</div>
            <div className="text">
              <div className="label">Hours</div>
              <div className="value">Mon — Fri: 9:00 — 17:00 EAT</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cards-section">
        <div className="container cards-grid">
          <article className="card">
            <div className="card-top"><div className="card-icon">💬</div><div className="card-label">Merchant Support</div></div>
            <h3>Questions about your account, the waitlist, or how PayChain works?</h3>
            <p>Our support team is Nairobi-based and responds to every message personally. Whether you want to understand how Cash Advance eligibility works, need help with your waitlist application, or just want to know if PayChain is right for your business — ask us directly.</p>
            <div className="response">We respond within 24 hours on business days.</div>
            <a className="primary-link" href={`mailto:${CONTACT_EMAIL}`}>Email {CONTACT_EMAIL} →</a>
            <a className="secondary-link" href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>Call {CONTACT_PHONE}</a>
            <a className="tertiary" href="/waitlist">Or join the waitlist →</a>
          </article>

          <article className="card">
            <div className="card-top"><div className="card-icon">🔗</div><div className="card-label">Partnerships</div></div>
            <h3>Looking to partner, integrate, or build with PayChain?</h3>
            <p>We are actively pursuing partnerships with Kenyan trade associations, SACCOs, financial institutions, accounting software providers, and any organization whose members would benefit from PayChain's infrastructure.</p>
            <div className="response">We respond within 48 hours.</div>
            <a className="primary-link" href={`mailto:${CONTACT_EMAIL}`}>Email {CONTACT_EMAIL} →</a>
            <div className="hint">Subject: Partnership — [Your Organization]</div>
          </article>

          <article className="card">
            <div className="card-top"><div className="card-icon">📈</div><div className="card-label">Investor Relations</div></div>
            <h3>Interested in what we're building and the market we're building it in?</h3>
            <p>PayChain is currently raising its pre-seed round. We are looking for investors who understand the Kenyan SME market.</p>
            <div className="response">We respond within 48 hours.</div>
            <a className="primary-link" href={`mailto:${CONTACT_EMAIL}`}>Email {CONTACT_EMAIL} →</a>
            <div className="hint">Subject: Investment — [Your Name / Fund]</div>
          </article>

          <article className="card">
            <div className="card-top"><div className="card-icon">📰</div><div className="card-label">Press & Media</div></div>
            <h3>Writing about Kenyan fintech, M-PESA innovation, or SME financial inclusion?</h3>
            <p>We are happy to speak on the record about the state of merchant payments in Kenya and what PayChain is building to address it. Press kit and assets available on request.</p>
            <div className="response">We respond within 24 hours.</div>
            <a className="primary-link" href={`mailto:${CONTACT_EMAIL}`}>Email {CONTACT_EMAIL} →</a>
            <div className="hint">Subject: Press — [Publication Name]</div>
          </article>
        </div>
      </section>

      <section className="form-section">
        <div className="container form-grid">
          <div className="left">
            <h2>Send Us a Message</h2>
            <p className="lead">Fill in the form below and we will get back to you directly. No automated responses — a real member of the PayChain team will reply.</p>
            <ul className="reassure">
              <li>Real person replies — not a bot</li>
              <li>Within 24 hours on business days</li>
              <li>Your information is never shared</li>
            </ul>

            <div className="direct-block">
              <div className="label">Or reach us directly</div>
              <div className="contact-row"><span className="accent">✉️</span><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>
              <div className="contact-row"><span className="accent">📞</span><a href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>{CONTACT_PHONE}</a></div>
              <div className="hours"><span className="accent">⏰</span>Mon — Fri, 9:00 — 17:00 EAT</div>
            </div>
          </div>

          <div className="right">
            <form className="form-card" onSubmit={handleSubmit} noValidate aria-live="polite">
              {networkError && (
                <div className="network-error" role="alert">
                  <strong>Something went wrong. Please try again or contact us directly:</strong>
                  <div><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> • <a href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>{CONTACT_PHONE}</a></div>
                </div>
              )}

              <label htmlFor="name">Full Name <span className="req">*</span></label>
              <input id="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} aria-required="true" />
              {errors.name && <div className="field-error" role="alert">{errors.name}</div>}

              <div className="two-col">
                <div>
                  <label htmlFor="email">Email Address <span className="req">*</span></label>
                  <input id="email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} aria-required="true" />
                  {errors.email && <div className="field-error" role="alert">{errors.email}</div>}
                </div>
                <div>
                  <label htmlFor="phone">Phone (optional)</label>
                  <input id="phone" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
                </div>
              </div>

              <label htmlFor="contactType">I am a... <span className="req">*</span></label>
              <select id="contactType" value={form.contactType} onChange={e=>setForm({...form,contactType:e.target.value})} aria-required="true">
                <option value="">Select the option that best describes you</option>
                {CONTACT_TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option> )}
              </select>
              {errors.contactType && <div className="field-error" role="alert">{errors.contactType}</div>}

              <label htmlFor="subject">Subject <span className="req">*</span></label>
              <input id="subject" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} aria-required="true" />
              {errors.subject && <div className="field-error" role="alert">{errors.subject}</div>}

              <label htmlFor="message">Message <span className="req">*</span></label>
              <textarea id="message" ref={messageRef} rows={6} maxLength={2000} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} aria-required="true" />
              <div className="char-counter">{charCount} / 2000</div>
              {errors.message && <div className="field-error" role="alert">{errors.message}</div>}

              <label htmlFor="referralSource">How did you hear about PayChain? (optional)</label>
              <select id="referralSource" value={form.referralSource} onChange={e=>setForm({...form,referralSource:e.target.value})}>
                <option value="">Select one (optional)</option>
                <option value="google">Google Search</option>
                <option value="social">Social Media</option>
                <option value="whatsapp">WhatsApp or Word of Mouth</option>
                <option value="youtube">YouTube</option>
                <option value="press">News or Press Coverage</option>
                <option value="referral">Referred by someone</option>
                <option value="other">Other</option>
              </select>

              <button className="submit" type="submit" disabled={sending} aria-disabled={sending}>
                {sending ? 'Sending...' : 'Send Message →'}
              </button>

              <p className="privacy">By submitting this form you agree to our privacy policy. We never share your information.</p>
            </form>
          </div>
        </div>
      </section>

      <section className="location-section">
        <div className="container location-grid">
          <div className="loc-card">
            <div className="wordmark">PayChain</div>
            <div className="loc-head">Nairobi, Kenya 🇰🇪</div>
            <hr />
            <div className="loc-contact">
              <div className="label">Contact</div>
              <div><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div>
              <div><a href={`tel:${CONTACT_PHONE.replace(/\s/g,'')}`}>{CONTACT_PHONE}</a></div>
            </div>
            <hr />
            <div className="hours-block">
              <div className="label">Working Hours</div>
              <div className="hours-row"><span>Mon — Fri</span><span>9:00 AM — 5:00 PM EAT</span></div>
              <div className="hours-row"><span>Saturday</span><span>Closed</span></div>
              <div className="hours-row"><span>Sunday</span><span>Closed</span></div>
            </div>
            <div className="muted">We respond to emails outside these hours — just not instantly.</div>
          </div>

          <div className="loc-map" role="img" aria-label="Map showing PayChain's location in Nairobi, Kenya">
            {/* Kenya SVG note: simplified path for performance; replace with optimized SVG under 5KB if possible */}
            <svg width="100%" height="320" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="transparent" />
              <path d="M150 50 C200 30 300 40 360 90 C420 140 480 120 520 160 C560 200 610 210 650 250 C690 290 700 360 680 420 C660 480 600 520 540 540 C480 560 380 560 300 520 C220 480 160 380 150 300 C140 220 130 140 150 50 Z" fill="var(--brand-primary)" opacity="0.12" stroke="var(--brand-primary)" strokeOpacity="0.3" strokeWidth="1.5" />
              <g className="pin" transform="translate(440,260)">
                <circle cx="0" cy="0" r="14" fill="var(--brand-accent)" />
                <text x="0" y="34" fontSize="12" textAnchor="middle" fill="var(--brand-primary)">Nairobi</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      <section className="careers-strip">
        <div className="container careers-grid">
          <div>
            <p className="eyebrow">Join the Team</p>
            <h3>Want to Build PayChain With Us?</h3>
            <p className="muted">We are a small, focused team building financial infrastructure that will matter in Kenya for a long time. If you are a talented engineer, business developer, compliance specialist, or community builder who believes Kenyan merchants deserve better — we want to hear from you.</p>
            <p className="support">We review every application personally.</p>
          </div>
          <div className="careers-card">
            <div className="mail-icon">✉️</div>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Careers — [Role / Skill]`} className="careers-email">{CONTACT_EMAIL}</a>
            <div className="hint">Subject: Careers — [Your Role / Skill]</div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="container cta-card">
          <h3>Not Sure Where to Start? Just Join the Waitlist.</h3>
          <p className="muted">If you're a Kenyan merchant and you're not sure which contact option is right for you — the waitlist is the best first step.</p>
          <a className="btn btn-large" href="/waitlist">Join the Beta Waitlist →</a>
          <p className="small-muted">No credit card · No commitment · Limited beta spots available</p>
        </div>
      </section>
    </main>
  );
}
