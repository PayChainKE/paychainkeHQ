import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Callout from "@/components/Callout";
import FormField from "@/components/FormField";
import { getMerchantLinkStatus, startMerchantLink, verifyMerchantLink } from "@/lib/api";

type Step = "loading" | "linked" | "start" | "verify";

export default function MerchantLink() {
  const [step, setStep] = useState<Step>("loading");
  const [merchant, setMerchant] = useState<{ businessName: string; email: string } | null>(null);
  const [linkedAt, setLinkedAt] = useState<string | null>(null);
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMerchantLinkStatus().then((res) => {
      if (res.ok && res.data.linked) {
        setMerchant(res.data.merchant || null);
        setLinkedAt(res.data.linkedAt || null);
        setStep("linked");
      } else {
        setStep("start");
      }
    });
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await startMerchantLink({ merchantEmail, merchantPassword });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Could not verify those merchant credentials.");
      return;
    }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyMerchantLink({ merchantEmail, otp });
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Invalid code.");
      return;
    }
    setMerchant({ businessName: res.data.linkedMerchant.businessName, email: merchantEmail });
    setLinkedAt(res.data.linkedMerchant.linkedAt);
    setStep("linked");
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Merchant</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        Every API key acts on behalf of one PayChain merchant account; this proves you control it, once.
      </p>

      {step === "loading" && <p className="text-[13px] text-ink-faint">Loading…</p>}

      {step === "linked" && merchant && (
        <div className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-brand-bright" />
            <p className="text-[14px] font-semibold text-ink">{merchant.businessName}</p>
          </div>
          <p className="text-[13px] text-ink-muted">{merchant.email}</p>
          {linkedAt && <p className="text-[12px] text-ink-faint mt-1">Linked {new Date(linkedAt).toLocaleDateString()}</p>}
        </div>
      )}

      {step === "start" && (
        <>
          {error && <Callout variant="warning">{error}</Callout>}
          <form onSubmit={handleStart} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[13px] text-ink-muted mb-4">
              Sign in with the merchant account's own credentials, the ones for its PayChain merchant dashboard login,
              not a developer account.
            </p>
            <FormField label="Merchant email" type="email" required value={merchantEmail} onChange={(e) => setMerchantEmail(e.target.value)} />
            <FormField label="Merchant password" type="password" required value={merchantPassword} onChange={(e) => setMerchantPassword(e.target.value)} />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        </>
      )}

      {step === "verify" && (
        <>
          {error && <Callout variant="warning">{error}</Callout>}
          <form onSubmit={handleVerify} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[13px] text-ink-muted mb-4">
              A verification code was sent to <strong className="text-ink">{merchantEmail}</strong>, the merchant's own
              inbox, not yours, so someone else can't link their wallet with only your session.
            </p>
            <FormField
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="482910"
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
            >
              {loading ? "Linking…" : "Link merchant"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
