import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/FormField";
import Callout from "@/components/Callout";
import { registerDeveloper } from "@/lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", companyName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await registerDeveloper({
      name: form.name,
      companyName: form.companyName,
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Something went wrong. Try again.");
      return;
    }
    navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Create your sandbox account</h1>
      <p className="text-[13.5px] text-ink-muted mb-6">
        Free, self-serve, no approval needed. You'll have a working test-mode API key in under two minutes.
      </p>

      {error && (
        <Callout variant="warning">{error}</Callout>
      )}

      <form onSubmit={handleSubmit}>
        <FormField label="Your name" name="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        <FormField label="Company name" name="companyName" required value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
        <FormField label="Email" name="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        <FormField label="Phone (optional)" name="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <FormField
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-[13px] text-ink-faint mt-6">
        Already have an account? <Link to="/login" className="text-brand hover:text-brand-bright font-medium">Sign in</Link>
      </p>
    </AuthShell>
  );
}
