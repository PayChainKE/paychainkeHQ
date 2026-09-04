import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/FormField";
import Callout from "@/components/Callout";
import { forgotDeveloperPassword } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await forgotDeveloperPassword({ email });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Something went wrong. Try again.");
      return;
    }
    navigate(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Reset your password</h1>
      <p className="text-[13.5px] text-ink-muted mb-6">
        Enter the email on your developer account and we'll send a 6-digit code to reset your password.
      </p>

      {error && <Callout variant="warning">{error}</Callout>}

      <form onSubmit={handleSubmit}>
        <FormField label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold shadow-sm shadow-brand/30 hover:bg-brand-dim hover:shadow-md hover:shadow-brand/30 transition-all disabled:opacity-60 disabled:shadow-none"
        >
          {loading ? "Sending code…" : "Send reset code"}
        </button>
      </form>

      <p className="text-center text-[13px] text-ink-faint mt-6">
        Remembered it? <Link to="/login" className="text-brand hover:text-brand-bright font-medium">Sign in</Link>
      </p>
    </AuthShell>
  );
}
