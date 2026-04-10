/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import styles from "./ContactUs.module.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  Link2,
  TrendingUp,
  Newspaper,
  ArrowRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Check,
} from "lucide-react";

// Contact page — frontend only. No backend calls.
// TODO: Replace simulation with API call
// POST /api/contact
// Body: { name, email, phone, contactType, subject, message, referralSource }

const CONTACT_DETAILS = [
  {
    icon: Mail,
    label: "Email",
    value: "Reach us via the contact form",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+254 790 889 066",
    href: "tel:+254790889066",
  },
  {
    icon: MapPin,
    label: "Office",
    value: "Nairobi, Kenya",
  },
  {
    icon: Clock,
    label: "Hours",
    value: "Mon — Fri: 9:00 — 17:00 EAT",
  },
];

const CARD_DATA = [
  {
    icon: MessageCircle,
    label: "Merchant Support",
    headline:
      "Questions about your account, the waitlist, or how PayChain works?",
    body:
      "Our support team is Nairobi-based and responds to every message personally. Whether you want to understand how Cash Advance eligibility works, need help with your waitlist application, or just want to know if PayChain is right for your business — ask us directly.",
    response: "We respond within 24 hours on business days.",
    // email removed — use the contact form
    phoneHref: "tel:+254790889066",
    secondary: { label: "Or join the waitlist →", href: "/waitlist" },
  },
  {
    icon: Link2,
    label: "Partnerships",
    headline: "Looking to partner, integrate, or build with PayChain?",
    body:
      "We are actively pursuing partnerships with Kenyan trade associations, SACCOs, financial institutions, and any organization whose members would benefit from PayChain's infrastructure. If you work with Kenyan SMEs — let's talk.",
    response: "We respond within 48 hours.",
    hint: "We will follow up via the contact form",
  },
  {
    icon: TrendingUp,
    label: "Investor Relations",
    headline:
      "Interested in what we're building and the market we're building it in?",
    body:
      "PayChain is currently raising its pre-seed round. We are looking for investors who understand the Kenyan SME market, believe that merchant data is more valuable than collateral, and want to back a team building infrastructure that will matter in East Africa for decades.",
    response: "We respond within 48 hours.",
    hint: "We will follow up via the contact form",
  },
  {
    icon: Newspaper,
    label: "Press & Media",
    headline:
      "Writing about Kenyan fintech, M-PESA innovation, or SME financial inclusion?",
    body:
      "We are happy to speak on the record about the state of merchant payments in Kenya, the role of blockchain in East African commerce, and what PayChain is building to address it. Press kit and assets available on request.",
    response: "We respond within 24 hours.",
    hint: "We will follow up via the contact form",
  },
];

export default function ContactUs() {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    contactType: "",
    subject: "",
    message: "",
    referralSource: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [charCount, setCharCount] = useState(0);

  const formRef = useRef<HTMLFormElement | null>(null);
  const firstErrorRef = useRef<HTMLElement | null>(null);

  // Intersection observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll(`.${styles["animate-on-scroll"]}, .${styles["animate-from-left"]}, .${styles["animate-from-right"]}`)
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCharCount(formData.message.length);
  }, [formData.message]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name || formData.name.trim().length < 2) {
      errs.name = "Please enter your full name";
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRe.test(formData.email)) {
      errs.email = "Please enter a valid email address";
    }
    if (!formData.contactType) {
      errs.contactType = "Please select the option that describes you";
    }
    if (!formData.subject || formData.subject.trim().length < 3) {
      errs.subject = "Please enter a subject line";
    }
    if (!formData.message || formData.message.trim().length < 10) {
      errs.message = "Please enter your message (at least 10 characters)";
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // focus + scroll to first error
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(firstKey);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // shake animation
      const card = document.getElementById("form-card");
      if (card) {
        card.classList.remove(styles.shake);
        // reflow
        void card.offsetWidth;
        card.classList.add(styles.shake);
      }
      return;
    }

    // Valid submission — simulate API call
    setErrors({});
    setIsSubmitting(true);
    // store submitted email for success message
    setSubmittedEmail(formData.email);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      // hide form fields visually (handled in render)
    }, 1500);
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", contactType: "", subject: "", message: "", referralSource: "" });
    setErrors({});
    setIsSubmitting(false);
    setIsSuccess(false);
    setCharCount(0);
  };

  // Add OG meta tags (SPA-friendly approach)
  useEffect(() => {
    const metas = [
      { property: "og:title", content: "Contact PayChain — Get in Touch" },
      { property: "og:description", content: "Reach the PayChain team directly. Phone: +254 790 889 066. Based in Nairobi, Kenya." },
      { property: "og:url", content: "https://www.paychain.co.ke/contact" },
      { name: "twitter:card", content: "summary" },
    ];
    metas.forEach((m) => {
      const selector = m.property ? `meta[property="${m.property}"]` : `meta[name="${m.name}"]`;
      if (!document.querySelector(selector)) {
        const meta = document.createElement("meta");
        Object.keys(m).forEach((k) => (meta.setAttribute(k, (m as Record<string, string>)[k])));
        document.head.appendChild(meta);
      }
    });
  }, []);

  return (
    <>
      <Navbar />
      <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow} style={{ animationDelay: "200ms" }}>Get in Touch</div>
          <h1 className={styles.headline}>
            <span className={styles.line} style={{ animationDelay: "0ms" }}>We're a Real Team.</span>
            <span className={styles.line} style={{ animationDelay: "200ms" }}>Based in Nairobi.</span>
            <span className={styles.line} style={{ animationDelay: "400ms" }}>And We Actually Reply.</span>
          </h1>
          <p className={styles.subheadline}>
            Whether you're a merchant with a question, an investor who sees what we see, a partner who wants to build with us, or a journalist covering Kenya's fintech story — reach out. Every message goes directly to the PayChain team. No bots. No ticket queues. No automated holding responses.
          </p>
        </div>
      </section>

      {/* DETAILS STRIP */}
      <section className={styles.detailsStrip}>
        <div className={styles.detailsInner}>
          {CONTACT_DETAILS.map((d) => {
            const Icon = d.icon as any;
            const content = (
              <div className={styles.detailBlock} key={d.label}>
                <div className={styles.iconCircle}><Icon size={18} /></div>
                <div className={styles.detailText}>
                  <div className={styles.detailLabel}>{d.label}</div>
                  <div className={styles.detailValue}>{d.value}</div>
                </div>
              </div>
            );
            return d.href ? (
              <a key={d.label} href={d.href} className={styles.detailLink} aria-label={`${d.label} — opens ${d.href.startsWith('mailto') ? 'email' : 'phone'}`}>
                {content}
              </a>
            ) : (
              <div key={d.label}>{content}</div>
            );
          })}
        </div>
      </section>

      {/* CONTACT CARDS */}
      <section className={`${styles.section} ${styles.cardsSection}`}>
        <div className={styles.inner}> 
          <div className={styles.sectionEyebrow}>How can we help?</div>
          <h2 className={styles.sectionHeadline}>Reach the Right Person Directly.</h2>
          <div className={styles.cardsGrid}>
            {CARD_DATA.map((card, idx) => {
              const Icon = card.icon as any;
              return (
                <article key={idx} className={`${styles.card} ${styles['animate-on-scroll']}`} style={{ transitionDelay: `${idx * 100}ms` }}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardIcon}><Icon size={20} /></div>
                    <div className={styles.cardPill}>{card.label}</div>
                  </div>
                  <div className={styles.cardHeadline}>{card.headline}</div>
                  <div className={styles.cardBody}>{card.body}</div>
                  <div className={styles.cardResponse}><Clock size={12} /> <span>{card.response}</span></div>
                  {(card as any).emailHref && (
                    <a href={(card as any).emailHref} className={styles.cardPrimary}>{(card as any).emailHref.replace('mailto:', '')} <ArrowRight size={14} /></a>
                  )}
                  {card.phoneHref && (
                    <a href={card.phoneHref} className={styles.cardPhone}><Phone size={14} /> +254 790 889 066</a>
                  )}
                  {card.secondary && (
                    <a href={card.secondary.href} className={styles.cardSecondary}>{card.secondary.label}</a>
                  )}
                  {card.hint && <div className={styles.cardHint}>{card.hint}</div>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CONTACT FORM SECTION */}
      <section className={styles.formSection}>
        <div className={styles.innerLarge}>
          <div className={styles.formColumns}>
            <div className={`${styles.formIntro} ${styles['animate-from-left']}`}>
              <h3 className={styles.formTitle}>Send Us a Message</h3>
              <p className={styles.formSubtitle}>Fill in the form below and we will get back to you directly. No automated responses — a real member of the PayChain team will reply.</p>
              <div className={styles.reassurances}>
                <div className={styles.reassure}><Check size={16} color="#1D9E75" /> <span>Real person replies — not a bot</span></div>
                <div className={styles.reassure}><Check size={16} color="#1D9E75" /> <span>Within 24 hours on business days</span></div>
                <div className={styles.reassure}><Check size={16} color="#1D9E75" /> <span>Your information is never shared</span></div>
              </div>
              <hr className={styles.formDivider} />
              <div className={styles.directBlock}>
                <div className={styles.smallLabel}>Or reach us directly</div>
                <div className={styles.contactRows}>
                  <div className={styles.contactRow}><Mail size={16} color="#1D9E75" /><div className={styles.directLink}>Use the contact form</div></div>
                  <div className={styles.contactRow}><Phone size={16} color="#1D9E75" /><a href="tel:+254790889066" className={styles.directLink}>+254 790 889 066</a></div>
                </div>
                <div className={styles.hoursRow}><Clock size={14} className={styles.mutedIcon} /><span className={styles.hoursText}>Mon — Fri, 9:00 — 17:00 EAT</span></div>
              </div>
            </div>

            <div className={`${styles.formCardWrap} ${styles['animate-from-right']}`}>
              <div id="form-card" className={styles.formCard}>
                {!isSuccess ? (
                  <form ref={formRef} id="contact-form" role="form" aria-label="Contact form" onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor="name">Full Name <span className={styles.req}>*</span></label>
                      <input id="name" name="name" aria-required="true" aria-invalid={errors.name ? "true" : "false"} aria-describedby={errors.name ? "name-error" : undefined} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your full name" />
                      {errors.name && <div id="name-error" role="alert" className={styles.inlineError}><AlertCircle size={12} /> {errors.name}</div>}
                    </div>

                    <div className={styles.row2}>
                      <div className={styles.fieldInline}>
                        <label htmlFor="email">Email Address <span className={styles.req}>*</span></label>
                        <input id="email" name="email" type="email" aria-required="true" aria-invalid={errors.email ? "true" : "false"} aria-describedby={errors.email ? "email-error" : undefined} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" />
                        {errors.email && <div id="email-error" role="alert" className={styles.inlineError}><AlertCircle size={12} /> {errors.email}</div>}
                      </div>
                      <div className={styles.fieldInline}>
                        <label htmlFor="phone">Phone Number <span className={styles.optional}>(optional)</span></label>
                        <input id="phone" name="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="07XX XXX XXX" />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="contactType">I am a... <span className={styles.req}>*</span></label>
                      <div className={styles.customSelectWrap}>
                        <select id="contactType" name="contactType" aria-required="true" aria-invalid={errors.contactType ? "true" : "false"} aria-describedby={errors.contactType ? "contactType-error" : undefined} value={formData.contactType} onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}>
                          <option value="">Select the option that best describes you</option>
                          <option value="merchant">Merchant or Business Owner</option>
                          <option value="investor">Investor</option>
                          <option value="partnership">Partnership or Business Development</option>
                          <option value="press">Journalist or Media</option>
                          <option value="developer">Developer or Technical Partner</option>
                          <option value="careers">Job Applicant</option>
                          <option value="other">Other</option>
                        </select>
                        <ChevronDown size={16} className={styles.chev} />
                      </div>
                      {errors.contactType && <div id="contactType-error" role="alert" className={styles.inlineError}><AlertCircle size={12} /> {errors.contactType}</div>}
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="subject">Subject <span className={styles.req}>*</span></label>
                      <input id="subject" name="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="What's this about?" />
                      {errors.subject && <div id="subject-error" role="alert" className={styles.inlineError}><AlertCircle size={12} /> {errors.subject}</div>}
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="message">Message <span className={styles.req}>*</span></label>
                      <textarea id="message" name="message" rows={6} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder={"Tell us what's on your mind. The more detail you give us, the better we can help."} maxLength={2000} />
                      <div className={styles.charCounter} style={{ color: charCount >= 1990 ? '#EF4444' : charCount >= 1800 ? '#F59E0B' : undefined }}>{charCount} / 2000</div>
                      {errors.message && <div id="message-error" role="alert" className={styles.inlineError}><AlertCircle size={12} /> {errors.message}</div>}
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="referralSource">How did you hear about PayChain? <span className={styles.optional}>(optional)</span></label>
                      <div className={styles.customSelectWrap}>
                        <select id="referralSource" name="referralSource" value={formData.referralSource} onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}>
                          <option value="">Select one (optional)</option>
                          <option value="google">Google Search</option>
                          <option value="social">Social Media (LinkedIn, X, Instagram, TikTok)</option>
                          <option value="whatsapp">WhatsApp or Word of Mouth</option>
                          <option value="youtube">YouTube</option>
                          <option value="press">News or Press Coverage</option>
                          <option value="referral">Referred by someone</option>
                          <option value="other">Other</option>
                        </select>
                        <ChevronDown size={16} className={styles.chev} />
                      </div>
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-disabled={isSubmitting}>
                      {isSubmitting ? (<><span className={styles.spinner} aria-hidden="true"></span> Sending...</>) : (<><span>Send Message</span> <ArrowRight size={14} /></>)}
                    </button>

                    <div className={styles.privacy}>By submitting this form you agree to our privacy policy. We never share your information with third parties.</div>
                  </form>
                ) : (
                  <div className={styles.successCard} role="status" aria-live="assertive">
                    <svg width="64" height="64" viewBox="0 0 52 52" aria-hidden="true">
                      <circle cx="26" cy="26" r="24" stroke="#22C55E" strokeWidth="2" fill="none" strokeDasharray="166" strokeDashoffset="166" className={styles.drawCircle} />
                      <path d="M14 27 l8 8 l16-16" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="48" strokeDashoffset="48" className={styles.drawCheck} />
                    </svg>
                    <div className={styles.successTitle}>Message received.</div>
                    <div className={styles.successBody}>Thank you for reaching out. A member of the PayChain team will reply to <span style={{ fontWeight: 600 }}>{submittedEmail}</span> within 24 hours on business days.</div>
                    <div className={styles.successDirect}>Or reach us directly:</div>
                    <div className={styles.successLink}>Use the contact form</div>
                    <a href="tel:+254790889066" className={styles.successLink}>+254 790 889 066</a>
                    <div className={styles.successCtas}>
                      <a href="/how-it-works" className={styles.successCta}>How PayChain Works →</a>
                      <a href="/waitlist" className={styles.successCta}>Join the Waitlist →</a>
                    </div>
                    <button className={styles.sendAnother} onClick={resetForm}>Send another message</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOCATION, CAREERS, FINAL CTA sections simplified for brevity but presentationally accurate */}
      <section className={`${styles.section} ${styles.locationSection}`}>
        <div className={styles.innerLarge}>
          <h3 className={styles.locHeadline}>Where to Find Us</h3>
          <div className={styles.locGrid}>
            <div className={styles.locCard}>
              <div className={styles.wordmark}>PayChain</div>
              <div className={styles.locTitle}>Nairobi, Kenya</div>
              <hr className={styles.locDivider} />
              <div className={styles.smallLabel}>Contact</div>
              <div className={styles.contactRows}>
                <div className={styles.contactRow}><Mail size={16} color="#1D9E75" /><div className={styles.directLink}>Use the contact form</div></div>
                <div className={styles.contactRow}><Phone size={16} color="#1D9E75" /><a href="tel:+254790889066" className={styles.directLink}>+254 790 889 066</a></div>
              </div>
              <hr className={styles.locDivider} />
              <div className={styles.smallLabel}>Working Hours</div>
              <div className={styles.hoursGrid}>
                <div className={styles.hoursRowLabel}>Mon — Fri</div><div className={styles.hoursRowVal}>9:00 AM — 5:00 PM EAT</div>
                <div className={styles.hoursRowLabel}>Saturday</div><div className={styles.hoursRowValMuted}>Closed</div>
                <div className={styles.hoursRowLabel}>Sunday</div><div className={styles.hoursRowValMuted}>Closed</div>
              </div>
            </div>
            <div className={styles.mapCard} role="img" aria-label="Map showing PayChain's location in Nairobi, Kenya">
              {/* Embedded Google Maps iframe for Kasarani, Nairobi — responsive */}
              <iframe
                title="PayChain location — Kasarani, Nairobi"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10044.977638023242!2d36.89127089494832!3d-1.2257800686405993!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f1591a2e9a35b%3A0x31a92b030cf1ccd5!2sKasarani%2C%20Nairobi!5e1!3m2!1sen!2ske!4v1773998385663!5m2!1sen!2ske"
                className={styles.mapIframe}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.careersStrip}>
        <div className={styles.careersInner}>
          <div>
            <div className={styles.careersEyebrow}>Join the Team</div>
            <div className={styles.careersHeadline}>Want to Build PayChain With Us?</div>
            <div className={styles.careersBody}>We are a small, focused team building financial infrastructure that will matter in Kenya for a long time. If you are a talented engineer, business developer, compliance specialist, or community builder who believes Kenyan merchants deserve better — we want to hear from you.</div>
            <div className={styles.careersNote}>We review every application personally.</div>
          </div>
          <a href="#contact-form" className={styles.careersCard}>
            <Mail size={28} color="#1D9E75" />
            <div className={styles.careersEmail}>Apply via the contact form</div>
          </a>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalInner}>
          <div className={styles.pulseBadge}>Closed Beta — Q2 2026</div>
          <h2 className={styles.finalHeadline}>Not Sure Where to Start? Just Join the Waitlist.</h2>
          <p className={styles.finalBody}>If you're a Kenyan merchant and you're not sure which contact option is right for you — the waitlist is the best first step. Join in 60 seconds and our team will reach out to you directly before the Q2 2026 beta launch.</p>
          <a href="/waitlist" className={styles.finalBtn}>Join the Beta Waitlist <ArrowRight size={14} /></a>
          <div className={styles.finalMicro}>No credit card · No commitment · Limited beta spots available</div>
        </div>
      </section>
      <Footer />
      </main>
    </>
  );
}
