import React from "react";
import { Link } from "react-router-dom";
import Endpoint from "@/components/Endpoint";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Invoices() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Invoices</h1>
      <p>
        Create a real invoice, email it to a customer with a payable link, and get notified the
        moment it's paid, the same invoicing engine behind the PayChain merchant dashboard's own
        Invoices page, driven from your own system instead. Base path{" "}
        <code>https://api.paychain.co.ke/api/v1/developer</code>.
      </p>

      <h2>Create a draft invoice</h2>
      <Endpoint method="POST" path="/invoices" auth="API key" />
      <ParamsTable
        params={[
          { name: "customer.name", type: "string", required: true, description: "Who the invoice is billed to." },
          { name: "customer.email", type: "string", description: "Required before you can send it; see below." },
          { name: "customer.phone", type: "string", description: "Optional. Normalized to 0XXXXXXXXX if it looks like a Kenyan mobile number." },
          { name: "customer.address", type: "string", description: "Optional, shown on the invoice." },
          { name: "items", type: "array", required: true, description: "[{ description, qty, price }, ...]. price is in the invoice's currency, per unit." },
          { name: "currency", type: "string", description: "Defaults to \"KES\"." },
          { name: "issueDate", type: "string", description: "ISO date. Defaults to now." },
          { name: "dueDate", type: "string", description: "ISO date. Optional." },
          { name: "notes", type: "string", description: "Shown on the invoice, below the line items." },
        ]}
      />

      <CodeGroup
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/invoices \\
  -H "Authorization: Bearer pc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": { "name": "Amani Traders Ltd", "email": "accounts@amani.co.ke", "phone": "0712345678" },
    "items": [
      { "description": "Consulting (August)", "qty": 1, "price": 45000 },
      { "description": "Onboarding support", "qty": 2, "price": 5000 }
    ],
    "dueDate": "2026-09-15"
  }'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/invoices', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_live_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer: { name: 'Amani Traders Ltd', email: 'accounts@amani.co.ke', phone: '0712345678' },
    items: [
      { description: 'Consulting (August)', qty: 1, price: 45000 },
      { description: 'Onboarding support', qty: 2, price: 5000 },
    ],
    dueDate: '2026-09-15',
  }),
});

const { invoice } = await res.json();`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/invoices',
    headers={'Authorization': 'Bearer pc_live_...'},
    json={
        'customer': {'name': 'Amani Traders Ltd', 'email': 'accounts@amani.co.ke', 'phone': '0712345678'},
        'items': [
            {'description': 'Consulting (August)', 'qty': 1, 'price': 45000},
            {'description': 'Onboarding support', 'qty': 2, 'price': 5000},
        ],
        'dueDate': '2026-09-15',
    },
)

invoice = res.json()['invoice']`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_live_...',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'customer' => ['name' => 'Amani Traders Ltd', 'email' => 'accounts@amani.co.ke', 'phone' => '0712345678'],
        'items' => [
            ['description' => 'Consulting (August)', 'qty' => 1, 'price' => 45000],
            ['description' => 'Onboarding support', 'qty' => 2, 'price' => 5000],
        ],
        'dueDate' => '2026-09-15',
    ]),
]);

$invoice = json_decode(curl_exec($ch), true)['invoice'];`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/invoices')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_live_...',
  'Content-Type' => 'application/json',
})
req.body = {
  customer: { name: 'Amani Traders Ltd', email: 'accounts@amani.co.ke', phone: '0712345678' },
  items: [
    { description: 'Consulting (August)', qty: 1, price: 45000 },
    { description: 'Onboarding support', qty: 2, price: 5000 },
  ],
  dueDate: '2026-09-15',
}.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
invoice = JSON.parse(res.body)['invoice']`,
          },
        ]}
        className="mb-4"
      />
      <CodeBlock
        lang="json"
        label="Response · 201"
        code={`{
  "success": true,
  "invoice": {
    "_id": "66c1f2a3b4c5d6e7f8091a2b",
    "invoiceNumber": "INV-000482",
    "status": "draft",
    "customer": { "name": "Amani Traders Ltd", "email": "accounts@amani.co.ke", "phone": "0712345678", "address": null },
    "items": [
      { "description": "Consulting (August)", "qty": 1, "price": 45000 },
      { "description": "Onboarding support", "qty": 2, "price": 5000 }
    ],
    "currency": "KES",
    "subtotal": 55000,
    "total": 55000,
    "issueDate": "2026-08-20T09:00:00.000Z",
    "dueDate": "2026-09-15T00:00:00.000Z",
    "sentAt": null,
    "paidAt": null,
    "payUrl": null,
    "paymentLinkStatus": null,
    "qrCodeDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}`}
      />
      <p>
        A draft isn't visible to the customer yet: <code>payUrl</code> is <code>null</code> and{" "}
        <code>qrCodeDataUri</code> encodes a placeholder view link until it's sent. Edit line
        items freely at this stage; there's no update endpoint on the API yet, so get the draft
        right before sending, or delete and recreate it from the dashboard if needed.
      </p>

      <h2>Send it</h2>
      <p>Emails the invoice to <code>customer.email</code> with a real, payable link, and mints the link if one doesn't already exist.</p>
      <Endpoint method="POST" path="/invoices/:id/send" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl -X POST https://api.paychain.co.ke/api/v1/developer/invoices/66c1f2a3b4c5d6e7f8091a2b/send \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <CodeBlock
        lang="json"
        label="Response · 200"
        code={`{
  "success": true,
  "invoice": {
    "_id": "66c1f2a3b4c5d6e7f8091a2b",
    "invoiceNumber": "INV-000482",
    "status": "sent",
    "sentAt": "2026-08-20T09:04:11.000Z",
    "payUrl": "https://app.paychain.co.ke/pay/8f3a1c2b",
    "paymentLinkStatus": "active",
    "qrCodeDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}`}
      />
      <Callout variant="warning" title="Requires customer.email and at least one described line item">
        Set <code>customer.email</code> when creating the invoice (or before sending), and make
        sure every line item has a non-empty <code>description</code>. Both come back as a{" "}
        <code>400</code> otherwise, before anything is emailed.
      </Callout>
      <p>
        Fires an <code>invoice.sent</code> webhook immediately, and later,{" "}
        <em>only</em> once the customer actually pays via <code>payUrl</code> or scans{" "}
        <code>qrCodeDataUri</code>, an <code>invoice.paid</code> webhook. See{" "}
        <Link to="/webhooks">Webhooks</Link>.
      </p>

      <h2>Check an invoice's status</h2>
      <Endpoint method="GET" path="/invoices/:id" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/invoices/66c1f2a3b4c5d6e7f8091a2b \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>Returns the same invoice object shown above with whatever <code>status</code> currently applies: <code>draft</code>, <code>sent</code>, or <code>paid</code>.</p>

      <h2>List your invoices</h2>
      <Endpoint method="GET" path="/invoices" auth="API key" />
      <CodeBlock
        lang="bash"
        label="Request"
        code={`curl https://api.paychain.co.ke/api/v1/developer/invoices \\
  -H "Authorization: Bearer pc_live_..."`}
      />
      <p>
        Returns up to your 100 most recent invoices, newest first: every invoice created via any
        of your API keys, both test and live. Only invoices created through this API appear here;
        ones created directly from the PayChain merchant dashboard don't (view those in the
        dashboard's own Invoices page instead).
      </p>

      <h2>The invoice object</h2>
      <ParamsTable
        params={[
          { name: "_id", type: "string", description: "This invoice's unique ID." },
          { name: "invoiceNumber", type: "string", description: "Globally unique, sequential (INV-000482)." },
          { name: "status", type: "\"draft\" | \"sent\" | \"paid\"", description: "" },
          { name: "customer", type: "object", description: "{ name, email, phone, address }." },
          { name: "items", type: "array", description: "[{ description, qty, price }, ...]." },
          { name: "subtotal / total", type: "number", description: "Sum of qty × price across all items. Equal today; there's no tax/discount layer yet." },
          { name: "payUrl", type: "string | null", description: "The real, payable link. null until sent." },
          { name: "qrCodeDataUri", type: "string", description: "A scannable PNG (data URI) encoding payUrl once sent, or a placeholder view link before that." },
          { name: "sentAt / paidAt", type: "string | null", description: "ISO timestamps, null until each happens." },
        ]}
      />
    </>
  );
}
