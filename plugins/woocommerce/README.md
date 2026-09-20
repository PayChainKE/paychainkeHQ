# PayChain for WooCommerce

A WooCommerce payment gateway for PayChain (M-PESA). Customers pay on a secure
PayChain page; the order is marked paid automatically.

- `paychain-for-woocommerce/` is the plugin.
- `./build.sh` builds `dist/paychain-for-woocommerce.zip` and copies it to
  `apps/docs/public/downloads/`, which the developer portal links to.

## How it works

1. Checkout calls `POST /api/v1/developer/checkout` with the order total,
   `reference: WC-<order id>` and the shop's thank-you page as `callbackUrl`,
   puts the order on hold and redirects the customer to the returned `checkoutUrl`.
2. PayChain sends a signed `payment.collect.succeeded` webhook
   (`?wc-api=WC_Gateway_PayChain`). The plugin verifies `X-PayChain-Signature`
   (HMAC-SHA256 of the raw body), matches the order by reference, checks the amount
   and completes the order once.
3. Fallbacks, so it works without the webhook and when customers do not return:
   the thank-you page and a 10-minute WP-Cron job call
   `GET /api/v1/developer/checkout/:id`. The browser redirect alone is never trusted.

## Requirements

WordPress 6.0+, WooCommerce 7.0+, PHP 7.4+, store currency KES, a PayChain
developer account (API key, and for live payments a linked, approved merchant).

## Limits (v1)

- KES only. Totals with cents are rounded up to whole shillings.
- No refunds through the plugin.
- A test key marks orders paid, with a "TEST MODE: do not ship" note.
- Shopify cannot be done with a plugin like this: Shopify only lets approved
  payment partners add a checkout gateway. Shopify stores use the no-code button.

## Tested

Against a real WordPress + WooCommerce install (block checkout, classic gateway API,
both order storage modes) talking to a real PayChain backend in sandbox mode.
