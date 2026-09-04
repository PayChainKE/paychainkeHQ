import React from "react";
import Callout from "@/components/Callout";

export default function PrivacyPolicy() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Privacy Policy</h1>
      <p className="text-[13px] text-ink-faint">Last updated August 20, 2026 · Developer &amp; API addendum</p>

      <Callout variant="info" title="This page covers the Developer API specifically">
        For PayChain's full privacy policy (how we handle merchant and customer data across the
        entire platform), see the{" "}
        <a href="https://paychain.co.ke/privacy-policy">canonical Privacy Policy</a> at
        paychain.co.ke. This page only adds what's specific to using the Developer API and
        this documentation site.
      </Callout>

      <h2>Who's responsible</h2>
      <p>
        PayChain Financial Services Ltd is the data controller for data processed through the
        Developer API and this site, registered with Kenya's Office of the Data Protection
        Commissioner (ODPC), registration no. <strong>927-3386-5943</strong>.
      </p>

      <h2>Data flowing through the API</h2>
      <p>
        When you integrate with the PayChain API, three categories of data pass through it:
      </p>
      <ul>
        <li><strong>Your account data</strong>: name, company name, email, phone, and the API keys/webhook secrets you generate. Used to authenticate your requests and identify who's making them.</li>
        <li><strong>Payment/collection data</strong>: amounts, phone numbers, references, and payout destinations you submit via <code>/payments</code>, <code>/checkout</code>, <code>/invoices</code>, and <code>/bulk-payments</code>. This is your linked merchant's transaction data, processed on the merchant's behalf, subject to the same controls as any other PayChain transaction.</li>
        <li><strong>Webhook payloads</strong>: the same payment/invoice/payout data above, POSTed to the endpoint URL you register. You're responsible for how your own systems store and secure it once delivered.</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>We don't sell API usage data, transaction data, or developer account data to third parties.</li>
        <li>Test-mode (<code>pc_test_...</code>) traffic never touches a real payment rail or a merchant's real balance: it's simulated end to end and isolated from live reporting.</li>
        <li>A webhook secret is shown once, at creation, and stored server-side only to sign deliveries; never displayed again or included in any export.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        As a developer, you can request a copy of, or deletion of, your account data at any time
        by emailing <a href="mailto:support@paychain.co.ke">support@paychain.co.ke</a>. Deleting
        a developer account revokes every associated API key and webhook immediately.
      </p>

      <h2>Full policy</h2>
      <p>
        For data controller obligations, retention periods, third-party processors (Safaricom,
        NCBA, Cloudinary, Resend), and merchant/customer data handling across the rest of the
        platform, see the{" "}
        <a href="https://paychain.co.ke/privacy-policy">full Privacy Policy</a> at paychain.co.ke.
      </p>
    </>
  );
}
