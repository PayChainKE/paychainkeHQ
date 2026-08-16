import React from "react";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Errors() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Errors & idempotency</h1>

      <h2>Error shape</h2>
      <p>Every error response is JSON with at least an <code>error</code> message. Some carry a stable <code>code</code> too, worth matching on instead of the message text.</p>
      <CodeBlock
        lang="json"
        label="Example"
        code={`{
  "error": "No merchant account linked. Complete /api/developer/link-merchant first.",
  "code": "NO_LINKED_MERCHANT"
}`}
      />

      <h2>Status codes</h2>
      <ParamsTable
        params={[
          { name: "400", type: "status", description: "Malformed request: a missing required field, an invalid phone number, a missing Idempotency-Key header." },
          { name: "401", type: "status", description: "Missing/invalid API key or developer JWT, or (on a payout) a wrong apiPayoutPin." },
          { name: "402", type: "status", description: "A live payout was attempted and failed: insufficient funds or an invalid destination account. The partial payment object is included so you can inspect failureReason." },
          { name: "403", type: "status", description: "Understood, but not allowed: e.g. a live key with no linked merchant, API payouts not enabled, or a per-transaction/daily cap exceeded." },
          { name: "404", type: "status", description: "The resource (payment, webhook) doesn't exist, or doesn't belong to your developer account." },
          { name: "409", type: "status", description: "An Idempotency-Key was reused for a request that's still being processed. Retry shortly." },
          { name: "429", type: "status", description: "Rate limited, or a payout PIN temporarily locked after too many failed attempts." },
          { name: "500", type: "status", description: "Something broke on PayChain's side. Safe to retry with the same Idempotency-Key." },
        ]}
      />

      <h2>Common error codes</h2>
      <ParamsTable
        params={[
          { name: "IDEMPOTENCY_KEY_REQUIRED", type: "code", description: "You're missing the Idempotency-Key header on a POST /payments/collect or /payments/payout call." },
          { name: "NO_LINKED_MERCHANT", type: "code", description: "This developer account hasn't completed /api/developer/link-merchant yet." },
          { name: "LIVE_ACCESS_NOT_APPROVED", type: "code", description: "You tried to create a live-mode API key before an admin approved your live-access request." },
          { name: "API_PAYOUT_NOT_ENABLED", type: "code", description: "The linked merchant hasn't enabled API payouts (and set a PIN + caps) from their dashboard." },
          { name: "PER_TRANSACTION_CAP_EXCEEDED", type: "code", description: "A live payout exceeded the merchant's configured per-transaction limit." },
          { name: "DAILY_CAP_EXCEEDED", type: "code", description: "A live payout would exceed the merchant's rolling 24-hour payout limit." },
        ]}
      />

      <h2>Idempotency</h2>
      <p>
        <code>POST /payments/collect</code> and <code>POST /payments/payout</code> both require an{" "}
        <code>Idempotency-Key</code> header: any string you generate, unique per logical attempt
        (a UUID per user action, not per HTTP request).
      </p>
      <Callout variant="tip" title="Retry with the same key, not a new one">
        If your request times out or you get a 500, retry with the <em>identical</em> key. You'll
        get back the original payment (<code>replayed: true</code>) instead of creating a second one.
        Only generate a fresh key when the customer/action is genuinely a new attempt.
      </Callout>
      <CodeBlock
        lang="json"
        label="A replayed request returns 200, not 201"
        code={`{
  "success": true,
  "replayed": true,
  "payment": { "id": "65f3a1e2c9d4e1a2b3c4d5e6", "status": "pending", "...": "..." }
}`}
      />
    </>
  );
}
