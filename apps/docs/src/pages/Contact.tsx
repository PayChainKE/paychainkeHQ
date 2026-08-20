import React, { useState } from "react";
import { Mail, Phone, MapPin, Twitter, Linkedin, Youtube, CheckCircle2 } from "lucide-react";
import { submitContactMessage } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Name, email, subject, and message are required.");
      return;
    }
    setStatus("submitting");
    setError("");
    const { ok, data } = await submitContactMessage(form);
    if (ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(data.error || "Something went wrong. Please try again, or email us directly.");
    }
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Contact Us</h1>
      <p>
        Questions about the API, a partnership enquiry, press, or anything else — reach us
        directly, or send a message below. For integration troubleshooting and FAQs, see{" "}
        <a href="/help">Help &amp; Support</a> first; it usually resolves faster.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 not-prose mb-8">
        <a
          href="mailto:support@paychain.co.ke"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4 hover:border-brand/40 hover:bg-surface transition-colors"
        >
          <Mail className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Support</p>
            <p className="text-[13px] text-ink-muted">support@paychain.co.ke</p>
            <p className="text-[12px] text-ink-faint mt-1">Integration issues, live-access questions, technical problems.</p>
          </div>
        </a>
        <a
          href="mailto:info@paychain.co.ke"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4 hover:border-brand/40 hover:bg-surface transition-colors"
        >
          <Mail className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">General enquiries</p>
            <p className="text-[13px] text-ink-muted">info@paychain.co.ke</p>
            <p className="text-[12px] text-ink-faint mt-1">Partnerships, press, sales, anything else.</p>
          </div>
        </a>
        <a
          href="tel:+254743283782"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4 hover:border-brand/40 hover:bg-surface transition-colors"
        >
          <Phone className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Phone</p>
            <p className="text-[13px] text-ink-muted">+254 743 283 782</p>
            <p className="text-[12px] text-ink-faint mt-1">Mon–Sat, 7am–9pm EAT.</p>
          </div>
        </a>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4">
          <MapPin className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">PayChain Financial Services Ltd</p>
            <p className="text-[13px] text-ink-muted">Nairobi, Kenya</p>
            <div className="flex items-center gap-3 mt-2">
              <a href="https://x.com/PayChainKE" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors"><Twitter className="w-3.5 h-3.5" /></a>
              <a href="https://www.linkedin.com/company/paychainke/" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors"><Linkedin className="w-3.5 h-3.5" /></a>
              <a href="https://youtube.com/@paychainke?si=Gd-JO-cJpvQYhdui" target="_blank" rel="noopener noreferrer" className="text-ink-faint hover:text-brand-bright transition-colors"><Youtube className="w-3.5 h-3.5" /></a>
            </div>
          </div>
        </div>
      </div>

      <h2>Send a message</h2>
      {status === "sent" ? (
        <div className="not-prose flex items-start gap-3 rounded-lg border border-brand/20 bg-brand/[0.06] p-4">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Message sent</p>
            <p className="text-[13px] text-ink-muted mt-0.5">We typically reply within one business day. You'll hear back at {form.email}.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="not-prose space-y-4 max-w-lg">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" value={form.name} onChange={(v) => update("name", v)} required />
            <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          </div>
          <Field label="Phone (optional)" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field label="Subject" value={form.subject} onChange={(v) => update("subject", v)} required />
          <div>
            <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              rows={5}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
              placeholder="What's on your mind?"
            />
          </div>
          {error && <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
          >
            {status === "submitting" ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-ink mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
      />
    </div>
  );
}
