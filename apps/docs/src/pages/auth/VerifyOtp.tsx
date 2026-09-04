import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/FormField";
import Callout from "@/components/Callout";
import { verifyDeveloperOtp, resendDeveloperOtp } from "@/lib/api";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn } = useDeveloperAuth();
  const email = params.get("email") || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyDeveloperOtp({ email, otp });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Invalid code. Try again.");
      return;
    }
    signIn(res.data.token, res.data.developer);
    navigate("/dashboard");
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const res = await resendDeveloperOtp({ email });
    setResending(false);
    if (!res.ok) {
      setError(res.data.error || "Could not resend the code.");
      return;
    }
    setNotice("A new code is on its way.");
  }

  if (!email) {
    return (
      <AuthShell>
        <Callout variant="warning">
          No email to verify. Start from <a href="/signup" className="underline">sign up</a> again.
        </Callout>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Check your email</h1>
      <p className="text-[13.5px] text-ink-muted mb-6">
        We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Enter it below to activate your account.
      </p>

      {error && <Callout variant="warning">{error}</Callout>}
      {notice && !error && <Callout variant="tip">{notice}</Callout>}

      <form onSubmit={handleSubmit}>
        <FormField
          label="Verification code"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
        />
        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold shadow-sm shadow-brand/30 hover:bg-brand-dim hover:shadow-md hover:shadow-brand/30 transition-all disabled:opacity-60 disabled:shadow-none"
        >
          {loading ? "Verifying…" : "Verify and continue"}
        </button>
      </form>

      <button
        onClick={handleResend}
        disabled={resending}
        className="w-full text-center text-[13px] text-ink-faint hover:text-ink mt-5 transition-colors disabled:opacity-60"
      >
        {resending ? "Sending…" : "Didn't get it? Resend code"}
      </button>
    </AuthShell>
  );
}
