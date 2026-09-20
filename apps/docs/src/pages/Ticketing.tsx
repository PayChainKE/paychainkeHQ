import React from "react";
import { Link } from "react-router-dom";
import { Ticket } from "lucide-react";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";

const CREATE = `// 1. The customer chose tickets. Hold them, then ask PayChain for a payment page.
const order = await db.orders.create({ status: 'held', holdUntil: minutesFromNow(10), items });

const res = await fetch('https://api.paychain.co.ke/api/v1/developer/checkout', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.PAYCHAIN_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: order.total,                       // whole shillings
    reference: \`TKT-\${order.id}\`,             // comes back on every webhook
    description: \`\${event.name}, \${order.items.length} ticket(s)\`,
    customer: { phone: order.phone, email: order.email, name: order.name },
    callbackUrl: \`https://tickets.example.com/orders/\${order.id}\`, // https only
    expiresInMinutes: 10,                      // same as the ticket hold (5 minutes or more)
  }),
});
const { session } = await res.json();
// 2. Send the customer to session.checkoutUrl`;

const WEBHOOK = `app.post('/webhooks/paychain', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!validSignature(req.body, req.headers['x-paychain-signature'])) return res.status(401).end();
  const event = JSON.parse(req.body);
  const p = event.data?.payment;

  const m = /^TKT-(.+)$/.exec(p?.reference || '');
  if (!m || event.event !== 'payment.collect.succeeded' || p.status !== 'success') return res.status(200).end();

  const order = await db.orders.find(m[1]);
  if (!order) return res.status(200).end();

  // One payment can arrive more than once. Issue tickets only the first time.
  if (order.status === 'paid') return res.status(200).end();

  // Trust the amount PayChain reports, not the browser.
  if (p.amount < order.total) {
    await db.orders.flag(order.id, 'underpaid');
    return res.status(200).end();
  }

  await db.transaction(async () => {
    await db.orders.markPaid(order.id, { paymentId: p.id });
    await issueTickets(order);       // QR codes, then email and SMS
  });
  res.status(200).end();
});`;

const STK = `// One-tap: you already have the phone number, so skip the payment page.
await fetch('https://api.paychain.co.ke/api/v1/developer/payments/collect', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.PAYCHAIN_API_KEY}\`,
    'Idempotency-Key': \`TKT-\${order.id}-attempt-1\`,   // a retry gets the same payment back
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ amount: order.total, phone: order.phone, reference: \`TKT-\${order.id}\` }),
});`;

export default function Ticketing() {
  return (
    <>
      <div className="flex items-center gap-2.5 mb-2">
        <Ticket className="w-5 h-5 text-brand-bright" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-brand-bright">Guide</span>
      </div>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Ticketing and events</h1>
      <p>
        Sell tickets with M-PESA: reserve the seats, take the payment, and issue the tickets the moment the money
        arrives. This guide covers one event organiser and a platform that sells for many organisers.
      </p>

      <h2>The flow</h2>
      <ol className="list-decimal pl-5 space-y-1 text-[15px] leading-7 text-ink-muted mb-4">
        <li><strong>Hold the tickets</strong> for about 10 minutes, so two people cannot buy the same seat.</li>
        <li><strong>Create a payment</strong> with a reference that carries your order id, such as <code>TKT-1042</code>.</li>
        <li><strong>The customer pays</strong> by approving the M-PESA prompt on their phone.</li>
        <li><strong>PayChain calls your webhook</strong> with a signed <code>payment.collect.succeeded</code>.</li>
        <li><strong>Issue the tickets</strong> (QR code by email and SMS) from the webhook, and only there.</li>
        <li><strong>If it fails or times out</strong>, release the hold. The customer can try again on the same order.</li>
      </ol>

      <h2>1. Create the payment</h2>
      <p>
        The <Link to="/payment-collection">hosted checkout</Link> is the simplest option: PayChain shows the payment
        page and the customer enters their phone number. Set the link to expire when your hold does.
      </p>
      <CodeBlock lang="js" label="Node.js" code={CREATE} />

      <Callout variant="tip" title="Already know the phone number?">
        Send the M-PESA prompt straight to it and skip the page: a one-tap checkout.
        <div className="mt-3"><CodeBlock lang="js" label="Node.js" code={STK} /></div>
      </Callout>

      <h2>2. Issue tickets from the webhook</h2>
      <p>
        The customer's browser coming back to your site does <strong>not</strong> prove they paid. Only a signed
        webhook does. Check the signature (see the <Link to="/quickstart">Quickstart</Link>), check the amount, and make
        the handler safe to run twice.
      </p>
      <CodeBlock lang="js" label="Node.js (Express)" code={WEBHOOK} />

      <h2>Rules that keep ticketing safe</h2>
      <ul>
        <li><strong>Issue from the webhook only,</strong> after the signature and amount checks.</li>
        <li><strong>Make it idempotent.</strong> Webhooks can arrive twice, or before the customer is back on your site. Use an <code>Idempotency-Key</code> on collection calls so a double tap never charges twice.</li>
        <li><strong>Offer a "check my payment" page.</strong> If a webhook is late, read the payment with <code>GET /api/v1/developer/checkout/&lt;id&gt;</code> and show its status.</li>
        <li><strong>Keep the reference as your order id.</strong> Support can then find any payment in seconds in <Link to="/dashboard/transactions">Transactions</Link>.</li>
        <li><strong>Reconcile every night.</strong> Compare paid orders with your PayChain records, and free any hold that never got paid.</li>
        <li><strong>Scan at the gate in your own system.</strong> PayChain is not involved after the payment.</li>
      </ul>

      <h2>Selling for many organisers</h2>
      <p>Two ways to set up a platform, and you can mix them:</p>
      <ul>
        <li>
          <strong>Money goes straight to each organiser.</strong> Link every organiser's merchant account to your
          developer account and make one live key per organiser. Sales settle into that organiser's wallet.
        </li>
        <li>
          <strong>Money goes to you first.</strong> Collect everything into your own merchant, take your fee, then pay
          organisers with <Link to="/send-money">payouts</Link> or <Link to="/bulk-payments">bulk payments</Link>.
          Payouts need the merchant to switch on API payouts and set a PIN.
        </li>
      </ul>
      <p>
        <Link to="/integration-guide">Multiple merchants and per-merchant live approval</Link> are explained in the
        Integration guide.
      </p>

      <h2>Before a big on-sale</h2>
      <ul>
        <li>Each key allows 600 collections per 15 minutes by default. For a big release, <Link to="/contact">tell us the date and expected volume</Link> so the limit can be raised in advance.</li>
        <li>Test the whole flow in the sandbox first, then make one small live purchase yourself.</li>
      </ul>

      <Callout variant="warning" title="What PayChain does not do yet">
        <ul className="!mb-0">
          <li><strong>Split payments.</strong> One payment cannot be divided between organiser, platform fee and tax automatically. Collect, then pay out.</li>
          <li><strong>Refunds through the API.</strong> For a cancelled event, refund with a payout or from your dashboard.</li>
          <li><strong>Cards and other currencies.</strong> M-PESA and Kenyan shillings only.</li>
        </ul>
      </Callout>
    </>
  );
}
