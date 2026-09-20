#!/usr/bin/env node
// Checks the settings against the real PayChain and Shopify, and says what to fix.
import { loadConfig, configProblems } from '../src/config.js';
import { Shopify } from '../src/shopify.js';
import { PayChain } from '../src/paychain.js';

const cfg = loadConfig();
let bad = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const no = (m) => { bad++; console.log(`  ✗ ${m}`); };

console.log(`PayChain for Shopify: settings check\n`);
const problems = configProblems(cfg);
if (problems.length) { problems.forEach(no); process.exit(1); }
ok('all settings present');

const pc = await new PayChain(cfg).ping().catch((e) => ({ status: 0, body: { error: e.message } }));
pc.status === 200 ? ok(`PayChain accepts the key (${cfg.mode === 'live' ? 'LIVE, real money' : 'test key, no real money'})`) : no(`PayChain rejected the key: HTTP ${pc.status} ${pc.body?.error || ''}`);

const sh = new Shopify(cfg);
try {
  const d = await sh.graphql('{ shop { name currencyCode myshopifyDomain } }');
  ok(`Shopify store "${d.shop.name}" (${d.shop.myshopifyDomain}) reachable`);
  d.shop.currencyCode === 'KES' ? ok('store currency is KES') : no(`store currency is ${d.shop.currencyCode}; PayChain takes Kenyan shillings only`);
  if (d.shop.myshopifyDomain && d.shop.myshopifyDomain.toLowerCase() !== cfg.shop) no(`SHOPIFY_SHOP is ${cfg.shop} but the token belongs to ${d.shop.myshopifyDomain}`);
  await sh.graphql('{ orders(first: 1) { nodes { id } } }');
  ok('can read orders');
  const w = await sh.graphql('{ webhookSubscriptions(first: 50, topics: ORDERS_CREATE) { nodes { id endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } }');
  const urls = (w.webhookSubscriptions?.nodes || []).map((n) => n.endpoint?.callbackUrl).filter(Boolean);
  const mine = cfg.publicUrl ? `${cfg.publicUrl}/webhooks/shopify` : null;
  if (mine && urls.includes(mine)) ok('the orders/create webhook points here');
  else no(`no orders/create webhook points to ${mine || 'this service (set PUBLIC_URL, then run: npm run register-webhook)'}`);
} catch (e) {
  no(e.message);
}
console.log(`\n${bad ? `${bad} problem(s) to fix.` : 'Everything checks out.'}`);
console.log('The PayChain webhook is not checked here: register https://<your service>/webhooks/paychain in the developer portal and send its test event.');
process.exit(bad ? 1 : 0);
