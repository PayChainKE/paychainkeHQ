import React, { useState } from "react";
import { ShieldCheck, Clock, ShieldAlert } from "lucide-react";
import Callout from "@/components/Callout";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";
import { requestLiveAccess } from "@/lib/api";

export default function LiveAccess() {
  const { developer, refresh } = useDeveloperAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [justRequested, setJustRequested] = useState(false);

  async function handleRequest() {
    setError(null);
    setLoading(true);
    const res = await requestLiveAccess();
    setLoading(false);
    if (!res.ok) {
      setError(res.data.error || "Could not submit the request.");
      return;
    }
    setJustRequested(true);
    refresh();
  }

  if (!developer) return null;

  const { approved, requestedAt } = developer.liveAccess;

  return (
    <>
      <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-1.5">Live access</h1>
      <p className="text-[14px] text-ink-muted mb-8">
        Test-mode keys work immediately with no approval — build and fully exercise your integration there first.
        Live keys move real money and need a PayChain admin to review your account.
      </p>

      {error && <Callout variant="warning">{error}</Callout>}

      {approved ? (
        <div className="rounded-xl border border-brand/30 bg-brand/[0.06] p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-brand-bright shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-ink">Live access approved</p>
            <p className="text-[13px] text-ink-muted mt-0.5">You can create live-mode keys from the API keys page.</p>
          </div>
        </div>
      ) : requestedAt || justRequested ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-ink">Request pending review</p>
            <p className="text-[13px] text-ink-muted mt-0.5">
              Submitted {requestedAt ? new Date(requestedAt).toLocaleDateString() : "just now"}. A PayChain admin will
              review your account — you'll be able to create live-mode keys as soon as it's approved.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-ink-faint shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-ink">Not requested yet</p>
              <p className="text-[13px] text-ink-muted mt-0.5">
                Worth checking your test-mode integration handles idempotency, webhook signature verification,
                and failure events first — see the <a href="/integration-guide" className="text-brand hover:text-brand-bright">Integration Guide</a>.
              </p>
            </div>
          </div>
          <button
            onClick={handleRequest}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Request live access"}
          </button>
        </div>
      )}
    </>
  );
}
