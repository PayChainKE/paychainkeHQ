import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Clock, ShieldAlert } from "lucide-react";
import Callout from "@/components/Callout";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";
import { LinkedMerchant, getMerchantLinkStatus, requestLiveAccess } from "@/lib/api";

// Live access is approved per merchant: each merchant you link starts in the
// sandbox and is reviewed on its own.
export default function LiveAccess() {
  const { developer, refresh } = useDeveloperAuth();
  const [merchants, setMerchants] = useState<LinkedMerchant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await getMerchantLinkStatus();
    if (res.ok) setMerchants(res.data.merchants || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRequest(m: LinkedMerchant) {
    setError(null);
    setBusyId(m.merchantId);
    const res = await requestLiveAccess(m.merchantId);
    setBusyId(null);
    if (!res.ok) {
      setError(res.data.error || "Could not submit the request.");
      return;
    }
    await load();
    refresh();
  }

  if (!developer) return null;

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Live access</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        Test-mode keys work immediately with no approval: build and fully exercise your integration there first.
        Live keys move real money, so a PayChain admin reviews each merchant you link before you can create a live key for it.
      </p>

      {error && <Callout variant="warning">{error}</Callout>}

      {merchants === null && <p className="text-[13px] text-ink-faint">Loading…</p>}

      {merchants?.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-ink-faint shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-ink">No merchant linked yet</p>
            <p className="text-[13px] text-ink-muted mt-0.5">
              Link the real merchant account you're building for on the{" "}
              <Link to="/dashboard/merchant" className="text-brand hover:text-brand-bright">Merchants</Link> page, then request live access for it here.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {merchants?.map((m) => {
          const la = m.liveAccess;
          const name = m.businessName || m.email || "Merchant";
          if (la?.approved) {
            return (
              <div key={m.merchantId} className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-bright shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-ink">{name}: live access approved</p>
                  <p className="text-[13px] text-ink-muted mt-0.5">You can create a live key for this merchant from the API keys page.</p>
                </div>
              </div>
            );
          }
          if (la?.requestedAt) {
            return (
              <div key={m.merchantId} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-ink">{name}: request pending review</p>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Submitted {new Date(la.requestedAt).toLocaleDateString()}. You can create a live key for this merchant as soon as it's approved.
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={m.merchantId} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3 mb-4">
                <ShieldAlert className="w-5 h-5 text-ink-faint shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-ink">{name}: sandbox only</p>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Worth checking your test-mode integration handles idempotency, webhook signature verification,
                    and failure events first; see the <a href="/integration-guide" className="text-brand hover:text-brand-bright">Integration Guide</a>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRequest(m)}
                disabled={busyId === m.merchantId}
                className="px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
              >
                {busyId === m.merchantId ? "Submitting…" : "Request live access"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
