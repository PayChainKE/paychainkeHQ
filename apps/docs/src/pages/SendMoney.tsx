import React from "react";
import { Link } from "react-router-dom";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function SendMoney() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Send Money</h1>
      <p>
        Pay out from your linked merchant's wallet to a bank account, an M-Pesa/Airtel Money
        number, a Paybill, or a Till (Buy Goods): the same rails the merchant dashboard's own
        "Send Money" already uses. Base path{" "}
        <code>https://api.paychain.co.ke/api/v1/developer</code>.
      </p>

      <Callout variant="tip" title="Paying more than one destination at once?">
        Use <Link to="/bulk-payments">Bulk Payments</Link> instead: payroll, contractors, or
        vendors, all in a single call, with a single PIN entry and a per-row result.
      </Callout>

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
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/payments/payout');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_live_...',
        'Idempotency-Key: 2b6f0d1a-...-9e3c',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 12000,
        'bankCode' => '011',
        'accountNumber' => '0123456789',
        'accountName' => 'Jane Njeri',
        'narration' => 'Supplier settlement',
        'apiPayoutPin' => '4821',
    ]),
]);

$payment = json_decode(curl_exec($ch), true)['payment'];`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/payments/payout')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_live_...',
  'Idempotency-Key' => '2b6f0d1a-...-9e3c',
  'Content-Type' => 'application/json',
})
req.body = {
  amount: 12000,
  bankCode: '011',
  accountNumber: '0123456789',
  accountName: 'Jane Njeri',
  narration: 'Supplier settlement',
  apiPayoutPin: '4821',
}.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
payment = JSON.parse(res.body)['payment']`,
          },
        ]}
      />

      <Callout variant="info" title="Bank payouts resolve synchronously: the other three don't">
        A live bank payout's outcome is known before the response is sent: you'll get back{" "}
        <code>status: "success"</code> or a <code>402</code> with the failure reason immediately.
        Mobile money, Paybill, and Till only confirm PayChain <em>submitted</em> the payout in that
        same response (<code>status: "pending"</code>). The actual outcome lands slightly later.
        Subscribe a <Link to="/webhooks">webhook</Link> rather than assuming a 201 means the money
        arrived.
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

      <h2>Check a payout's status</h2>
      <Endpoint method="GET" path="/payments/:id" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/payments/65f3a1e2c9d4e1a2b3c4d5e6 \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns the same payment object shape as a collect, with whatever <code>status</code> currently applies.</p>

      <h2>The payment object</h2>
      <ParamsTable
        params={[
          { name: "id", type: "string", description: "This payment's unique ID." },
          { name: "mode", type: "\"test\" | \"live\"", description: "Which key created it." },
          { name: "kind", type: "\"payout\"", description: "" },
          { name: "amount", type: "number", description: "In KES." },
          { name: "status", type: "\"pending\" | \"success\" | \"failed\"", description: "" },
          { name: "failureReason", type: "string | null", description: "Human-readable, present only when status is \"failed\"." },
          { name: "counterparty", type: "object", description: "{ bankCode, accountNumber, accountName }, { phone, network }, { paybillNumber, accountReference }, or { tillNumber }, matching whichever destination you sent." },
        ]}
      />
    </>
  );
}
