import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, Smartphone, QrCode } from "lucide-react";
import { cn } from "@/lib/cn";
import { fetchCheckoutSession, payCheckoutSession, fetchCheckoutStatus, CheckoutSession } from "@/lib/api";

type ViewState = "loading" | "not-found" | "form" | "processing" | "success" | "expired";

const POLL_INTERVAL_MS = 3000;
const AUTO_REDIRECT_DELAY_MS = 2500;

function formatKes(amount: number) {
  return `Ksh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Pay() {
  const { sessionId = "" } = useParams();
  const [view, setView] = useState<ViewState>("loading");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCheckoutSession(sessionId).then(({ ok, data }) => {
      if (cancelled) return;
      if (!ok || !data.session) {
        setView("not-found");
        return;
      }
      setSession(data.session);
      setPhone(data.session.prefillPhone || "");
      if (data.session.status === "success") setView("success");
      else if (data.session.status === "expired") setView("expired");
      else setView("form");
    }).catch(() => !cancelled && setView("not-found"));
    return () => { cancelled = true; };
  }, [sessionId]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const poll = useCallback(() => {
    fetchCheckoutStatus(sessionId).then(({ ok, data }) => {
      if (!ok) return;
      if (data.status === "success") {
        setView("success");
        // callbackUrl is already validated as https:// server-side at
        // session creation (developerCheckoutController.js), but this
        // navigates the customer's browser right after a real payment, so
        // re-checking the scheme here too costs nothing and means this
        // redirect can never fire for anything other than http(s):.
        if (data.callbackUrl && /^https?:\/\//i.test(data.callbackUrl)) {
          setTimeout(() => { window.location.href = data.callbackUrl!; }, AUTO_REDIRECT_DELAY_MS);
        }
        return;
      }
      if (data.status === "expired") {
        setView("expired");
        return;
      }
      if (data.status === "pending") {
        // The attempt resolved to a failure and the session reopened for a
        // retry — surface why, then hand control back to the form.
        setFormError(data.failureReason || "That payment didn't go through. You can try again.");
        setView("form");
        return;
      }
      // Still 'processing' — keep waiting.
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
    }).catch(() => {
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
    });
  }, [sessionId]);

  useEffect(() => stopPolling, [stopPolling]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setFormError("Enter a valid M-Pesa phone number.");
      return;
    }

    setSubmitting(true);
    const { ok, data } = await payCheckoutSession(sessionId, phone);
    setSubmitting(false);

    if (!ok) {
      setFormError(data.error || "Something went wrong. Please try again.");
      return;
    }

    setView("processing");
    pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BrandMark />
          <span className="text-[13px] font-bold text-ink-muted tracking-tight">PayChain Checkout</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.12)] overflow-hidden">
          {view === "loading" && <StatePanel><Loader2 className="w-6 h-6 text-ink-faint animate-spin" /></StatePanel>}

          {view === "not-found" && (
            <StatePanel>
              <XCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-[15px] font-bold text-ink mb-1">Link not found</p>
              <p className="text-[13px] text-ink-muted text-center">This checkout link is invalid or no longer exists.</p>
            </StatePanel>
          )}

          {view === "expired" && (
            <StatePanel>
              <Clock className="w-10 h-10 text-amber-400 mb-3" />
              <p className="text-[15px] font-bold text-ink mb-1">Link expired</p>
              <p className="text-[13px] text-ink-muted text-center">This checkout link is no longer valid. Ask the merchant for a new one.</p>
            </StatePanel>
          )}

          {view === "success" && (
            <StatePanel>
              <CheckCircle2 className="w-10 h-10 text-brand mb-3" />
              <p className="text-[15px] font-bold text-ink mb-1">Payment successful</p>
              <p className="text-[13px] text-ink-muted text-center">
                {session ? formatKes(session.amount) : ""} received.{" "}
                {session?.merchantName ? `Thank you for paying ${session.merchantName}.` : ""}
              </p>
              <p className="text-[12px] text-ink-faint mt-4">You may close this window.</p>
            </StatePanel>
          )}

          {view === "processing" && (
            <StatePanel>
              <div className="relative w-12 h-12 mb-3">
                <Smartphone className="w-12 h-12 text-brand" />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand animate-ping" />
              </div>
              <p className="text-[15px] font-bold text-ink mb-1">Check your phone</p>
              <p className="text-[13px] text-ink-muted text-center">Enter your M-Pesa PIN on the prompt sent to {phone} to complete this payment.</p>
              <Loader2 className="w-4 h-4 text-ink-faint animate-spin mt-4" />
            </StatePanel>
          )}

          {view === "form" && session && (
            <>
              <div className="px-6 pt-6 pb-5 text-center border-b border-border">
                {session.mode === "test" && (
                  <span className="inline-block mb-3 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                    Test mode — no real money
                  </span>
                )}
                <p className="text-[13px] font-medium text-ink-muted mb-1">Pay {session.merchantName}</p>
                <p className="text-3xl font-extrabold text-ink tracking-tight">{formatKes(session.amount)}</p>
                {session.description && <p className="text-[13px] text-ink-faint mt-1.5">{session.description}</p>}
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5">
                <label className="block text-[12px] font-semibold text-ink-muted mb-1.5">M-Pesa phone number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-canvas text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
                />
                {formError && <p className="text-[12.5px] text-red-500 mt-2">{formError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 text-white text-[14px] font-bold transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  {submitting ? "Sending prompt…" : `Pay ${formatKes(session.amount)}`}
                </button>

                {session.qrCodeDataUri && (
                  <div className="mt-5 pt-4 border-t border-border-subtle">
                    {showQr ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={session.qrCodeDataUri}
                          alt="Scan to open this payment page on your phone"
                          className="w-36 h-36 rounded-lg border border-border p-1.5 bg-white"
                        />
                        <p className="text-[11.5px] text-ink-faint text-center mt-2.5 max-w-[220px]">
                          Scan with your phone's camera to open this same payment page there
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowQr(false)}
                          className="text-[11.5px] font-semibold text-ink-faint hover:text-ink-muted mt-2 transition-colors"
                        >
                          Hide QR code
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowQr(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        On a shared or public screen? Scan with your phone instead
                      </button>
                    )}
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-5 text-[11.5px] text-ink-faint">
          <ShieldCheck className="w-3.5 h-3.5" />
          Payments secured by PayChain
        </div>
      </div>
    </div>
  );
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14">{children}</div>;
}

function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <path d="M16 6 C21.5 6 26 10.5 26 16 C26 21.5 21.5 26 16 26 L16 6 Z" fill="#00bf63" />
      <path d="M16 6 L9 26" stroke="#f6f7f8" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
