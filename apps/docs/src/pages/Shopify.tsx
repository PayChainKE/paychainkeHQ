import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import Callout from "@/components/Callout";
import CodeBlock from "@/components/CodeBlock";

const EMAIL_LINK = `<a href="https://pay.your-domain.com/pay?order={{ order.name | url_encode }}&email={{ order.email | url_encode }}">Pay now with M-PESA</a>`;

export default function Shopify() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Shopify app</h1>
      <p>
        Take M-PESA payments in a Shopify store. Customers choose <strong>M-PESA (PayChain)</strong> at
        checkout, pay from a link in their order email, and PayChain marks the Shopify order{" "}
        <strong>paid</strong> as soon as the money arrives.
      </p>

      <Callout variant="info" title="Why it isn't a checkout plugin">
        Shopify only lets approved payment partners add a payment method inside its own checkout. So this
        works next to Shopify: a small service you run, using a Shopify manual payment method and the order
        email. It is not a one-click install like the <Link to="/woocommerce">WooCommerce plugin</Link>; you
        (or your developer) run one small service.
      </Callout>

      <a
        href="/downloads/paychain-shopify.zip"
        download
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors no-underline mb-2"
      >
        <Download className="w-4 h-4" />
        Download the service (v1.0.0)
      </a>
      <p className="text-[12.5px] text-ink-faint">
        Node 18 or newer, no other dependencies, no database. Your Shopify store currency must be Kenyan
        Shillings.
      </p>

      <h2>How a payment goes</h2>
      <ol className="list-decimal pl-5 space-y-1 text-[15px] leading-7 text-ink-muted mb-4">
        <li>The customer picks <strong>M-PESA (PayChain)</strong> and places the order. Shopify holds it as payment pending.</li>
        <li>Their order confirmation email has a <strong>Pay now with M-PESA</strong> link.</li>
        <li>The link opens a PayChain checkout for exactly that order. They approve the M-PESA prompt on their phone.</li>
        <li>PayChain tells your service, securely, and the service marks the Shopify order paid.</li>
      </ol>

      <h2>Set it up</h2>

      <h3>1. Add the payment method in Shopify</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Go to <strong>Settings → Payments → Manual payment methods → Create custom payment method</strong>.
        Name it <code>M-PESA (PayChain)</code> (the service recognises orders by the word "M-PESA"). In the
        payment instructions write something like "You will get an email with a Pay now link", and add your
        service's <code>/pay</code> address, so customers who lose the email can still pay.
      </p>

      <h3>2. Create an app for your store</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Create an app for your store with the <code>read_orders</code> and <code>write_orders</code> permissions and
        install it. Shopify gives you either an <strong>Admin API access token</strong> or a{" "}
        <strong>client id and secret</strong>; the service accepts both.
      </p>

      <h3>3. Run the service</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Unzip the download, copy <code>.env.example</code> to <code>.env</code> and fill it in (the file explains
        each line), then run it on any host that stays on and has an https address: a small server, Render,
        Railway or Fly. A Dockerfile is included. It is <strong>not</strong> for serverless hosting, because it
        answers webhooks and runs a check every 10 minutes.
      </p>

      <h3>4. Check it, then connect the webhooks</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        <code>npm run check</code> tests every setting against the real PayChain and Shopify and says what to fix.{" "}
        <code>npm run register-webhook</code> tells Shopify to send new orders to the service. Then, in the portal's{" "}
        <Link to="/dashboard/webhooks">Webhooks</Link> page, add <code>https://your-service/webhooks/paychain</code>{" "}
        for <code>payment.collect.succeeded</code> and <code>payment.collect.failed</code> and put its secret in{" "}
        <code>PAYCHAIN_WEBHOOK_SECRET</code>.
      </p>

      <h3>5. Put the Pay now link in the order email</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        In <strong>Settings → Notifications → Order confirmation → Edit code</strong>, add this where you want the button.
        Use the preview to make sure the link is filled in.
      </p>
      <CodeBlock lang="text" label="Order confirmation email" code={EMAIL_LINK} />

      <h3>6. Try it, then go live</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Start with a <code>pc_test_</code> key. A test payment is tagged <code>paychain-test-payment</code> on the
        order but the order is <strong>not</strong> marked paid, so nothing can be shipped by mistake. On a
        development store you can set <code>TEST_PAYMENTS_MARK_PAID=1</code> to watch the whole flow finish. To go
        live, link your merchant account, request live access, and swap in a <code>pc_live_</code> key (see the{" "}
        <Link to="/integration-guide">Integration guide</Link>).
      </p>

      <h2>What you see on an order</h2>
      <ul>
        <li><code>paychain-pending</code>: waiting for the customer to pay.</li>
        <li><code>paychain-paid</code>: paid, and marked paid for you.</li>
        <li><code>paychain-underpaid</code>: less than the order total arrived. It is <strong>not</strong> marked paid; have a look.</li>
        <li><code>paychain-review</code>: money arrived for a cancelled order, or the store is not in KES. Refund or reinstate.</li>
        <li><code>paychain-test-payment</code>: paid with a test key; no real money.</li>
      </ul>

      <h2>Safety rules it follows</h2>
      <ul>
        <li>A payment link is only made when the customer gives the order number <strong>and</strong> the email or phone on the order.</li>
        <li>The amount PayChain received is checked against the order total. A short payment is never accepted.</li>
        <li>Delivering the same webhook twice never pays an order twice.</li>
        <li>Webhooks from Shopify and from PayChain are ignored unless their signature is valid.</li>
        <li>If a webhook is lost, the 10-minute check finishes any order that was paid.</li>
      </ul>

      <h2>Not in this version</h2>
      <ul>
        <li>Paying inside Shopify's own checkout. Shopify does not allow it for anyone but approved partners.</li>
        <li>Refunds from inside Shopify. Refund from your PayChain dashboard, then mark the order refunded.</li>
        <li>Currencies other than KES, and more than one store per running service.</li>
      </ul>

      <Callout variant="warning" title="Tested against a simulated Shopify">
        The whole flow is tested against the real PayChain sandbox and a simulated Shopify. Before real
        customers, place one test order on a Shopify development store, and check the notification preview.
      </Callout>
    </>
  );
}
