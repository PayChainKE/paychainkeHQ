import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import Callout from "@/components/Callout";

export default function WooCommerce() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">WooCommerce plugin</h1>
      <p>
        Take M-PESA payments in a WooCommerce shop without writing code. Customers choose{" "}
        <strong>M-PESA (PayChain)</strong> at checkout, are taken to a secure PayChain page, approve the
        payment on their phone, and the order is marked paid automatically.
      </p>

      <a
        href="/downloads/paychain-for-woocommerce.zip"
        download
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-dim transition-colors no-underline mb-2"
      >
        <Download className="w-4 h-4" />
        Download the plugin (v1.0.0)
      </a>
      <p className="text-[12.5px] text-ink-faint">
        Needs WordPress 6.0+, WooCommerce 7.0+, PHP 7.4+, and your store currency set to Kenyan Shillings.
        Works with the block checkout, the classic checkout, and High-Performance Order Storage.
      </p>

      <h2>Set it up</h2>

      <h3>1. Install and activate</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        In WordPress go to <strong>Plugins → Add New → Upload Plugin</strong>, choose the zip, install, and
        activate. Make sure <strong>WooCommerce → Settings → General → Currency</strong> is{" "}
        <strong>Kenyan shilling (KES)</strong>. The plugin hides itself for any other currency.
      </p>

      <h3>2. Get an API key</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Create a <Link to="/signup">developer account</Link> and make a key on the{" "}
        <Link to="/dashboard/api-keys">API keys</Link> page. Start with a <code>pc_test_</code> key: it is a full
        sandbox, no merchant account or real money needed. Paste it into{" "}
        <strong>WooCommerce → Settings → Payments → PayChain (M-PESA)</strong> and tick Enable. The settings
        page tells you straight away whether it connected, and whether it is test or live.
      </p>

      <h3>3. Add the webhook</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        The settings page shows a <strong>webhook address</strong>. In the portal's{" "}
        <Link to="/dashboard/webhooks">Webhooks</Link> page, register that address, subscribed to{" "}
        <code>payment.collect.succeeded</code> and <code>payment.collect.failed</code>, then paste the secret it
        gives you into the plugin's <strong>Webhook secret</strong> field. This is how PayChain tells your shop,
        securely, that an order was paid. Your shop must be reachable from the internet over https for this.
      </p>
      <Callout variant="tip" title="No webhook yet? It still works">
        If a customer returns to your shop after paying, the thank-you page asks PayChain directly and completes
        the order. A check every 10 minutes catches customers who never come back. The webhook is faster and is
        the recommended set-up.
      </Callout>

      <h3>4. Go live</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Place a test order and pay it in the sandbox. When you're happy, link your real merchant account,
        request live access, and swap in a <code>pc_live_</code> key (see the{" "}
        <Link to="/integration-guide">Integration guide</Link>). A test key marks orders paid with a note saying{" "}
        <em>TEST MODE, do not ship</em>, so never fulfil goods from a test-mode order.
      </p>

      <h2>How it behaves</h2>
      <ul>
        <li>The order goes <strong>on hold</strong> while the customer pays, then to <strong>processing</strong> when PayChain confirms.</li>
        <li>The payment is checked against the order total. A short payment is <strong>not</strong> accepted and the order gets a note.</li>
        <li>An order total with cents is rounded up to whole shillings, with a note on the order.</li>
        <li>The customer's billing phone is pre-filled on the PayChain page.</li>
        <li>Delivering the same webhook twice never pays an order twice.</li>
      </ul>

      <h2>Not in this version</h2>
      <ul>
        <li>Refunds from inside WooCommerce. Refund from your PayChain dashboard, then mark the order refunded.</li>
        <li>Currencies other than KES.</li>
      </ul>

      <Callout variant="info" title="Shopify">
        Shopify only lets approved payment partners add a payment method to its checkout, so a plugin like this
        isn't possible there. Shopify stores can use the <Link to="/shopify">Shopify app</Link> (a small service
        that marks orders paid for you) or the <Link to="/no-code-integration">no-code payment button</Link>.
      </Callout>
    </>
  );
}
