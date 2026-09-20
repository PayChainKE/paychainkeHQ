# PayChain for Shopify

Take M-PESA payments in a Shopify store through PayChain. A small service you run
yourself (Node 18+, no dependencies, no database).

Shopify only lets approved payment partners add a payment method to its checkout,
so this works alongside Shopify instead of inside it:

1. The customer chooses your **M-PESA (PayChain)** manual payment method and places the order.
2. Their order email carries a **Pay now** link to this service.
3. The service opens a PayChain hosted checkout for that order. The customer approves the M-PESA prompt.
4. PayChain tells the service (signed webhook), and the service marks the Shopify order **paid**.

## Set it up

Full guide with screenshots-free steps: the developer portal page "Shopify".

1. **Shopify: payment method.** Settings → Payments → Manual payment methods → Create custom payment method. Name it `M-PESA (PayChain)`. In the payment instructions say "You will get an email with a Pay now link", and give the service's `/pay` address.
2. **Shopify: app.** Create an app that has the `read_orders` and `write_orders` scopes and install it on your store. Keep its access token (or client id and secret).
3. **Run the service.** Copy `.env.example` to `.env`, fill it in, and start it on any always-on host: `node --env-file=.env src/server.js` (Node 20.6+), or `docker build -t paychain-shopify . && docker run --env-file .env -p 8788:8788 paychain-shopify`. It must be reachable over https.
4. **Check it.** `npm run check` tests every setting against the real PayChain and Shopify and tells you what is wrong. Then `npm run register-webhook` tells Shopify to send new orders here.
5. **PayChain webhook.** In the developer portal add a webhook to `https://<your service>/webhooks/paychain` for `payment.collect.succeeded` and `payment.collect.failed`, and put its secret in `PAYCHAIN_WEBHOOK_SECRET`.
6. **Order email.** Settings → Notifications → Order confirmation → edit code, and add:

   ```liquid
   <a href="https://<your service>/pay?order={{ order.name | url_encode }}&email={{ order.email | url_encode }}">Pay now with M-PESA</a>
   ```

   Use the notification's preview to confirm the link is filled in.

Start with a `pc_test_` key. A test payment is tagged `paychain-test-payment` on the order and the order is **not** marked paid, so nothing can be shipped by mistake. Set `TEST_PAYMENTS_MARK_PAID=1` on a development store to watch the whole flow finish.

## What it does to an order

| Tag | Meaning |
| --- | --- |
| `paychain-pending` | waiting for the customer to pay |
| `paychain-paid` | marked paid by this service |
| `paychain-underpaid` | PayChain received less than the order total. Not marked paid. Look at it |
| `paychain-review` | a payment arrived for a cancelled order, or the store is not in KES |
| `paychain-test-payment` | paid with a test key; no money moved |

The PayChain checkout session is kept on the order as the `paychain.session_id` metafield, so the service needs no database. If a webhook is lost, a check every 10 minutes finishes any order that was paid.

## Rules it follows

- The customer must give the order number **and** the email or phone on the order before a payment link is made. Wrong details get the same answer as an unknown order.
- The payment is checked against the order total in KES (rounded up to whole shillings). A short payment is never accepted.
- A cancelled order is never marked paid; it is tagged for review.
- Delivering the same webhook twice, or two at once, marks an order paid once.
- Webhooks from Shopify and PayChain are refused unless their signature is valid.
- References look like `SH-<store>-<order id>`, so one PayChain account can serve several stores.

## Limits

- KES stores only. Refunds are made in the PayChain dashboard, then marked in Shopify.
- The service must stay running (not serverless): it answers webhooks and runs the 10-minute check.
- One store per running service. Run another copy, with another `.env`, for a second store.

## Tests

`npm test` runs 19 checks against a simulated Shopify and PayChain.
