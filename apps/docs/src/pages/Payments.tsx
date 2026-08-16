import React from "react";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Payments() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Payments</h1>
      <p>
        Three endpoints: trigger a collection, send a payout, and check on either. Base path{" "}
        <code>https://api.paychain.co.ke/api/v1/developer</code>.
      </p>

      <Callout variant="tip" title="Idempotency-Key is required on every write">
        Generate one unique value per logical attempt (a UUID is fine) and send it as the{" "}
        <code>Idempotency-Key</code> header. Retry with the <em>same</em> key after a timeout or
        network error and you'll get the original payment back (<code>replayed: true</code>)
        instead of a duplicate charge.
      </Callout>

      <h2>Collect a payment</h2>
      <p>Sends an STK push to a customer's phone. Money lands in your linked merchant's wallet.</p>
      <Endpoint method="POST" path="/payments/collect" auth="API key" />

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
        <a href="/webhooks">webhook</a> instead.
      </p>

      <h2>Pay out</h2>
      <p>
        Sends money from your linked merchant's wallet to a bank account, an M-Pesa/Airtel Money
        number, a Paybill, or a Till (Buy Goods): the same rails the merchant dashboard's own
        "Send Money" already uses.
      </p>
      <Endpoint method="POST" path="/payments/payout" auth="API key" />

      <ParamsTable
        params={[
          { name: "amount", type: "number", required: true, description: "Amount in KES." },
          { name: "narration", type: "string", description: "Shown on the receiving statement. Defaults to \"Developer API payout\"." },
          { name: "apiPayoutPin", type: "string", required: true, description: "Required in live mode only. The merchant sets this (and enables API payouts at all) from their PayChain dashboard, along with per-transaction and daily caps." },
        ]}
      />

      <p>Plus exactly one destination, chosen by which of these fields you send:</p>
      <ParamsTable
        params={[
          { name: "bankCode + accountNumber", type: "bank", description: "Bank transfer. accountName is optional, for your own records." },
          { name: "phone", type: "mobile money", description: "M-Pesa or Airtel Money number. Optional mobileNetwork: \"safaricom\" (default) or \"airtel\"." },
          { name: "paybillNumber + accountReference", type: "paybill", description: "accountReference is the account number/reference the biller expects. Required for a Paybill." },
          { name: "tillNumber", type: "till", description: "Buy Goods till number. No account reference needed." },
        ]}
      />
      <Callout variant="warning" title="Sending more than one destination is a 400, not a guess">
        Sending, say, both <code>phone</code> and <code>tillNumber</code> on the same request
        fails validation rather than silently picking one. Almost always a sign of a bug on the
        caller's side worth surfacing, not resolving quietly.
      </Callout>

      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/payout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 2b6f0d1a-...-9e3c" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 12000,
    "bankCode": "011",
    "accountNumber": "0123456789",
    "accountName": "Jane Njeri",
    "narration": "Supplier settlement",
    "apiPayoutPin": "4821"
  }'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/payments/payout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_live_...',
    'Idempotency-Key': '2b6f0d1a-...-9e3c',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 12000,
    bankCode: '011',
    accountNumber: '0123456789',
    accountName: 'Jane Njeri',
    narration: 'Supplier settlement',
    apiPayoutPin: '4821',
  }),
});

const { payment } = await res.json();`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/payments/payout',
    headers={
        'Authorization': 'Bearer pc_live_...',
        'Idempotency-Key': '2b6f0d1a-...-9e3c',
    },
    json={
        'amount': 12000,
        'bankCode': '011',
        'accountNumber': '0123456789',
        'accountName': 'Jane Njeri',
        'narration': 'Supplier settlement',
        'apiPayoutPin': '4821',
    },
)

payment = res.json()['payment']`,
          },
        ]}
      />

      <Callout variant="info" title="Bank payouts resolve synchronously: the other three don't">
        A live bank payout's outcome is known before the response is sent: you'll get back{" "}
        <code>status: "success"</code> or a <code>402</code> with the failure reason immediately.
        Mobile money, Paybill, and Till only confirm PayChain <em>submitted</em> the payout in that
        same response (<code>status: "pending"</code>). The actual outcome lands slightly later,
        the same asynchronous way a collect does. Subscribe a{" "}
        <a href="/webhooks">webhook</a> rather than assuming a 201 means the money arrived.
      </Callout>

      <h3>Other destinations</h3>
      <p className="text-[13.5px] text-ink-muted leading-6 mb-3">
        Same endpoint, same headers as above. Only the body's destination fields change.
      </p>
      <CodeBlock
        lang="bash"
        label="Mobile money"
        className="mb-3"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/payout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 7c2a91fe-...-1a05" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 3000,
    "phone": "0712345678",
    "mobileNetwork": "safaricom",
    "narration": "Referral payout"
  }'`}
      />
      <CodeBlock
        lang="bash"
        label="Paybill"
        className="mb-3"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/payout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 9d1e04ab-...-77c2" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 8500,
    "paybillNumber": "888999",
    "accountReference": "INV-4821",
    "narration": "Supplier invoice"
  }'`}
      />
      <CodeBlock
        lang="bash"
        label="Till"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/payout \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 4f6b3c2d-...-e910" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1200,
    "tillNumber": "654321",
    "narration": "Vendor settlement"
  }'`}
      />
      <p className="mt-4">
        Same response shape as a bank payout either way. <code>counterparty</code> reflects
        whichever destination you sent: <code>{`{ phone, network }`}</code>,{" "}
        <code>{`{ paybillNumber, accountReference }`}</code>, or <code>{`{ tillNumber }`}</code>.
      </p>

      <h2>Check a payment's status</h2>
      <Endpoint method="GET" path="/payments/:id" auth="API key" />
      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl https://api.paychain.co.ke/api/v1/developer/payments/65f3a1e2c9d4e1a2b3c4d5e6 \\
  -H "Authorization: Bearer pc_live_..."`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/payments/65f3a1e2c9d4e1a2b3c4d5e6', {
  headers: { 'Authorization': 'Bearer pc_live_...' },
});

const { payment } = await res.json();`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.get(
    'https://api.paychain.co.ke/api/v1/developer/payments/65f3a1e2c9d4e1a2b3c4d5e6',
    headers={'Authorization': 'Bearer pc_live_...'},
)

payment = res.json()['payment']`,
          },
        ]}
      />
      <p>Returns the same payment object shape shown above, with whatever <code>status</code> currently applies. This is a safe fallback to poll, but a webhook subscription is the faster, cheaper way to find out.</p>

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
          { name: "counterparty", type: "object", description: "{ phone } for a collect. For a payout: { bankCode, accountNumber, accountName }, { phone, network }, { paybillNumber, accountReference }, or { tillNumber }, matching whichever destination you sent." },
        ]}
      />
    </>
  );
}
