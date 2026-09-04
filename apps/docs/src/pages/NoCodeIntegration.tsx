import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Callout from "@/components/Callout";
import CodeBlock from "@/components/CodeBlock";

export default function NoCodeIntegration() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">No-code integration</h1>
      <p>
        Everything else on this site assumes you're writing code against the API. This page
        doesn't: it's for selling tickets, taking orders, or collecting payments on a website you
        did <em>not</em> build yourself: Wix, Shopify, WordPress, Squarespace, or anywhere else
        that lets you paste a block of HTML. No developer account, no API key, no code.
      </p>

      <Callout variant="tip" title="You only need a PayChain merchant account">
        Not the developer account the rest of this site is about, the regular business account
        you'd sign up for at{" "}
        <a href="https://app.paychain.co.ke/signup" target="_blank" rel="noreferrer">app.paychain.co.ke/signup</a>.
        If you already take payments through the PayChain dashboard, you have everything you need
        already.
      </Callout>

      <h2>What you end up with</h2>
      <p>
        A real "Pay with PayChain" button, sitting on your own page, that opens a small secure
        window where a customer types their M-Pesa number and pays. Two lines, generated for you,
        specific to one thing you're selling:
      </p>
      <CodeBlock
        lang="html"
        label="paste this into your site"
        code={`<script src="https://app.paychain.co.ke/paychain-button.js" defer></script>
<div data-paychain-link="YOUR_LINK_ID" data-paychain-label="Pay KES 2,500"></div>`}
      />
      <p className="text-[13.5px] text-ink-muted leading-6">
        You never type this by hand; your dashboard generates it with your real link ID already
        filled in. It's shown here so you know what you're looking for.
      </p>

      <h2>Step by step</h2>

      <h3>1. Log into your PayChain merchant dashboard</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        At{" "}
        <a href="https://app.paychain.co.ke" target="_blank" rel="noreferrer">app.paychain.co.ke</a>.
        If you don't have an account yet, sign up there first; it takes a few minutes and needs
        no technical knowledge.
      </p>

      <h3>2. Create a Payment Link for what you're selling</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        From the dashboard, go to <strong>Request Money → Payment Link</strong>. Enter the amount
        (a ticket price, a product price, a booking fee) and generate it. Each link is for one
        fixed price: selling three different products means three different links, each with its
        own button.
      </p>

      <h3>3. Copy your embed code</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Right below the link you just created, click <strong>"Have a website? Embed this as a
        button"</strong>. It shows the exact two-line snippet above with your real link already
        in it, and a Copy button. There's also a live preview right there, so you can see the
        actual button before you go anywhere near your own site.
      </p>

      <h3>4. Paste it into your website</h3>
      <p className="text-[13.5px] text-ink-muted leading-6 mb-3">
        Every site builder has a block for adding raw HTML, though it's called something slightly
        different in each one and the exact menu path changes over time as they update their
        editors. Look for a block or section named something like:
      </p>
      <ul>
        <li><strong>Wix</strong>: an "Embed" or "Custom Element" block, added from the Elements/Add panel.</li>
        <li><strong>WordPress</strong>: a "Custom HTML" block in the page/post editor.</li>
        <li><strong>Shopify</strong>: a "Custom Liquid" section, or a rich-text block's HTML/source view, depending on your theme.</li>
        <li><strong>Squarespace</strong>: a "Code" block, added like any other content block.</li>
      </ul>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Paste the whole snippet in as-is, don't split the two lines apart. If your builder shows a
        warning about pasting HTML/code, that's normal and expected; it's not PayChain-specific.
      </p>

      <Callout variant="info" title="Why a popup window, not something embedded on the page">
        Clicking the button opens the payment page in a small centered window instead of directly
        inside your page. That's deliberate: it means the button works on every site builder with
        no special settings to change, and your customer's payment always happens on PayChain's
        own secure page, never inside a frame controlled by your site.
      </Callout>

      <h3>5. Publish your site, then test it yourself</h3>
      <p className="text-[13.5px] text-ink-muted leading-6">
        Save/publish like you normally would. Then load the live page and click your own button;
        you should see the popup open with your amount and business name on it. You don't need to
        actually pay to confirm it's wired up correctly; seeing the right page open is enough.
      </p>

      <h3>6. A customer pays, and you get paid</h3>
      <p className="text-[13.5px] text-ink-muted leading-6 mb-6">
        A real customer clicks the button, enters their M-Pesa number, and gets a payment prompt on
        their phone. The moment they confirm it, the money lands in your PayChain balance, and you
        both get an SMS confirming it, automatically. Nothing left to check or reconcile by hand.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>A Payment Link expires 48 hours after you create it, and can only be paid once. For something you sell repeatedly (a recurring ticket type, a standing product), generate a fresh link (and a fresh embed snippet) each time the old one is used or expires, rather than reusing one indefinitely.</li>
        <li>One button is one fixed price. This is the right fit for a ticket tier, a single product, a booking fee, not a shopping cart with quantities or multiple items in one checkout.</li>
        <li>If you need a real cart, subscriptions, or a fully custom checkout flow, that needs actual code; see the <Link to="/integration-guide">Integration guide</Link> for the full API, or hand this page to a developer.</li>
      </ul>

      <h2>Where to go next</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {[
          { to: "/integration-guide", label: "Integration guide (for developers)" },
          { to: "/payment-collection", label: "Payment collection reference" },
          { to: "/help", label: "Help & support" },
          { to: "/contact", label: "Contact us" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="group flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface hover:border-brand/30 transition-all text-[13.5px] font-semibold text-ink">
            {l.label}
            <ArrowRight className="w-3.5 h-3.5 text-ink-faint group-hover:text-brand-bright group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </>
  );
}
