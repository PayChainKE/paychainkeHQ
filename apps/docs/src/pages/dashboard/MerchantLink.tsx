import React, { useEffect, useState } from "react";
import { CheckCircle2, Plus, Unlink } from "lucide-react";
import Callout from "@/components/Callout";
import FormField from "@/components/FormField";
import {
  LinkedMerchant,
  getMerchantLinkStatus,
  startMerchantLink,
  verifyMerchantLink,
  unlinkMerchant,
} from "@/lib/api";

type Step = "loading" | "list" | "start" | "verify";

export default function MerchantLink() {
  const [step, setStep] = useState<Step>("loading");
  const [merchants, setMerchants] = useState<LinkedMerchant[]>([]);
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(nextStep?: Step) {
    const res = await getMerchantLinkStatus();
    if (res.ok) {
      setMerchants(res.data.merchants || []);
      // Nothing linked yet: go straight to the form.
      setStep(nextStep || ((res.data.merchants || []).length === 0 ? "start" : "list"));
    } else {
      setStep("start");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setMerchantEmail("");
    setMerchantPassword("");
    setOtp("");
    setError(null);
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
    setNotice(`${res.data.linkedMerchant.businessName || "The merchant"} is linked. You can now create a live key for it.`);
    resetForm();
    load("list");
  }

  async function handleUnlink(m: LinkedMerchant) {
    const name = m.businessName || "this merchant";
    if (!window.confirm(`Unlink ${name}? Every API key for it will be revoked immediately, and any integration using those keys will stop working.`)) return;
    setError(null);
    setNotice(null);
    const res = await unlinkMerchant(m.merchantId);
    if (!res.ok) {
      setError(res.data.error || "Could not unlink that merchant.");
      return;
    }
    setNotice(`${name} was unlinked and ${res.data.keysRevoked} key${res.data.keysRevoked === 1 ? "" : "s"} revoked.`);
    load();
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Merchants</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        A live API key acts for exactly one PayChain merchant account. Link every merchant you build for, proving you
        control each one once, then pick which merchant each live key is for. Test keys need no merchant.
      </p>

      {step === "loading" && <p className="text-[13px] text-ink-faint">Loading…</p>}
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && <Callout variant="warning">{error}</Callout>}

      {step === "list" && (
        <>
          <div className="space-y-3 mb-5">
            {merchants.map((m) => (
              <div key={m.merchantId} className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-brand-bright" />
                    <p className="text-[14px] font-semibold text-ink">{m.businessName || "PayChain merchant"}</p>
                  </div>
                  {m.email && <p className="text-[13px] text-ink-muted">{m.email}</p>}
                  {m.linkedAt && <p className="text-[12px] text-ink-faint mt-1">Linked {new Date(m.linkedAt).toLocaleDateString()}</p>}
                </div>
                <button
                  onClick={() => handleUnlink(m)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-red-500 hover:text-red-400 shrink-0"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unlink
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { resetForm(); setNotice(null); setStep("start"); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-[13.5px] font-semibold text-ink hover:border-brand/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link another merchant
          </button>
        </>
      )}

      {step === "start" && (
        <form onSubmit={handleStart} className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[13px] text-ink-muted mb-4">
            Sign in with the merchant account's own credentials, the ones for its PayChain merchant dashboard login,
            not a developer account.
          </p>
          <FormField label="Merchant email" type="email" required value={merchantEmail} onChange={(e) => setMerchantEmail(e.target.value)} />
          <FormField label="Merchant password" type="password" required value={merchantPassword} onChange={(e) => setMerchantPassword(e.target.value)} />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
            {merchants.length > 0 && (
              <button type="button" onClick={() => { resetForm(); setStep("list"); }} className="text-[13px] text-ink-faint hover:text-ink">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {step === "verify" && (
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
      )}
    </>
  );
}
