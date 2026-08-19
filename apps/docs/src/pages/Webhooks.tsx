import React from "react";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Webhooks() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Webhooks</h1>
      <p>
        Polling <code>GET /payments/:id</code> works, but most integrations shouldn't have to ask.
        They should be told. Register an HTTPS endpoint and PayChain pushes an event to it the
        moment a collection or payout resolves. This is what an ISP's auto-reconnection flow or a
        CRM sync should build on, not a polling loop.
      </p>

      <h2>Event types</h2>
      <ParamsTable
        params={[
          { name: "payment.collect.succeeded", type: "event", description: "An STK push, checkout session, payment link, or QR-code collection cleared." },
          { name: "payment.collect.failed", type: "event", description: "The customer cancelled, the prompt timed out, or the collection otherwise failed." },
          { name: "payment.payout.succeeded", type: "event", description: "A Send Money payout, or one row of a bulk payment batch, was sent successfully." },
          { name: "payment.payout.failed", type: "event", description: "A payout (or one bulk-payment row) failed: insufficient funds, an invalid account, etc." },
          { name: "bulk_payment.completed", type: "event", description: "Every row in a POST /bulk-payments batch has resolved — fires once per batch with the final succeeded/pending/failed tally. See Bulk Payments." },
          { name: "invoice.sent", type: "event", description: "An invoice created via POST /invoices was emailed to its customer. See Invoices." },
          { name: "invoice.paid", type: "event", description: "A customer paid an API-created invoice via its payment link or QR code." },
        ]}
      />

      <h2>Managing webhooks</h2>
      <p>These routes use your developer JWT, not an API key. Same auth as account management.</p>

      <Endpoint method="POST" path="/api/developer/webhooks" auth="Developer JWT" />
      <ParamsTable
        params={[
          { name: "url", type: "string", required: true, description: "Must be https://. This is where events get POSTed." },
          { name: "events", type: "string[]", description: "Which event types to receive: any subset of the list above, or [\"*\"] for everything. Defaults to [\"*\"]." },
        ]}
      />
      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/developer/webhooks \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/webhooks/paychain","events":["*"]}'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/developer/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <developer-jwt>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-server.com/webhooks/paychain',
    events: ['*'],
  }),
});

const { webhook } = await res.json();
console.log(webhook.secret); // whsec_..., shown once, store it now`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/developer/webhooks',
    headers={'Authorization': 'Bearer <developer-jwt>'},
    json={
        'url': 'https://your-server.com/webhooks/paychain',
        'events': ['*'],
    },
)

webhook = res.json()['webhook']
print(webhook['secret'])  # whsec_..., shown once, store it now`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/developer/webhooks');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer <developer-jwt>',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'url' => 'https://your-server.com/webhooks/paychain',
        'events' => ['*'],
    ]),
]);

$webhook = json_decode(curl_exec($ch), true)['webhook'];
echo $webhook['secret']; // whsec_..., shown once, store it now`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/developer/webhooks')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer <developer-jwt>',
  'Content-Type' => 'application/json',
})
req.body = { url: 'https://your-server.com/webhooks/paychain', events: ['*'] }.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
webhook = JSON.parse(res.body)['webhook']
puts webhook['secret'] # whsec_..., shown once, store it now`,
          },
        ]}
        className="mb-4"
      />
      <CodeBlock
        lang="json"
        label="Response · 201"
        code={`{
  "success": true,
  "webhook": {
    "_id": "65f...",
    "url": "https://your-server.com/webhooks/paychain",
    "events": ["*"],
    "status": "active",
    "secret": "whsec_9c4b7a1e...",
    "createdAt": "2026-08-16T09:00:00.000Z"
  }
}`}
      />
      <Callout variant="warning" title="The secret is shown once">
        PayChain keeps it server-side to sign every delivery to this endpoint, but never displays
        it again after this response. Store it now.
      </Callout>

      <div className="grid sm:grid-cols-2 gap-3 my-6">
        {[
          ["GET", "/api/developer/webhooks", "List your endpoints"],
          ["PATCH", "/api/developer/webhooks/:id", "Update url, events, or active/disabled status"],
          ["DELETE", "/api/developer/webhooks/:id", "Remove an endpoint"],
          ["POST", "/api/developer/webhooks/:id/test", "Send a one-off test event"],
          ["GET", "/api/developer/webhooks/:id/deliveries", "Recent delivery attempts, for debugging"],
        ].map(([method, path, desc]) => (
          <div key={`${method} ${path}`} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold text-ink-faint">{method}</span>
              <code className="text-[12px] text-ink font-mono">{path}</code>
            </div>
            <span className="block text-[12px] text-ink-faint">{desc}</span>
          </div>
        ))}
      </div>

      <h2>What a delivery looks like</h2>
      <CodeBlock
        lang="bash"
        label="Headers"
        code={`POST https://your-server.com/webhooks/paychain
Content-Type: application/json
X-PayChain-Event: payment.collect.succeeded
X-PayChain-Delivery-Id: 8f0c1a3e-...
X-PayChain-Signature: 4e8a1c...  # hex HMAC-SHA256 of the raw body`}
      />
      <CodeBlock
        lang="json"
        label="Body"
        code={`{
  "id": "b6e1d2a4-...",
  "event": "payment.collect.succeeded",
  "createdAt": "2026-08-16T09:00:12.000Z",
  "data": {
    "payment": {
      "id": "65f3a1e2c9d4e1a2b3c4d5e6",
      "mode": "live",
      "kind": "collect",
      "amount": 500,
      "currency": "KES",
      "status": "success",
      "reference": "subscriber-4821",
      "counterparty": { "phone": "254712345678" },
      "createdAt": "2026-08-16T09:00:00.000Z",
      "updatedAt": "2026-08-16T09:00:12.000Z"
    }
  }
}`}
      />

      <h2>Verify the signature</h2>
      <p>
        Do this before acting on a delivery: before an ISP's system lifts a suspension, before
        a CRM marks a deal closed. It's a plain HMAC-SHA256 of the raw request body, using the
        secret from when you registered the endpoint.
      </p>
      <CodeGroup
        tabs={[
          {
            id: "node", label: "Node.js", lang: "js", code: `
const crypto = require('crypto');

function isValidSignature(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Express example: read the RAW body, not the parsed one, or the
// signature will never match.
app.post('/webhooks/paychain', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-paychain-signature'];
  if (!isValidSignature(req.body, signature, process.env.PAYCHAIN_WEBHOOK_SECRET)) {
    return res.status(401).end();
  }

  const event = JSON.parse(req.body);
  // ...handle event.event / event.data.payment
  res.status(200).end();
});`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import hmac
import hashlib

def is_valid_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)

# Flask example: use request.get_data() for the RAW body, not
# request.json, or the signature will never match.
@app.route('/webhooks/paychain', methods=['POST'])
def paychain_webhook():
    signature = request.headers.get('X-PayChain-Signature', '')
    if not is_valid_signature(request.get_data(), signature, WEBHOOK_SECRET):
        return '', 401

    event = request.get_json()
    # ...handle event['event'] / event['data']['payment']
    return '', 200`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
function isValidSignature(string $rawBody, string $signatureHeader, string $secret): bool {
    $expected = hash_hmac('sha256', $rawBody, $secret);
    return hash_equals($expected, $signatureHeader);
}

// Read the RAW request body, not $_POST, or the signature will never match.
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PAYCHAIN_SIGNATURE'] ?? '';

if (!isValidSignature($rawBody, $signature, getenv('PAYCHAIN_WEBHOOK_SECRET'))) {
    http_response_code(401);
    exit;
}

$event = json_decode($rawBody, true);
// ...handle $event['event'] / $event['data']['payment']
http_response_code(200);`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'openssl'
require 'json'

def valid_signature?(raw_body, signature_header, secret)
  expected = OpenSSL::HMAC.hexdigest('sha256', secret, raw_body)
  ActiveSupport::SecurityUtils.secure_compare(expected, signature_header)
end

# Rails example: request.raw_post is the RAW body, not params, or the
# signature will never match.
post '/webhooks/paychain' do
  signature = request.headers['X-PayChain-Signature'].to_s
  unless valid_signature?(request.raw_post, signature, ENV['PAYCHAIN_WEBHOOK_SECRET'])
    halt 401
  end

  event = JSON.parse(request.raw_post)
  # ...handle event['event'] / event['data']['payment']
  status 200
end`,
          },
        ]}
      />

      <h2>Retries</h2>
      <p>
        Your endpoint should return a <code>2xx</code> quickly (under 10 seconds). Do the real
        work after responding, not before. Anything else (timeout, non-2xx, connection refused)
        gets retried on a backoff:
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {["1 min", "5 min", "30 min", "2 hr", "6 hr"].map((t, i) => (
          <React.Fragment key={t}>
            <span className="px-2.5 py-1 rounded-md bg-surface border border-border text-[12px] font-mono text-ink-muted">{t}</span>
            {i < 4 && <span className="text-ink-faint self-center">→</span>}
          </React.Fragment>
        ))}
        <span className="text-ink-faint self-center">→ exhausted</span>
      </div>
      <p>
        After the last retry, the delivery is marked <code>exhausted</code> and stops. Check{" "}
        <code>GET /api/developer/webhooks/:id/deliveries</code> if events seem to be going missing.
        It shows the HTTP status and error for every attempt.
      </p>
    </>
  );
}
