import React from "react";
import { Link } from "react-router-dom";
import Endpoint from "@/components/Endpoint";
import CodeGroup from "@/components/CodeGroup";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Checkout() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Checkout</h1>
      <p>
        The hosted, redirect-based flow — the same pattern Paystack and every bank gateway use.
        Your backend creates a checkout session and gets back a link; you send the customer to
        that link; PayChain hosts the entire payment page (amount, phone entry, STK push,
        status). No card or phone number ever touches your servers, and you don't build any
        payment UI at all.
      </p>

      <Callout variant="tip" title="This vs. Payments — which do I use?">
        Use <Link to="/payments"><code>POST /payments/collect</code></Link> when your own backend
        already has the customer's phone number and wants to trigger the STK push directly (an
        ISP billing run, a saved payment method). Use Checkout when you need a payment{" "}
        <em>page</em> to send someone to — an invoice link, a cart checkout, anything where the
        customer is present in a browser.
      </Callout>

      <h2>Create a checkout session</h2>
      <Endpoint method="POST" path="/checkout" auth="API key" />
      <ParamsTable
        params={[
          { name: "amount", type: "number", required: true, description: "Amount in KES, rounded up to the nearest shilling." },
          { name: "reference", type: "string", description: "Your own identifier, echoed back on the session and on the resulting payment/webhook — same convention as reference on a direct collect." },
          { name: "description", type: "string", description: "Shown on the payment page under the amount (e.g. \"Order #4821\"). Max 200 characters." },
          { name: "callbackUrl", type: "string", description: "Must be https://. Where the customer's browser is redirected after a successful payment. If omitted, the page just shows a \"you may close this window\" success state." },
          { name: "customer", type: "object", description: "Optional { phone, email, name } — phone prefills the payment page's input, but the customer can still change it before paying." },
        ]}
      />

      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/checkout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1500,
    "reference": "order-4821",
    "description": "Order #4821",
    "callbackUrl": "https://your-store.com/orders/4821/complete"
  }'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/checkout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_live_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 1500,
    reference: 'order-4821',
    description: 'Order #4821',
    callbackUrl: 'https://your-store.com/orders/4821/complete',
  }),
});

const { session } = await res.json();
res.redirect(session.checkoutUrl); // send the customer here`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/checkout',
    headers={'Authorization': 'Bearer pc_live_...'},
    json={
        'amount': 1500,
        'reference': 'order-4821',
        'description': 'Order #4821',
        'callbackUrl': 'https://your-store.com/orders/4821/complete',
    },
)

session = res.json()['session']
# redirect(session['checkoutUrl'])`,
          },
        ]}
        className="mb-4"
      />
      <CodeBlock
        lang="json"
        label="Response · 201"
        code={`{
  "success": true,
  "session": {
    "id": "6a81e153f7532030373d54d7",
    "mode": "live",
    "amount": 1500,
    "currency": "KES",
    "reference": "order-4821",
    "description": "Order #4821",
    "status": "pending",
    "callbackUrl": "https://your-store.com/orders/4821/complete",
    "checkoutUrl": "https://checkout.paychain.co.ke/pay/6a81e153f7532030373d54d7",
    "expiresAt": "2026-08-16T09:30:00.000Z",
    "createdAt": "2026-08-16T09:00:00.000Z"
  }
}`}
      />
      <p>
        Redirect the customer's browser to <code>session.checkoutUrl</code> — a plain{" "}
        <code>302</code> or a link click both work. Sessions expire 30 minutes after creation if
        never paid.
      </p>

      <h2>What happens on the hosted page</h2>
      <p>The customer sees your business name, the amount, and your <code>description</code> — enters their M-Pesa number — gets an STK prompt — and PayChain shows a live status while they respond. Once it resolves:</p>
      <ul>
        <li>On success: the page shows a confirmation, then redirects to your <code>callbackUrl</code> (if you set one) after a couple of seconds</li>
        <li>On failure: the page shows why, and lets the customer try again with a different number — the same session, no new link needed</li>
        <li>Either way, a normal <code>payment.collect.succeeded</code> / <code>payment.collect.failed</code> <Link to="/webhooks">webhook</Link> fires — checkout payments go through the exact same pipeline as a direct <code>POST /payments/collect</code> call, so nothing about your webhook handling needs to change</li>
      </ul>

      <Callout variant="warning" title="Treat callbackUrl as a UX redirect, not a confirmation">
        A customer can close the tab before the redirect fires, or the redirect can fail to load.
        Only the webhook (or a <code>GET /checkout/:id</code> poll) is a reliable signal that money
        actually moved — use the redirect to bring them back to your site, not to decide whether
        the order shipped.
      </Callout>

      <h2>Check a session's status</h2>
      <Endpoint method="GET" path="/checkout/:id" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/checkout/6a81e153f7532030373d54d7 \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns the same session object shown above with whatever <code>status</code> currently applies — <code>pending</code> (no attempt yet, or a previous one failed and it's awaiting retry), <code>processing</code> (STK push in flight), <code>success</code>, or <code>expired</code>.</p>
    </>
  );
}
