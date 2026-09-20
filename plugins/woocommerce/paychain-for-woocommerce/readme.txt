=== PayChain for WooCommerce ===
Contributors: paychainke
Tags: mpesa, payments, kenya, woocommerce, payment gateway
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Accept M-PESA payments in WooCommerce with PayChain.

== Description ==

Customers choose "M-PESA (PayChain)" at checkout, are taken to a secure PayChain page and approve the payment on their phone. Your order is marked paid automatically once PayChain confirms it.

* Works with the block checkout and the classic checkout
* Works with High-Performance Order Storage
* Signed webhook confirms payments; a status check on the thank-you page and every 10 minutes covers customers who never return
* Refuses under-payments; totals with cents are rounded up to whole shillings
* Test keys (pc_test_) run a full sandbox with no real money; live keys (pc_live_) take real payments
* Kenyan shillings (KES) only

== Installation ==

1. Upload the plugin zip in Plugins > Add New > Upload, then activate it.
2. Set your store currency to Kenyan Shilling (WooCommerce > Settings > General).
3. Open WooCommerce > Settings > Payments > PayChain (M-PESA). Paste your API key from the PayChain developer portal.
4. In the developer portal, add a webhook with the address shown on the settings page, subscribed to payment.collect.succeeded (and payment.collect.failed). Paste its secret into the plugin.
5. Test with a pc_test_ key, then switch to your pc_live_ key.

== Frequently Asked Questions ==

= Does it refund? =
Not yet. Refund from your PayChain dashboard, then mark the WooCommerce order refunded.

= Which currencies? =
Kenyan shillings only.

== Changelog ==

= 1.0.0 =
* First release.
