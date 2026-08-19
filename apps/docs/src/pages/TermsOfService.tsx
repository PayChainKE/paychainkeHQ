import React from "react";
import Callout from "@/components/Callout";

export default function TermsOfService() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Terms of Service</h1>
      <p className="text-[13px] text-ink-faint">Last updated August 20, 2026 · Developer &amp; API addendum</p>

      <Callout variant="info" title="This page covers the Developer API specifically">
        For PayChain's full Terms of Service — covering the merchant dashboard, account
        eligibility, and platform-wide terms — see the{" "}
        <a href="https://paychain.co.ke/terms-of-service">canonical Terms of Service</a> at
        paychain.co.ke. This page adds what's specific to using the Developer API.
      </Callout>

      <h2>Using the API</h2>
      <ul>
        <li>A developer account must be linked to a real, active PayChain merchant account before any API call that touches money (collections, payouts, invoices, bulk payments) will work.</li>
        <li><strong>Live</strong> API keys require the linked merchant to explicitly enable API access, and — for payouts — set an API payout PIN and per-transaction/daily caps from their dashboard. You may not attempt to circumvent those caps.</li>
        <li><strong>Test</strong> keys work immediately, with no approval needed, and simulate every request — no real rail is touched and no real balance changes.</li>
        <li>You're responsible for the security of your API keys and webhook secrets. Treat a live key with the same care as a password: never commit it to a public repository, never expose it in client-side code.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>The API may only be used for legitimate payment collection, disbursement, and invoicing on behalf of the merchant your developer account is linked to.</li>
        <li>Do not use the API to test or probe another merchant's account, enumerate valid phone numbers or account details, or attempt to trigger payouts you're not authorized to make.</li>
        <li>Rate limits exist to keep the platform stable for every integration. Deliberately working around them is a violation of these terms.</li>
        <li>Reporting a security issue in good faith (see <a href="/help">Help &amp; Support</a>) is always welcome and never treated as a violation, provided you don't access or modify another party's live data while investigating.</li>
      </ul>

      <h2>Liability for API usage</h2>
      <p>
        PayChain processes exactly what your integration submits — an amount, a destination, an
        invoice's line items. We're not responsible for losses caused by a bug in your own
        integration (sending the wrong amount, the wrong destination, or double-submitting
        without an idempotency key). Using <code>Idempotency-Key</code> correctly on every
        write, and verifying webhook signatures before acting on a delivery, are documented
        specifically so this class of mistake is avoidable — see{" "}
        <a href="/send-money">Send Money</a> and <a href="/webhooks">Webhooks</a>.
      </p>

      <h2>Suspension</h2>
      <p>
        PayChain may suspend an API key or a developer account for suspected fraud, abuse, a
        security concern, or a violation of the acceptable-use terms above. Where practical,
        we'll tell you why via the email on file before or shortly after suspending.
      </p>

      <h2>Full terms</h2>
      <p>
        For account eligibility, fees, dispute resolution, and every platform-wide term, see the{" "}
        <a href="https://paychain.co.ke/terms-of-service">full Terms of Service</a> at
        paychain.co.ke.
      </p>
    </>
  );
}
