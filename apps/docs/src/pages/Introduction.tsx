import React from "react";
import { Link } from "react-router-dom";
import { QrCode, Banknote, Receipt, Users2, Webhook, ArrowRight, Radio, CheckCircle2 } from "lucide-react";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";
import { useDeveloperAuth } from "@/context/DeveloperAuthContext";

const CARDS = [
  { icon: QrCode, title: "Payment collection", desc: "STK push, hosted checkout, payment links, and dynamic QR codes.", to: "/payment-collection" },
  { icon: Banknote, title: "Send money", desc: "Pay out to mobile wallets, Paybills, Tills, and banks.", to: "/send-money" },
  { icon: Receipt, title: "Invoices", desc: "Create, send, and track real, payable invoices.", to: "/invoices" },
  { icon: Users2, title: "Bulk payments", desc: "Payroll, contractor, and vendor payments in one batch.", to: "/bulk-payments" },
  { icon: Webhook, title: "Webhooks", desc: "Get notified the instant anything above resolves.", to: "/webhooks" },
];

const TRUST_STRIP = [
  "One secret key",
  "Plain REST, no SDK required",
  "Free sandbox, no approval needed",
];

export default function Introduction() {
  const { developer } = useDeveloperAuth();

  return (
    <>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 mb-5">
        <Radio className="w-3 h-3 text-brand-bright" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-brand-bright">Developer API</span>
      </div>

      <h1 className="text-3xl md:text-[2.5rem] font-extrabold text-ink tracking-tight leading-[1.1] mb-4">
        Build on PayChain.
      </h1>
      <p className="text-lg text-ink-muted leading-8 mb-5 max-w-[38rem]">
        Collect payments by STK push, pay out to a bank, and know the instant either happens.
        This is the whole thing: one request, one key:
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-5">
        {TRUST_STRIP.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-bright" />
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-7">
        <Link
          to={developer ? "/dashboard/api-keys" : "/signup"}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-semibold hover:bg-brand-dim transition-colors"
        >
          {developer ? "Get your API keys" : "Create your free sandbox account"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <p className="text-[13px] text-ink-muted mb-7">
        Not writing code? See the{" "}
        <Link to="/no-code-integration" className="text-brand-bright font-semibold hover:underline">
          no-code integration guide
        </Link>{" "}
        for a working payment button on your site in a few minutes, no account here needed.
      </p>

      <CodeGroup
        className="mb-3"
        tabs={[
          {
            id: "curl", label: "cURL", lang: "bash", code: `
curl -X POST https://api.paychain.co.ke/api/v1/developer/payments/collect \\
  -H "Authorization: Bearer pc_test_51a2..." \\
  -H "Idempotency-Key: order-4821" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 500, "phone": "0712345678", "reference": "order-4821"}'`,
          },
          {
            id: "node", label: "Node.js", lang: "js", code: `
const res = await fetch('https://api.paychain.co.ke/api/v1/developer/payments/collect', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pc_test_51a2...',
    'Idempotency-Key': 'order-4821',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ amount: 500, phone: '0712345678', reference: 'order-4821' }),
});

const { payment } = await res.json();`,
          },
          {
            id: "python", label: "Python", lang: "python", code: `
import requests

res = requests.post(
    'https://api.paychain.co.ke/api/v1/developer/payments/collect',
    headers={
        'Authorization': 'Bearer pc_test_51a2...',
        'Idempotency-Key': 'order-4821',
    },
    json={'amount': 500, 'phone': '0712345678', 'reference': 'order-4821'},
)

payment = res.json()['payment']`,
          },
          {
            id: "php", label: "PHP", lang: "php", code: `
$ch = curl_init('https://api.paychain.co.ke/api/v1/developer/payments/collect');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer pc_test_51a2...',
        'Idempotency-Key: order-4821',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 500,
        'phone' => '0712345678',
        'reference' => 'order-4821',
    ]),
]);

$payment = json_decode(curl_exec($ch), true)['payment'];`,
          },
          {
            id: "ruby", label: "Ruby", lang: "ruby", code: `
require 'net/http'
require 'json'

uri = URI('https://api.paychain.co.ke/api/v1/developer/payments/collect')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => 'Bearer pc_test_51a2...',
  'Idempotency-Key' => 'order-4821',
  'Content-Type' => 'application/json',
})
req.body = { amount: 500, phone: '0712345678', reference: 'order-4821' }.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
payment = JSON.parse(res.body)['payment']`,
          },
        ]}
      />
      <p className="text-[13px] text-ink-faint mb-6">
        That's a real request shape. Drop in a test key from the section below and it runs, no
        real money involved. <Link to="/payment-collection">Full reference →</Link>
      </p>

      <Callout variant="info" title="New here? Start with the Integration Guide">
        Covers the account model (developer vs. merchant), confirms there's a free self-serve
        sandbox and exactly how to get one, and walks the full path to live traffic.{" "}
        <Link to="/integration-guide">Read it →</Link>
      </Callout>

      <div className="grid sm:grid-cols-2 gap-3 mb-12">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-brand/30 hover:bg-surface-raised transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center shrink-0 group-hover:border-brand/30">
                <Icon className="w-4 h-4 text-brand-bright" />
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink flex items-center gap-1">
                  {c.title}
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                </span>
                <span className="block text-[12.5px] text-ink-faint leading-5 mt-0.5">{c.desc}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <h2>Get your key</h2>
      <p>
        <Link to="/signup">Sign up</Link> for a free account, link the merchant you're building for, and
        create a test-mode key from your dashboard, under two minutes, no approval needed. Then
        drop the key into the example above and it runs. Prefer the API directly? The same three
        calls (register, link merchant, create key) are in the{" "}
        <Link to="/integration-guide">Integration Guide</Link>, along with the account model and
        what "sandbox" actually means here.
      </p>
      <Callout variant="tip" title="Prefer not to poll for results?">
        Register a webhook and PayChain tells you the instant a payment resolves, instead of you
        asking. Takes one call. See <Link to="/webhooks">Webhooks</Link>.
      </Callout>
    </>
  );
}
