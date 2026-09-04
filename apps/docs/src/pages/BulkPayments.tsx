import React from "react";
import { Link } from "react-router-dom";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function BulkPayments() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Bulk Payments</h1>
      <p>
        Pay many destinations in one call: monthly payroll, a batch of contractor or vendor
        settlements, or a mix of both, to any combination of mobile wallets, Paybills, Tills, and
        bank accounts. One PIN entry, one idempotency key, one response with a per-row result.
        Base path <code>https://api.paychain.co.ke/api/v1/developer</code>.
      </p>

      <Callout variant="warning" title="Utility bill payments aren't on the API yet">
        KPLC and water-utility bulk payments are currently only available from the PayChain
        merchant dashboard's Bulk Pay page; there's no API endpoint for those specific rails yet.
        Employee, contractor, and vendor payments below are fully live.
      </Callout>

      <h2>Send a batch</h2>
      <Endpoint method="POST" path="/bulk-payments" auth="API key" />

      <Callout variant="tip" title="Idempotency-Key covers the whole batch">
        One <code>Idempotency-Key</code> header for the entire request, not per row. Retry the
        identical request after a timeout and you get the original batch's results back (
        <code>replayed: true</code>) instead of paying everyone twice.
      </Callout>

      <ParamsTable
        params={[
          { name: "payments", type: "array", required: true, description: "1 to 200 payment objects, each shaped like a single Send Money payout (see below)." },
          { name: "apiPayoutPin", type: "string", required: true, description: "Required in live mode only. Checked once for the whole batch, not per row." },
        ]}
      />

      <p>Each entry in <code>payments</code> takes the same shape as a single payout:</p>
      <ParamsTable
        params={[
          { name: "amount", type: "number", required: true, description: "For payeeType \"employee\": gross pay before deductions. For \"contract\": the exact amount paid, no deductions." },
          { name: "payeeType", type: "\"employee\" | \"contract\"", description: "Defaults to \"contract\". \"employee\" rows are automatically PAYE/NSSF/SHIF-deducted (see below) and must be paid to a phone (mobile money); no other destination type is valid for payroll." },
          { name: "narration", type: "string", description: "Shown on the receiving statement. Defaults to \"Developer API bulk payout\"." },
          { name: "bankCode + accountNumber / phone / paybillNumber + accountReference / tillNumber", type: "destination", description: "Exactly one, same rules as a single Send Money payout." },
        ]}
      />

      <Callout variant="info" title="Employee rows are real payroll: statutory deductions included">
        Send the gross salary as <code>amount</code>. PayChain computes real PAYE, NSSF, and SHIF
        (the same calculator the dashboard's own Bulk Pay CSV upload uses) and pays out the net,
        never the raw amount you sent, to the employee's phone. The breakdown comes back on each
        row as <code>grossAmount</code> and <code>taxDeductions</code>.
      </Callout>

      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/bulk-payments \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Idempotency-Key: 5e2a7c14-...-b901" \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiPayoutPin": "4821",
    "payments": [
      { "payeeType": "employee", "amount": 65000, "phone": "0712345678", "narration": "August salary (J. Njeri)" },
      { "payeeType": "employee", "amount": 48000, "phone": "0798765432", "narration": "August salary (O. Kiptoo)" },
      { "payeeType": "contract", "amount": 22000, "tillNumber": "654321", "narration": "Freelance design work" }
    ]
  }'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/bulk-payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_live_...',
    'Idempotency-Key': '5e2a7c14-...-b901',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    apiPayoutPin: '4821',
    payments: [
      { payeeType: 'employee', amount: 65000, phone: '0712345678', narration: 'August salary (J. Njeri)' },
      { payeeType: 'employee', amount: 48000, phone: '0798765432', narration: 'August salary (O. Kiptoo)' },
      { payeeType: 'contract', amount: 22000, tillNumber: '654321', narration: 'Freelance design work' },
    ],
  }),
});

const { batchId, payments } = await res.json();`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/bulk-payments',
    headers={
        'Authorization': 'Bearer pc_live_...',
        'Idempotency-Key': '5e2a7c14-...-b901',
    },
    json={
        'apiPayoutPin': '4821',
        'payments': [
            {'payeeType': 'employee', 'amount': 65000, 'phone': '0712345678', 'narration': 'August salary (J. Njeri)'},
            {'payeeType': 'employee', 'amount': 48000, 'phone': '0798765432', 'narration': 'August salary (O. Kiptoo)'},
            {'payeeType': 'contract', 'amount': 22000, 'tillNumber': '654321', 'narration': 'Freelance design work'},
        ],
    },
)

body = res.json()
batch_id, payments = body['batchId'], body['payments']`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/bulk-payments');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_live_...',
        'Idempotency-Key: 5e2a7c14-...-b901',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'apiPayoutPin' => '4821',
        'payments' => [
            ['payeeType' => 'employee', 'amount' => 65000, 'phone' => '0712345678', 'narration' => 'August salary (J. Njeri)'],
            ['payeeType' => 'employee', 'amount' => 48000, 'phone' => '0798765432', 'narration' => 'August salary (O. Kiptoo)'],
            ['payeeType' => 'contract', 'amount' => 22000, 'tillNumber' => '654321', 'narration' => 'Freelance design work'],
        ],
    ]),
]);

$body = json_decode(curl_exec($ch), true);
['batchId' => $batchId, 'payments' => $payments] = $body;`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/bulk-payments')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_live_...',
  'Idempotency-Key' => '5e2a7c14-...-b901',
  'Content-Type' => 'application/json',
})
req.body = {
  apiPayoutPin: '4821',
  payments: [
    { payeeType: 'employee', amount: 65000, phone: '0712345678', narration: 'August salary (J. Njeri)' },
    { payeeType: 'employee', amount: 48000, phone: '0798765432', narration: 'August salary (O. Kiptoo)' },
    { payeeType: 'contract', amount: 22000, tillNumber: '654321', narration: 'Freelance design work' },
  ],
}.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
body = JSON.parse(res.body)
batch_id, payments = body['batchId'], body['payments']`,
          },
        ]}
        className="mb-4"
      />

      <CodeBlock
        lang="json"
        label="Response · 201"
        code={`{
  "success": true,
  "batchId": "7f2e9a41c3b0d5e8",
  "payments": [
    {
      "id": "66c1...a01",
      "mode": "live",
      "kind": "payout",
      "amount": 55482.50,
      "status": "pending",
      "counterparty": { "phone": "254712345678", "network": "safaricom" },
      "payeeType": "employee",
      "grossAmount": 65000,
      "taxDeductions": { "paye": 8127.5, "nssf": 2160, "shif": 1787.5 }
    },
    {
      "id": "66c1...a02",
      "mode": "live",
      "kind": "payout",
      "amount": 41230.00,
      "status": "pending",
      "counterparty": { "phone": "254798765432", "network": "safaricom" },
      "payeeType": "employee",
      "grossAmount": 48000,
      "taxDeductions": { "paye": 5810, "nssf": 2160, "shif": 1320 }
    },
    {
      "id": "66c1...a03",
      "mode": "live",
      "kind": "payout",
      "amount": 22000,
      "status": "success",
      "counterparty": { "tillNumber": "654321" },
      "payeeType": "contract",
      "grossAmount": null,
      "taxDeductions": null
    }
  ]
}`}
      />
      <p>
        <code>amount</code> on an employee row is the real net figure that was actually paid, not
        what you sent. Mobile money and Paybill/Till rows start <code>pending</code> and resolve
        asynchronously (same as a single payout); Till and bank rows can resolve synchronously.
        <strong> One row failing doesn't fail the batch:</strong> check each row's own{" "}
        <code>status</code>/<code>failureReason</code> rather than assuming a <code>201</code>
        means every payment went through.
      </p>

      <Callout variant="warning" title="Caps apply to the batch's real total, not the sum of what you sent">
        The merchant's daily API payout cap is checked against the batch's total <em>net</em>{" "}
        spend (post-tax for employee rows), and the per-transaction cap against each row's net
        amount individually. A batch that would exceed either is rejected in full,{" "}
        <em>before</em> any row is paid; never a partial batch because the cap was hit halfway
        through.
      </Callout>

      <h2>Check a batch's status</h2>
      <Endpoint method="GET" path="/bulk-payments/:batchId" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/bulk-payments/7f2e9a41c3b0d5e8 \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns every row from that batch in the same shape as the creation response, each with its current <code>status</code>.</p>

      <h2>The payment object (bulk-specific fields)</h2>
      <ParamsTable
        params={[
          { name: "batchId", type: "string", description: "Groups every row from the same POST /bulk-payments call." },
          { name: "payeeType", type: "\"employee\" | \"contract\" | null", description: "null for a payment created via the single-payout endpoint instead." },
          { name: "grossAmount", type: "number | null", description: "Pre-tax figure, only present for payeeType \"employee\"." },
          { name: "taxDeductions", type: "object | null", description: "{ paye, nssf, shif }, only present for payeeType \"employee\"." },
        ]}
      />
      <p>
        See <Link to="/send-money">Send Money</Link> for every other field (<code>id</code>,{" "}
        <code>mode</code>, <code>status</code>, <code>counterparty</code>, etc.), identical
        meaning here.
      </p>

      <h2>Webhooks</h2>
      <p>
        Each row fires its own <code>payment.payout.succeeded</code> /{" "}
        <code>payment.payout.failed</code> event as it resolves, the exact same events a single
        Send Money payout fires, so nothing about your webhook handler needs to change. Once every
        row has settled, one summary <code>bulk_payment.completed</code> event fires with the
        batch's final tally. See <Link to="/webhooks">Webhooks</Link>.
      </p>
    </>
  );
}
