import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import CodeGroup from "@/components/CodeGroup";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";

const COLLECT_TABS = [
  {
    id: "curl" as const, label: "cURL", lang: "bash" as const, code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/collect \\
  -H "Authorization: Bearer $PAYCHAIN_API_KEY" \\
  -H "Idempotency-Key: order-1001" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 500, "phone": "0712345678", "reference": "order-1001"}'`,
  },
  {
    id: "node" as const, label: "Node.js", lang: "js" as const, code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/payments/collect', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.PAYCHAIN_API_KEY}\`,
    'Idempotency-Key': 'order-1001',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ amount: 500, phone: '0712345678', reference: 'order-1001' }),
});
const { payment } = await res.json();
console.log(payment.id, payment.status); // "pending" for now`,
  },
  {
    id: "python" as const, label: "Python", lang: "python" as const, code: `
import os, requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/payments/collect',
    headers={
        'Authorization': f"Bearer {os.environ['PAYCHAIN_API_KEY']}",
        'Idempotency-Key': 'order-1001',
    },
    json={'amount': 500, 'phone': '0712345678', 'reference': 'order-1001'},
)
payment = res.json()['payment']
print(payment['id'], payment['status'])  # "pending" for now`,
  },
  {
    id: "php" as const, label: "PHP", lang: "php" as const, code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/payments/collect');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . getenv('PAYCHAIN_API_KEY'),
        'Idempotency-Key: order-1001',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['amount' => 500, 'phone' => '0712345678', 'reference' => 'order-1001']),
]);
$payment = json_decode(curl_exec($ch), true)['payment'];
echo $payment['id'] . ' ' . $payment['status']; // "pending" for now`,
  },
];

const VERIFY = `import crypto from 'node:crypto';
import express from 'express';

const app = express();

// Sign the RAW body, exactly as received. Parsing it first changes the bytes.
app.post('/webhooks/paychain', express.raw({ type: 'application/json' }), (req, res) => {
  const expected = crypto.createHmac('sha256', process.env.PAYCHAIN_WEBHOOK_SECRET).update(req.body).digest('hex');
  const sent = String(req.headers['x-paychain-signature'] || '');
  const valid = sent.length === expected.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!valid) return res.status(401).end();

  res.status(200).end(); // acknowledge first, then do the work
  const event = JSON.parse(req.body);
  if (event.event === 'payment.collect.succeeded') {
    console.log('Paid:', event.data.payment.reference); // fulfil the order here
  }
});

app.listen(3000);`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mt-10">
      <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 text-brand-bright text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div className="min-w-0 flex-1">
        <h2 className="!mt-0 !mb-2">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function Quickstart() {
  const { developer } = useDeveloperAuth();
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Quickstart</h1>
      <p>
        Take your first payment in about five minutes. You will use the <strong>sandbox</strong>: a full
        practice mode with test keys, no real money, and no merchant account needed.
      </p>

      <Step n={1} title="Create a developer account">
        <p>
          {developer ? "You are signed in. " : <><Link to="/signup">Sign up</Link> with your email, then enter the 6-digit code we send you. </>}
          Sandbox access is instant and free.
        </p>
      </Step>

      <Step n={2} title="Create a test key">
        <p>
          Open <Link to="/dashboard/api-keys">API keys</Link>, choose <strong>Test</strong>, and create a key.
          It starts with <code>pc_test_</code> and is shown <strong>once</strong>, so copy it now. Keep it on your
          server only, never in a web page or a mobile app.
        </p>
        <CodeBlock lang="bash" code={`export PAYCHAIN_API_KEY=pc_test_...`} />
      </Step>

      <Step n={3} title="Collect a payment">
        <p>
          This asks the customer's phone for KES 500. In the sandbox no real prompt is sent; the payment simply
          moves from <code>pending</code> to <code>success</code> after a few seconds.
        </p>
        <CodeGroup tabs={COLLECT_TABS} />
        <Callout variant="tip" title="Why the Idempotency-Key?">
          Retry the same request and you get the same payment back, never a second charge. Use one key per order.
        </Callout>
      </Step>

      <Step n={4} title="See it">
        <p>
          Open <Link to="/dashboard/transactions">Transactions</Link> in the portal. Your payment is there with its
          status. To read it from code, call <code>GET /api/v1/developer/payments/&lt;id&gt;</code> with the same key.
        </p>
      </Step>

      <Step n={5} title="Get told when it's paid">
        <p>
          Do not keep asking "is it paid yet". Register a <Link to="/dashboard/webhooks">webhook</Link> and PayChain
          calls your server the moment a payment succeeds or fails. Each call is signed, so check the signature
          before you trust it:
        </p>
        <CodeBlock lang="js" label="Node.js (Express)" code={VERIFY} />
        <p className="text-[13.5px] text-ink-muted leading-6">
          Your server needs a public https address. While building, use a tunnel such as ngrok. The portal's{" "}
          <em>Send test event</em> button checks it works, and the <Link to="/webhooks">Webhooks guide</Link> lists every event.
        </p>
      </Step>

      <Step n={6} title="Go live">
        <p>
          When the sandbox flow works: <Link to="/dashboard/merchant">link the real merchant account</Link> your
          customers pay into, <Link to="/dashboard/live-access">request live access</Link> (we approve each merchant),
          create a <code>pc_live_</code> key, and swap it in. Nothing else in your code changes.
        </p>
        <p className="text-[13.5px] text-ink-muted leading-6">
          Live payments move real money, so make your first one small, from your own phone.
        </p>
      </Step>

      <h2>Check everything with one command</h2>
      <p>
        The smoke test runs the whole flow against your key (auth, collect, retry safety, validation, hosted
        checkout) and prints a pass or fail for each. It needs Node 18 and nothing else.
      </p>
      <a
        href="/downloads/paychain-smoke-test.mjs"
        download
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface text-ink text-[13.5px] font-semibold hover:bg-surface-raised transition-colors no-underline mb-3"
      >
        <Download className="w-4 h-4" />
        Download paychain-smoke-test.mjs
      </a>
      <CodeBlock lang="bash" code={`node paychain-smoke-test.mjs run --phone=0712345678`} />

      <h2>Where next</h2>
      <ul>
        <li><Link to="/integrations">Where to integrate PayChain</Link>: shops, ticketing, ISPs, apps, marketplaces.</li>
        <li><Link to="/woocommerce">WooCommerce</Link> and <Link to="/shopify">Shopify</Link>: take payments with no custom code.</li>
        <li><Link to="/openapi">OpenAPI and Postman</Link>: import the whole API and try each call.</li>
        <li><Link to="/errors">Errors and idempotency</Link>: the error format and how to retry safely.</li>
      </ul>
    </>
  );
}
