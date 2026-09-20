import React from "react";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/Callout";
import ParamsTable from "@/components/ParamsTable";

export default function Authentication() {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Authentication</h1>
      <p>
        Every request to the Payments API (everything under <code>/api/v1/developer</code>)
        authenticates with an API key. Account-management routes (creating keys, linking a
        merchant, registering webhooks) use a JWT from logging in as a developer instead. See the{" "}
        <a href="/">Quickstart</a>.
      </p>

      <h2>API keys</h2>
      <p>
        Keys come in two modes, chosen when you create one. Both share the exact same host and the
        exact same endpoints (<code>https://api.paychain.co.ke</code>, no separate sandbox URL);
        only what they're allowed to touch differs.
      </p>
      <ParamsTable
        params={[
          { name: "test", type: "mode", description: "Self-serve, no approval needed. Every collect/payout is fully simulated: no rail call, no real balance change, settles to “success” automatically a few seconds after creation. Build and test your whole integration here first." },
          { name: "live", type: "mode", description: "Moves real money against your linked merchant's real balance. Requires an admin to approve live access for that merchant before you can create a live key for it. Approval is per merchant." },
        ]}
      />

      <h2>Sending the key</h2>
      <p>Either header works. Use whichever your HTTP client makes easiest.</p>
      <CodeBlock
        lang="bash"
        label="Option A"
        code={`Authorization: Bearer pc_live_5f2a9c...`}
      />
      <CodeBlock
        lang="bash"
        label="Option B"
        code={`X-API-Key: pc_live_5f2a9c...`}
      />

      <Callout variant="warning" title="The raw key is shown exactly once">
        PayChain stores only a SHA-256 hash of your key, never the plaintext. If you lose it,
        revoke it and create a new one. There's no way to retrieve the original value.
      </Callout>

      <h2>Requesting live access</h2>
      <p>
        Build and fully test your integration in <code>test</code> mode first. When you're ready
        to move real money, link the real merchant and request review for it:
      </p>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/live-access/request \\
  -H "Authorization: Bearer <developer-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"merchantId":"<merchant-id>"}'`}
      />
      <p>
        A PayChain admin reviews the request for that merchant; you can create <code>live</code>-mode keys for it as soon
        as it's approved. Each merchant you link is reviewed on its own, and <code>merchantId</code> can be left out
        when you have only one linked. Revoking a merchant's approval revokes its live keys.
      </p>

      <h2>One developer, many merchants, one merchant per live key</h2>
      <p>
        A developer account can link several PayChain merchant accounts, each proven by that
        merchant's own password plus an OTP sent to their inbox, not yours. Every live API key is
        created for exactly one of them, and every payment that key creates moves against that
        merchant's wallet. A key can only read its own merchant's payments, checkouts, invoices and
        batches, so a key you hand to one client can never see another client's data. Unlinking a
        merchant revokes every key for it. Test keys need no merchant at all.
      </p>
      <p>
        Choose the merchant when you create the key: <code>POST /api/developer/api-keys</code> with{" "}
        <code>{`{"mode":"live","merchantId":"…"}`}</code>. With only one merchant linked it's filled in
        for you. Webhook events for every merchant arrive at the same endpoints, and each payment
        carries its <code>merchantId</code> so you can route it.
      </p>
    </>
  );
}
