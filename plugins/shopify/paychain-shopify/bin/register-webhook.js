#!/usr/bin/env node
// Tells Shopify to send new orders to this service. Run once, after PUBLIC_URL is set.
import { loadConfig, configProblems } from '../src/config.js';
import { Shopify } from '../src/shopify.js';

const cfg = loadConfig();
const problems = configProblems(cfg);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (!/^https:\/\//.test(cfg.publicUrl)) { console.error('Set PUBLIC_URL to this service\'s public https address first.'); process.exit(1); }

const callbackUrl = `${cfg.publicUrl}/webhooks/shopify`;
const sh = new Shopify(cfg);
const existing = await sh.graphql('{ webhookSubscriptions(first: 50, topics: ORDERS_CREATE) { nodes { id endpoint { ... on WebhookHttpEndpoint { callbackUrl } } } } }');
if ((existing.webhookSubscriptions?.nodes || []).some((n) => n.endpoint?.callbackUrl === callbackUrl)) {
  console.log(`Already registered: ${callbackUrl}`);
  process.exit(0);
}
await sh.mutate(
  'mutation($url: URL!) { webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: { callbackUrl: $url, format: JSON }) { webhookSubscription { id } userErrors { message } } }',
  { url: callbackUrl }, 'webhookSubscriptionCreate'
);
console.log(`Registered the orders/create webhook: ${callbackUrl}`);
