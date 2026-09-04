import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/FormField";
import Callout from "@/components/Callout";
import { forgotDeveloperPassword, verifyDeveloperResetOtp, resetDeveloperPassword } from "@/lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") || "";

  const [step, setStep] = useState<"otp" | "password" | "done">("otp");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyDeveloperResetOtp({ email, otp });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Invalid code. Try again.");
      return;
    }
    setResetToken(res.data.resetToken);
    setStep("password");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await resetDeveloperPassword({ resetToken, newPassword });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Could not reset your password. Start again.");
      return;
    }
    setStep("done");
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const res = await forgotDeveloperPassword({ email });
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
          No email to reset. Start from <Link to="/forgot-password" className="underline">forgot password</Link> again.
        </Callout>
      </AuthShell>
    );
  }

  if (step === "done") {
    return (
      <AuthShell>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Password reset</h1>
        <p className="text-[13.5px] text-ink-muted mb-6">
          Your password has been changed, and any other devices signed in have been signed out. Use your new password to sign in.
        </p>
        <Link
          to="/login"
          className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold shadow-sm shadow-brand/30 hover:bg-brand-dim hover:shadow-md hover:shadow-brand/30 transition-all"
        >
          Sign in
        </Link>
      </AuthShell>
    );
  }

  if (step === "password") {
    return (
      <AuthShell>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Set a new password</h1>
        <p className="text-[13.5px] text-ink-muted mb-6">
          Choose a new password for <strong className="text-ink">{email}</strong>.
        </p>

        {error && <Callout variant="warning">{error}</Callout>}

        <form onSubmit={handleSetPassword}>
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            required
            minLength={8}
            hint="At least 8 characters."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold shadow-sm shadow-brand/30 hover:bg-brand-dim hover:shadow-md hover:shadow-brand/30 transition-all disabled:opacity-60 disabled:shadow-none"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Check your email</h1>
      <p className="text-[13.5px] text-ink-muted mb-6">
        We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Enter it below to continue.
      </p>

      {error && <Callout variant="warning">{error}</Callout>}
      {notice && !error && <Callout variant="tip">{notice}</Callout>}

      <form onSubmit={handleVerifyOtp}>
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
          {loading ? "Verifying…" : "Verify code"}
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
