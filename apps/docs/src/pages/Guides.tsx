import React from "react";
import { Wifi, Users } from "lucide-react";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";

export default function Guides() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Integration patterns</h1>
      <p>Two shapes cover almost every integration built on PayChain so far. Both follow the same rule: initiate with your own reference, react to the webhook, never poll in a loop.</p>

      <div className="flex items-center gap-2.5 mt-12 mb-1">
        <Wifi className="w-4 h-4 text-brand-bright" />
        <h2 className="!mt-0 !mb-0">ISP: auto-reconnect on payment</h2>
      </div>
      <p>A subscriber's internet is suspended for non-payment. The moment they pay, they should be back online with no manual step on your side.</p>

      <h3>1. Collect with the subscriber ID as the reference</h3>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/collect \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: bill-2026-08-sub-88213" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 3500,
    "phone": "0712345678",
    "reference": "sub-88213"
  }'`}
      />

      <h3>2. Handle the webhook</h3>
      <CodeBlock
        lang="js"
        label="Node.js (Express)"
        code={`app.post('/webhooks/paychain', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!isValidSignature(req.body, req.headers['x-paychain-signature'], WEBHOOK_SECRET)) {
    return res.status(401).end();
  }

  const event = JSON.parse(req.body);
  res.status(200).end(); // ack fast, then act

  if (event.event === 'payment.collect.succeeded') {
    const subscriberId = event.data.payment.reference; // "sub-88213"
    await provisioningApi.liftSuspension(subscriberId);
  }
});`}
      />

      <Callout variant="tip" title="Why the reference field carries the subscriber ID">
        You already know which subscriber paid at collect time. Encode that in <code>reference</code>{" "}
        and every webhook for that payment carries it back to you. No separate lookup step, no
        matching by phone number or amount.
      </Callout>

      <div className="flex items-center gap-2.5 mt-14 mb-1">
        <Users className="w-4 h-4 text-brand-bright" />
        <h2 className="!mt-0 !mb-0">CRM: keep deal/invoice status in sync</h2>
      </div>
      <p>A payment happening anywhere in PayChain should update the matching record in your CRM without anyone opening a dashboard to check.</p>

      <h3>1. Subscribe to every payment event</h3>
      <CodeBlock
        lang="bash"
        label="curl · one-time setup"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/webhooks \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-crm.example.com/hooks/paychain","events":["*"]}'`}
      />

      <h3>2. Route each event to the right record</h3>
      <CodeBlock
        lang="js"
        label="Node.js"
        code={`const handlers = {
  'payment.collect.succeeded': async (p) => crm.markInvoicePaid(p.reference, p.amount),
  'payment.collect.failed':    async (p) => crm.flagPaymentFailed(p.reference, p.failureReason),
  'payment.payout.succeeded':  async (p) => crm.markPayoutSent(p.reference),
  'payment.payout.failed':     async (p) => crm.alertOpsPayoutFailed(p.reference, p.failureReason),
};

app.post('/hooks/paychain', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!isValidSignature(req.body, req.headers['x-paychain-signature'], WEBHOOK_SECRET)) {
    return res.status(401).end();
  }
  res.status(200).end();

  const { event, data } = JSON.parse(req.body);
  await handlers[event]?.(data.payment);
});`}
      />

      <h3>3. Reconcile with a periodic pull, as a backstop</h3>
      <p>
        Webhooks cover the real-time path; a nightly job that calls{" "}
        <code>GET /payments/:id</code> for anything still <code>pending</code> after an hour
        catches the rare case where a delivery was missed even after retries.
      </p>
    </>
  );
}
