// All settings come from environment variables (see .env.example). Nothing is
// read from disk, so the same code runs on any host.

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function normalizeShop(input) {
  let s = clean(input).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (s && !s.includes('.')) s = `${s}.myshopify.com`;
  return s;
}

export function loadConfig(env = process.env) {
  const shop = normalizeShop(env.SHOPIFY_SHOP);
  const cfg = {
    port: Number(env.PORT) || 8788,
    publicUrl: clean(env.PUBLIC_URL).replace(/\/+$/, ''),

    shop,
    // "my-store" out of my-store.myshopify.com. Goes into every PayChain
    // reference so one PayChain account can serve several stores safely.
    shopSlug: shop.replace(/\.myshopify\.com$/, ''),
    shopifyApiBase: clean(env.SHOPIFY_API_BASE).replace(/\/+$/, '') || `https://${shop}`,
    shopifyApiVersion: clean(env.SHOPIFY_API_VERSION) || '2026-07',
    adminToken: clean(env.SHOPIFY_ADMIN_TOKEN),
    clientId: clean(env.SHOPIFY_CLIENT_ID),
    clientSecret: clean(env.SHOPIFY_CLIENT_SECRET),
    // Orders/create webhooks are signed with the app's client secret.
    shopifyWebhookSecret: clean(env.SHOPIFY_WEBHOOK_SECRET) || clean(env.SHOPIFY_CLIENT_SECRET),

    paychainKey: clean(env.PAYCHAIN_API_KEY),
    paychainBase: clean(env.PAYCHAIN_API_BASE).replace(/\/+$/, '') || 'https://api.paychain.co.ke',
    paychainWebhookSecret: clean(env.PAYCHAIN_WEBHOOK_SECRET),

    // An order is ours when one of its payment method names contains this.
    methodMatch: (clean(env.PAYMENT_METHOD_MATCH) || 'm-pesa').toLowerCase(),
    sessionTtlMinutes: Math.min(10080, Math.max(5, Number(env.SESSION_TTL_MINUTES) || 60)),
    // A payment made with a pc_test_ key moves no money. By default it is
    // tagged on the order but the order is NOT marked paid.
    testPaymentsMarkPaid: /^(1|true|yes)$/i.test(clean(env.TEST_PAYMENTS_MARK_PAID)),
    sweepEveryMinutes: Number(env.SWEEP_EVERY_MINUTES) || 10,
  };
  cfg.mode = cfg.paychainKey.startsWith('pc_live_') ? 'live' : cfg.paychainKey.startsWith('pc_test_') ? 'test' : 'unknown';
  return cfg;
}

/** Human-readable list of what is missing; empty when ready to run. */
export function configProblems(cfg) {
  const p = [];
  if (!cfg.shop) p.push('SHOPIFY_SHOP is not set (for example my-store.myshopify.com).');
  if (!cfg.adminToken && !(cfg.clientId && cfg.clientSecret)) p.push('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.');
  if (!cfg.shopifyWebhookSecret) p.push('SHOPIFY_WEBHOOK_SECRET is not set (the app\'s client secret; needed to check Shopify\'s webhooks).');
  if (!cfg.paychainKey) p.push('PAYCHAIN_API_KEY is not set.');
  else if (cfg.mode === 'unknown') p.push('PAYCHAIN_API_KEY should start with pc_test_ or pc_live_.');
  if (!cfg.paychainWebhookSecret) p.push('PAYCHAIN_WEBHOOK_SECRET is not set (the secret of the webhook you register in the PayChain developer portal).');
  if (!/^https:\/\//.test(cfg.paychainBase) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(cfg.paychainBase)) p.push('PAYCHAIN_API_BASE must use https.');
  return p;
}
