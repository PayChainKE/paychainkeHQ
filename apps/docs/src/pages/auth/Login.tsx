import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/FormField";
import Callout from "@/components/Callout";
import { loginDeveloper } from "@/lib/api";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useDeveloperAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginDeveloper({ email, password });
    setLoading(false);

    if (!res.ok) {
      if (res.data.code === "VERIFICATION_REQUIRED") {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(res.data.error || "Invalid email or password.");
      return;
    }
    signIn(res.data.token, res.data.developer);
    navigate("/dashboard");
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Sign in</h1>
      <p className="text-[13.5px] text-ink-muted mb-6">Manage your API keys, webhooks, and live access.</p>

      {error && <Callout variant="warning">{error}</Callout>}

      <form onSubmit={handleSubmit}>
        <FormField label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField label="Password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-[13px] text-ink-faint mt-6">
        New here? <Link to="/signup" className="text-brand hover:text-brand-bright font-medium">Create a free sandbox account</Link>
      </p>
    </AuthShell>
  );
}
