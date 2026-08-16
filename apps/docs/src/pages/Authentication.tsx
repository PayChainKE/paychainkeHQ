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
        merchant, registering webhooks) use a JWT from logging in as a developer instead — see the{" "}
        <a href="/">Quickstart</a>.
      </p>

      <h2>API keys</h2>
      <p>
        Keys come in two modes, chosen when you create one. Both share the exact same host and the
        exact same endpoints — <code>https://api.paychain.co.ke</code>, no separate sandbox URL —
        only what they're allowed to touch differs.
      </p>
      <ParamsTable
        params={[
          { name: "test", type: "mode", description: "Self-serve, no approval needed. Every collect/payout is fully simulated: no rail call, no real balance change, settles to “success” automatically a few seconds after creation. Build and test your whole integration here first." },
          { name: "live", type: "mode", description: "Moves real money against your linked merchant's real balance. Requires an admin to approve a live-access request for your developer account before you can create a live key." },
        ]}
      />

      <h2>Sending the key</h2>
      <p>Either header works — use whichever your HTTP client makes easiest.</p>
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
        revoke it and create a new one — there's no way to retrieve the original value.
      </Callout>

      <h2>Requesting live access</h2>
      <p>
        Build and fully test your integration in <code>test</code> mode first. When you're ready
        to move real money, request review:
      </p>
      <CodeBlock
        lang="bash"
        label="curl"
        code={`curl -X POST https://api.paychain.co.ke/api/developer/live-access/request \\
  -H "Authorization: Bearer <developer-jwt>"`}
      />
      <p>A PayChain admin reviews the request; you'll be able to create <code>live</code>-mode keys as soon as it's approved.</p>

      <h2>One developer, one merchant</h2>
      <p>
        A developer account links to exactly one PayChain merchant account, proven by that
        merchant's own password plus an OTP sent to their inbox — not yours. Every payment your
        API keys create moves against that merchant's wallet. There's no cross-merchant access,
        by design.
      </p>
    </>
  );
}
