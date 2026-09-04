import React from "react";
import { Link } from "react-router-dom";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function PaymentCollection() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Payment Collection</h1>
      <p>
        Four ways to collect from a customer: trigger an STK push directly, redirect to a hosted
        checkout page, share a payment link, or show a dynamic QR code. All four settle into the
        same place (your linked merchant's wallet) and resolve through the same webhook events.
        Base path <code>https://api.paychain.co.ke/api/v1/developer</code>.
      </p>

      <Callout variant="tip" title="Which one do I use?">
        Use <strong>STK push</strong> when your own backend already has the customer's phone
        number (an ISP billing run, a saved payment method). Use <strong>Checkout</strong> or a{" "}
        <strong>payment link</strong> when you need a page to send someone to. Use a{" "}
        <strong>QR code</strong> when the customer is physically present: a till, a delivery
        rider, a printed invoice.
      </Callout>

      <h2>STK push</h2>
      <p>Sends an STK push to a customer's phone. Money lands in your linked merchant's wallet.</p>
      <Endpoint method="POST" path="/payments/collect" auth="API key" />

      <Callout variant="tip" title="Idempotency-Key is required">
        Generate one unique value per logical attempt (a UUID is fine) and send it as the{" "}
        <code>Idempotency-Key</code> header. Retry with the <em>same</em> key after a timeout or
        network error and you'll get the original payment back (<code>replayed: true</code>)
        instead of a duplicate charge.
      </Callout>

      <ParamsTable
        params={[
          { name: "amount", type: "number", required: true, description: "Amount in KES, rounded up to the nearest shilling." },
          { name: "phone", type: "string", required: true, description: "A Kenyan phone number, any common format (0712345678, 254712345678, +254712345678)." },
          { name: "reference", type: "string", description: "Your own identifier: a CRM contact ID, an ISP subscriber account number. Echoed back on the payment object and every webhook event for it, so you can match without a lookup." },
        ]}
      />

      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/collect \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 8f14e45f-...-4321" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 500,
    "phone": "0712345678",
    "reference": "subscriber-4821"
  }'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/payments/collect', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_live_...',
    'Idempotency-Key': '8f14e45f-...-4321',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 500,
    phone: '0712345678',
    reference: 'subscriber-4821',
  }),
});

const { payment } = await res.json();
console.log(payment.status); // "pending"`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/payments/collect',
    headers={
        'Authorization': 'Bearer pc_live_...',
        'Idempotency-Key': '8f14e45f-...-4321',
    },
    json={
        'amount': 500,
        'phone': '0712345678',
        'reference': 'subscriber-4821',
    },
)

payment = res.json()['payment']
print(payment['status'])  # "pending"`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/payments/collect');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_live_...',
        'Idempotency-Key: 8f14e45f-...-4321',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 500,
        'phone' => '0712345678',
        'reference' => 'subscriber-4821',
    ]),
]);

$payment = json_decode(curl_exec($ch), true)['payment'];
echo $payment['status']; // "pending"`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/payments/collect')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_live_...',
  'Idempotency-Key' => '8f14e45f-...-4321',
  'Content-Type' => 'application/json',
})
req.body = { amount: 500, phone: '0712345678', reference: 'subscriber-4821' }.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
payment = JSON.parse(res.body)['payment']
puts payment['status'] # "pending"`,
          },
        ]}
        className="mb-4"
      />
      <CodeBlock
        lang="json"
        label="Response · 201"
        code={`{
  "success": true,
  "payment": {
    "id": "65f3a1e2c9d4e1a2b3c4d5e6",
    "mode": "live",
    "kind": "collect",
    "amount": 500,
    "currency": "KES",
    "status": "pending",
    "reference": "subscriber-4821",
    "counterparty": { "phone": "254712345678" },
    "createdAt": "2026-08-16T09:00:00.000Z",
    "updatedAt": "2026-08-16T09:00:00.000Z"
  }
}`}
      />
      <p>
        <code>status</code> starts <code>pending</code> and resolves asynchronously once the
        customer responds to the prompt. Don't poll in a tight loop for this. Subscribe a{" "}
        <Link to="/webhooks">webhook</Link> instead.
      </p>

      <h2>Hosted checkout</h2>
      <p>
        The redirect-based flow: the same pattern Paystack and every bank gateway use. Your
        backend creates a checkout session and gets back a link; you send the customer to that
        link; PayChain hosts the entire payment page (amount, phone entry, STK push, status). No
        card or phone number ever touches your servers, and you don't build any payment UI at all.
      </p>
      <Endpoint method="POST" path="/checkout" auth="API key" />
      <ParamsTable
        params={[
          { name: "amount", type: "number", required: true, description: "Amount in KES, rounded up to the nearest shilling." },
          { name: "reference", type: "string", description: "Your own identifier, echoed back on the session and on the resulting payment/webhook." },
          { name: "description", type: "string", description: "Shown on the payment page under the amount (e.g. \"Order #4821\"). Max 200 characters." },
          { name: "callbackUrl", type: "string", description: "Must be https://. Where the customer's browser is redirected after a successful payment. If omitted, the page just shows a \"you may close this window\" success state." },
          { name: "customer", type: "object", description: "Optional { phone, email, name }. Phone prefills the payment page's input, but the customer can still change it before paying." },
          { name: "expiresInMinutes", type: "number", description: "How long the link stays payable. Defaults to 30. Accepts up to 10080 (7 days); set this higher for a payment link you're sharing directly rather than redirecting a customer to mid-purchase." },
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
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/checkout');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_live_...',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 1500,
        'reference' => 'order-4821',
        'description' => 'Order #4821',
        'callbackUrl' => 'https://your-store.com/orders/4821/complete',
    ]),
]);

$session = json_decode(curl_exec($ch), true)['session'];
header('Location: ' . $session['checkoutUrl']); // send the customer here`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/checkout')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_live_...',
  'Content-Type' => 'application/json',
})
req.body = {
  amount: 1500,
  reference: 'order-4821',
  description: 'Order #4821',
  callbackUrl: 'https://your-store.com/orders/4821/complete',
}.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
session = JSON.parse(res.body)['session']
redirect_to session['checkoutUrl'] # send the customer here`,
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
    "qrCodeDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "expiresAt": "2026-08-16T09:30:00.000Z",
    "createdAt": "2026-08-16T09:00:00.000Z"
  }
}`}
      />
      <p>
        Redirect the customer's browser to <code>session.checkoutUrl</code>, or render{" "}
        <code>session.qrCodeDataUri</code> directly in an <code>&lt;img&gt;</code> tag for them to
        scan; see <a href="#dynamic-qr-codes">Dynamic QR codes</a> below. Sessions expire 30
        minutes after creation by default if never paid.
      </p>

      <h3>What happens on the hosted page</h3>
      <p>The customer sees your business name, the amount, and your <code>description</code>, enters their M-Pesa number, gets an STK prompt, and PayChain shows a live status while they respond. Once it resolves:</p>
      <ul>
        <li>On success: the page shows a confirmation, then redirects to your <code>callbackUrl</code> (if you set one) after a couple of seconds</li>
        <li>On failure: the page shows why, and lets the customer try again with a different number, the same session, no new link needed</li>
        <li>Either way, a normal <code>payment.collect.succeeded</code> / <code>payment.collect.failed</code> <Link to="/webhooks">webhook</Link> fires; checkout payments go through the exact same pipeline as a direct <code>POST /payments/collect</code> call</li>
      </ul>
      <Callout variant="warning" title="Treat callbackUrl as a UX redirect, not a confirmation">
        A customer can close the tab before the redirect fires, or the redirect can fail to load.
        Only the webhook (or a <code>GET /checkout/:id</code> poll) is a reliable signal that money
        actually moved.
      </Callout>

      <h3>Check a session's status</h3>
      <Endpoint method="GET" path="/checkout/:id" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/checkout/6a81e153f7532030373d54d7 \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns the same session object shown above with whatever <code>status</code> currently applies: <code>pending</code>, <code>processing</code> (STK push in flight), <code>success</code>, or <code>expired</code>.</p>

      <h2>Payment links</h2>
      <p>
        A payment link, in the Paystack/Stripe sense, is a <code>checkoutUrl</code> you share
        directly instead of one you redirect a customer through mid-purchase: dropped into a
        WhatsApp message, an SMS, an email, or printed on an invoice, then paid whenever the
        customer gets to it. There's no separate endpoint for this: it's the exact same{" "}
        <code>POST /checkout</code> above, used two ways:
      </p>
      <ul>
        <li>Skip <code>callbackUrl</code>: there's nothing to redirect back to for a link with no specific purchase flow behind it</li>
        <li>Set <code>expiresInMinutes</code> to however long the link should stay valid: a day, a week, up to 10080 minutes (7 days)</li>
      </ul>
      <CodeBlock
        lang="bash"
        label="Create a 7-day payment link"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/checkout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500,
    "reference": "invoice-2026-0417",
    "description": "Invoice #0417",
    "expiresInMinutes": 10080
  }'`}
      />
      <Callout variant="tip" title="Same webhook, same status polling, same everything">
        A payment link resolves through the identical <code>payment.collect.succeeded</code> /{" "}
        <code>payment.collect.failed</code> webhook and <code>GET /checkout/:id</code> status poll
        as a normal checkout session. If you're already handling one, you're already handling the
        other.
      </Callout>

      <h2 id="dynamic-qr-codes">Dynamic QR codes</h2>
      <p>
        Every checkout session's response includes <code>qrCodeDataUri</code>, a PayChain-branded,
        scannable PNG (as a <code>data:image/png;base64,...</code> URI, no separate download or
        image-hosting step) encoding that exact session's <code>checkoutUrl</code>. "Dynamic"
        because it's generated fresh per session and amount: printed on a till receipt, shown on
        a delivery rider's phone, or embedded on an invoice, each one only ever pays that one
        specific amount into that one specific session.
      </p>
      <CodeBlock
        lang="text"
        label="Render it directly, no extra request needed"
        code={`<img src="{session.qrCodeDataUri}" alt="Scan to pay" width="240" height="240" />`}
      />
      <Callout variant="info" title="No separate QR endpoint">
        There's nothing to call beyond <code>POST /checkout</code> above; the QR is just another
        field on the same response. Scanning it and paying resolves through the identical{" "}
        <code>payment.collect.succeeded</code> webhook as every other collection method here.
      </Callout>

      <h2>Check any payment's status</h2>
      <Endpoint method="GET" path="/payments/:id" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/payments/65f3a1e2c9d4e1a2b3c4d5e6 \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns the payment object shown above, with whatever <code>status</code> currently applies. A safe fallback to poll, but a <Link to="/webhooks">webhook</Link> subscription is faster and cheaper.</p>

      <h2>The payment object</h2>
      <ParamsTable
        params={[
          { name: "id", type: "string", description: "This payment's unique ID." },
          { name: "mode", type: "\"test\" | \"live\"", description: "Which key created it." },
          { name: "kind", type: "\"collect\" | \"payout\"", description: "" },
          { name: "amount", type: "number", description: "In KES." },
          { name: "status", type: "\"pending\" | \"success\" | \"failed\"", description: "" },
          { name: "failureReason", type: "string | null", description: "Human-readable, present only when status is \"failed\"." },
          { name: "reference", type: "string | null", description: "Whatever you passed at creation." },
          { name: "counterparty", type: "object", description: "{ phone } for a collect." },
        ]}
      />
    </>
  );
}
