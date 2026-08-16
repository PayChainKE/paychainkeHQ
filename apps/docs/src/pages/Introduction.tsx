import React from "react";
import { Link } from "react-router-dom";
import { KeyRound, Webhook, Banknote, ArrowRight, Radio, Users, CheckCircle2 } from "lucide-react";
import CodeBlock from "@/components/CodeBlock";
import CodeGroup from "@/components/CodeGroup";
import Callout from "@/components/Callout";

const CARDS = [
  { icon: KeyRound, title: "Authentication", desc: "Test and live API keys, and how to send them.", to: "/authentication" },
  { icon: Banknote, title: "Payments", desc: "Collect via STK push, pay out, check status.", to: "/payments" },
  { icon: Webhook, title: "Webhooks", desc: "Get notified the instant a payment resolves.", to: "/webhooks" },
  { icon: Users, title: "Integration guides", desc: "ISP reconnection & CRM sync, end to end.", to: "/guides" },
];

const TRUST_STRIP = [
  "One secret key",
  "Plain REST — no SDK required",
  "Free sandbox, no approval needed",
];

export default function Introduction() {
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
        This is the whole thing — one request, one key:
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-7">
        {TRUST_STRIP.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-bright" />
            {t}
          </span>
        ))}
      </div>

      <CodeGroup
        className="shadow-glow mb-3"
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
        ]}
      />
      <p className="text-[13px] text-ink-faint mb-6">
        That's a real request shape — drop in a test key from step 3 below and it runs, no
        real money involved. <Link to="/payments">Full reference →</Link>
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
      <p>Four steps, under five minutes, entirely in test mode — nothing below needs live access or moves real money.</p>

      <h3>1. Create a developer account</h3>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/auth/developer/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Asha Wanjiru","email":"asha@example.com","companyName":"BrightNet ISP","password":"..."}'`}
      />
      <p>Check your email for a 6-digit code and verify it:</p>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/auth/developer/verify-otp \\
  -H "Content-Type: application/json" \\
  -d '{"email":"asha@example.com","otp":"482910"}'`}
      />

      <h3>2. Link a merchant account</h3>
      <p>
        Every key acts on behalf of one PayChain merchant. This one-time step proves you control
        it — the merchant's own password, then an OTP sent to <em>their</em> inbox, not yours.
      </p>
      <CodeBlock
        lang="bash"
        label="curl · with your developer JWT"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/link-merchant/start \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"merchantEmail":"shop@example.com","merchantPassword":"..."}'`}
      />

      <h3>3. Create a test-mode key</h3>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/api-keys \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"test","label":"local dev"}'`}
      />
      <Callout variant="tip" title="Save the key now — this is the one from the example up top">
        The raw key is only ever shown in this response — PayChain stores just its hash after that.
      </Callout>

      <h3>4. Run the call from the top of this page</h3>
      <p>Drop your new <code>pc_test_...</code> key into the example at the top and run it — that's a real, working request.</p>

      <h2>Then hear about it</h2>
      <p>One more call and you stop needing to ask — PayChain tells you instead:</p>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/webhooks \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/webhooks/paychain","events":["*"]}'`}
      />
      <p>
        Full shape and signature verification on the <Link to="/webhooks">Webhooks</Link> page.
        When you're ready for real money, see <Link to="/authentication">Authentication</Link> for
        how live access works.
      </p>
    </>
  );
}
