# PayChain Developer API

Integrate PayChain payment collection and payouts into your own software —
a CRM, an ISP billing/provisioning system, an ERP, or any backend that
needs to know the moment a customer pays.

## 1. Getting access

1. **Register a developer account** — `POST /api/auth/developer/register`, then verify with the OTP sent to your email (`POST /api/auth/developer/verify-otp`).
2. **Log in** — `POST /api/auth/developer/login` returns a JWT used for all `/api/developer/*` management routes below.
3. **Link a PayChain merchant account** — `POST /api/developer/link-merchant/start` / `/verify` proves control of the merchant account (its password, plus an OTP sent to the merchant's own inbox) before any API key can move money in or out of it. One developer account can only be linked to one merchant.
4. **Create an API key** — `POST /api/developer/api-keys` with `{ "mode": "test" }` works immediately. `{ "mode": "live" }` requires an admin to approve a live-access request first (`POST /api/developer/live-access/request`). The raw key (`pc_test_...` / `pc_live_...`) is shown **once**, in the create response — only its hash is stored.
5. Every request to the endpoints in §2 authenticates with that key: `Authorization: Bearer pc_live_...` (or the `X-API-Key` header).

Test-mode keys never touch a real rail or a real merchant balance — every collect/payout simulates to `success` a few seconds after creation. Use them to build and test your integration before requesting live access.

## 2. Payments API

Base path: `/api/v1/developer`. All payment-initiating calls require an `Idempotency-Key` header (any unique string you generate per attempt) — retrying the same key returns the original result instead of creating a duplicate payment.

| Method | Path | Purpose |
|---|---|---|
| GET | `/ping` | Smoke-test your API key |
| POST | `/payments/collect` | Trigger an STK push to a customer's phone, into your linked merchant's wallet |
| POST | `/payments/payout` | Pay out from your linked merchant's wallet to a bank account |
| GET | `/payments/:id` | Check a payment's current status |

**Collect (STK push)**

```
POST /api/v1/developer/payments/collect
Authorization: Bearer pc_live_...
Idempotency-Key: <unique-per-attempt>
Content-Type: application/json

{ "amount": 500, "phone": "0712345678", "reference": "subscriber-4821" }
```

`reference` is yours to set and gets echoed back on the payment object and every webhook event for it — use it to carry your own internal ID (a CRM contact ID, an ISP subscriber account number) so you can match the event back to your own record without a lookup.

**Payout** additionally requires `bankCode`, `accountNumber`, and (live mode only) `apiPayoutPin` — a merchant must explicitly enable API payouts and set per-transaction/daily caps from their dashboard before a live payout will succeed.

## 3. Webhooks — real-time event delivery

Polling `GET /payments/:id` works, but most integrations (an ISP that needs to auto-reconnect a subscriber the moment their payment clears, a CRM that syncs a deal's status) want to be told, not to ask. Register a webhook endpoint and PayChain pushes events to it as they happen.

Base path: `/api/developer/webhooks` (JWT-authenticated, same as the account-management routes in §1).

| Method | Path | Purpose |
|---|---|---|
| GET | `/webhooks` | List your registered endpoints |
| POST | `/webhooks` | Register a new endpoint — `{ "url": "https://...", "events": ["*"] }` |
| PATCH | `/webhooks/:id` | Update url / subscribed events / active-disabled status |
| DELETE | `/webhooks/:id` | Remove an endpoint |
| POST | `/webhooks/:id/test` | Send a one-off test event, to verify your endpoint before real traffic depends on it |
| GET | `/webhooks/:id/deliveries` | Recent delivery attempts — status, HTTP response code, error, for debugging |

`url` must be `https://`. `events` is either `["*"]` (everything) or a subset of:

- `payment.collect.succeeded` / `payment.collect.failed`
- `payment.payout.succeeded` / `payment.payout.failed`

`POST /webhooks` returns a `secret` (`whsec_...`) **once**, in that response only — PayChain keeps it to sign every delivery to that endpoint, but never displays it again.

**Delivery**

```
POST <your url>
Content-Type: application/json
X-PayChain-Event: payment.collect.succeeded
X-PayChain-Delivery-Id: 65f...
X-PayChain-Signature: <hex HMAC-SHA256 of the raw body, using your webhook secret>

{
  "id": "b6e1...",
  "event": "payment.collect.succeeded",
  "createdAt": "2026-08-16T09:00:00.000Z",
  "data": {
    "payment": {
      "id": "65f...",
      "mode": "live",
      "kind": "collect",
      "amount": 500,
      "currency": "KES",
      "status": "success",
      "reference": "subscriber-4821",
      "counterparty": { "phone": "254712345678" },
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

**Verify the signature** before acting on a delivery (e.g. before triggering a reconnection):

```js
const crypto = require('crypto');

function isValidSignature(rawBody, signatureHeader, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

**Retries.** Your endpoint should return a `2xx` quickly (under 10s). Anything else — timeout, non-2xx, connection refused — is retried on a backoff: 1 min, 5 min, 30 min, 2h, 6h, then the delivery is marked `exhausted` and stops retrying. Check `GET /webhooks/:id/deliveries` if events seem to be going missing.

## 4. Common integration patterns

- **ISP auto-reconnection**: initiate `collect` with `reference` set to the subscriber's account number when they pay their bill; on `payment.collect.succeeded`, look up that account number and call your own provisioning API to lift the suspension. No polling loop needed.
- **CRM sync**: subscribe a webhook to all `payment.*` events and update the matching deal/invoice/contact record in your CRM as each one arrives; use `GET /payments/:id` as a fallback reconciliation check, not the primary signal.
- **Idempotent retries**: always generate a fresh `Idempotency-Key` per logical attempt (not per HTTP retry) — if your own request times out, retry with the *same* key and you'll get the original payment back instead of a duplicate charge.
