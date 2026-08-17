import React from "react";
import { Mail, Phone, Clock, ShieldAlert } from "lucide-react";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Help() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Help & Support</h1>
      <p>
        Stuck on an integration, chasing a missing webhook, or waiting on live access? Here's where
        to look first, and how to reach us when you still need a human.
      </p>

      <h2>Contact us</h2>
      <div className="grid sm:grid-cols-2 gap-4 not-prose mb-6">
        <a
          href="mailto:support@paychain.co.ke"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4 hover:border-brand/40 hover:bg-surface transition-colors"
        >
          <Mail className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Email support</p>
            <p className="text-[13px] text-ink-muted">support@paychain.co.ke</p>
            <p className="text-[12px] text-ink-faint mt-1">Best for API/integration issues — include your developer email, the endpoint, and a request/delivery ID if you have one.</p>
          </div>
        </a>
        <a
          href="tel:+254743283782"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4 hover:border-brand/40 hover:bg-surface transition-colors"
        >
          <Phone className="w-4 h-4 mt-0.5 text-brand-bright shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Phone</p>
            <p className="text-[13px] text-ink-muted">+254 743 283 782</p>
            <p className="text-[12px] text-ink-faint mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Mon–Sat, 7am–9pm EAT</p>
          </div>
        </a>
      </div>

      <Callout variant="tip" title="Before you reach out">
        Most integration issues are answered faster by checking <code>GET /webhooks/:id/deliveries</code> for
        delivery errors, or the <a href="/errors">Errors &amp; idempotency</a> page for your status code —
        both usually pinpoint the exact cause without waiting on a reply.
      </Callout>

      <h2>Frequently asked questions</h2>
      <ParamsTable
        params={[
          { name: "Test vs. live keys", type: "keys", description: "Test-mode keys (pc_test_...) work immediately and simulate every collect/payout — no real rail or merchant balance is touched. Live keys (pc_live_...) require an admin to approve a live-access request first. See Authentication." },
          { name: "My live access request is pending", type: "keys", description: "An admin reviews every live-access request manually. If it's been more than a couple of business days, email support@paychain.co.ke with your developer account email and linked merchant name." },
          { name: "Webhook events aren't arriving", type: "webhooks", description: "Confirm your endpoint is https:// and returns a 2xx within 10s. Use POST /webhooks/:id/test to send a one-off event, and check GET /webhooks/:id/deliveries for the exact failure reason of past attempts." },
          { name: "I lost my webhook secret", type: "webhooks", description: "It's shown once, at creation, and never displayed again. Delete the endpoint and create a new one to get a fresh secret." },
          { name: "A live payout returned 402 or 403", type: "payouts", description: "402 means the payout was attempted and failed (check failureReason on the payment object). 403 usually means the merchant hasn't enabled API payouts, set a payout PIN, or the amount exceeded a configured per-transaction/daily cap." },
          { name: "Can I retry a failed request safely?", type: "errors", description: "Yes — retry POST /payments/collect or /payments/payout with the exact same Idempotency-Key and you'll get the original result back instead of a duplicate. Only generate a new key for a genuinely new attempt." },
        ]}
      />

      <h2>Report a security issue</h2>
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 not-prose">
        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" />
        <p className="text-[13.5px] leading-6 text-ink-muted">
          Found a vulnerability in the API, dashboard, or a webhook signature check? Email{" "}
          <a href="mailto:support@paychain.co.ke" className="text-ink font-medium underline underline-offset-2">support@paychain.co.ke</a>{" "}
          with details and steps to reproduce — please don't test against other merchants' live data.
        </p>
      </div>
    </>
  );
}
