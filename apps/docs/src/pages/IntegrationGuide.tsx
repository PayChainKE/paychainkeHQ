import React from "react";
import { Link } from "react-router-dom";
import { User, Store, ArrowRight } from "lucide-react";
import Callout from "@/components/Callout";

export default function IntegrationGuide() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Integration guide</h1>
      <p>
        A slower, more complete walk through what the <Link to="/">Introduction</Link> page's
        quickstart moves through fast — the account model, whether there's a sandbox and where to
        get it, the full path to your first live payment, and what to check before you get there.
      </p>

      <h2>The account model</h2>
      <p>
        PayChain has two kinds of account, and the split trips people up more than anything else
        here — most payment APIs only have one.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 my-6">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center">
              <User className="w-4 h-4 text-brand-bright" />
            </div>
            <span className="text-[14px] font-semibold text-ink">Developer account</span>
          </div>
          <span className="block text-[13px] text-ink-muted leading-6">
            You. Holds your login, your API keys, your webhooks. Created at{" "}
            <code>/api/auth/developer/register</code>. Doesn't hold any money and can't collect or
            pay out anything on its own.
          </span>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center">
              <Store className="w-4 h-4 text-brand-bright" />
            </div>
            <span className="text-[14px] font-semibold text-ink">Merchant account</span>
          </div>
          <span className="block text-[13px] text-ink-muted leading-6">
            The actual PayChain business account with a real wallet — signed up separately, through
            the merchant dashboard, not through this API. Every payment your keys create moves
            money in or out of <em>this</em> account's balance.
          </span>
        </div>
      </div>

      <p>
        A developer account <strong>links to</strong> exactly one merchant account (see{" "}
        <Link to="/authentication">Authentication</Link> for how that link is proven). If you're
        integrating for your own business, you're both — sign up as a merchant first, then again
        as a developer, then link the two. If you're building for a client, they need an existing
        merchant account and hand you the credentials for the linking step only, once.
      </p>

      <h2>Is there a sandbox — and where is it?</h2>
      <Callout variant="tip" title="Yes — and it's not a separate place">
        There's no <code>sandbox.api.paychain.co.ke</code>, no separate base URL, nothing to point
        your app at differently. <code>https://api.paychain.co.ke</code> is the only host, for both
        test and live. The sandbox is just <em>which key you send it</em> — a{" "}
        <code>test</code>-mode key routes through the exact same endpoints and short-circuits to
        simulated behavior. Create your developer account, link a merchant, call{" "}
        <code>POST /api/developer/api-keys</code> with <code>{`{"mode":"test"}`}</code>, and you
        have a working key in the same response — usually under two minutes end to end.
      </Callout>
      <p>What "sandbox" means concretely here: every collect and payout made with a <code>test</code> key</p>
      <ul>
        <li>Never calls M-PESA, NCBA, or any real payment rail</li>
        <li>Never touches the linked merchant's real balance</li>
        <li>Settles itself to <code>success</code> a few seconds after creation, automatically — nothing to trigger manually</li>
        <li>Fires the exact same webhook events a live payment would, with the exact same payload shape</li>
      </ul>
      <p>
        In other words: you can build and fully exercise your entire integration — collect, payout,
        webhook delivery, retry handling, idempotency replay — without ever touching live access.
        Full parameter reference on the <Link to="/payments">Payments</Link> and{" "}
        <Link to="/webhooks">Webhooks</Link> pages.
      </p>

      <h2>The full path, step by step</h2>
      <div className="space-y-3 my-6">
        {[
          { title: "Register a developer account", detail: "Email + OTP verification. This is your login, separate from any merchant login." },
          { title: "Link a PayChain merchant", detail: "One-time proof of control: the merchant's password, then an OTP sent to their inbox. Skip this and every payment call returns NO_LINKED_MERCHANT." },
          { title: "Create a test-mode key", detail: "Self-serve — this is the sandbox. No approval, no waiting." },
          { title: "Build against it", detail: "Collect, payout, register a webhook, verify signatures, handle retries — all fully simulated, zero real money." },
          { title: "Request live access", detail: "One call, once you're confident. Drops into a PayChain admin's review queue." },
          { title: "Create a live key", detail: "Same endpoints, real money. Payouts also need the merchant to enable API payouts + set a PIN and caps from their own dashboard." },
        ].map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-brand-bright mt-0.5">
              {i + 1}
            </div>
            <div>
              <span className="block text-[14px] font-semibold text-ink">{step.title}</span>
              <span className="block text-[13px] text-ink-muted leading-6 mt-0.5">{step.detail}</span>
            </div>
          </div>
        ))}
      </div>
      <p>
        Exact request bodies for every one of these calls are on the{" "}
        <Link to="/">Introduction</Link> page's quickstart — this page is the map, that one's the
        commands.
      </p>

      <h2>Before you request live access</h2>
      <p>Worth checking in <code>test</code> mode first — all cheap to verify now, expensive to discover in production:</p>
      <ul>
        <li>You're sending a fresh <code>Idempotency-Key</code> per logical attempt, and retrying with the <em>same</em> key on timeout — see <Link to="/errors">Errors & idempotency</Link></li>
        <li>Your webhook endpoint verifies <code>X-PayChain-Signature</code> before acting on a delivery, not after</li>
        <li>Your webhook endpoint returns <code>2xx</code> quickly and does the real work asynchronously — a slow handler just triggers PayChain's retry backoff for no reason</li>
        <li>You're handling <code>payment.*.failed</code> events, not just the success path</li>
        <li>You're storing <code>reference</code> values that actually let you match a webhook back to your own record</li>
      </ul>

      <Callout variant="info" title="Live payouts need one more thing — on the merchant's side">
        Collecting money live only needs your live key. Paying money out live also needs the
        linked merchant to turn on API payouts, set a payout PIN, and set per-transaction/daily
        caps from their own PayChain dashboard — a deliberate separate switch, not something a
        developer key can enable for them.
      </Callout>

      <h2>Where to go next</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {[
          { to: "/payments", label: "Payments reference" },
          { to: "/webhooks", label: "Webhooks reference" },
          { to: "/guides", label: "ISP & CRM integration patterns" },
          { to: "/errors", label: "Errors & idempotency" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="group flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface hover:border-brand/30 transition-all text-[13.5px] font-semibold text-ink">
            {l.label}
            <ArrowRight className="w-3.5 h-3.5 text-ink-faint group-hover:text-brand-bright group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </>
  );
}
