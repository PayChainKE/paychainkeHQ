import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers.js';
import { Shopify } from '../src/shopify.js';
import { loadConfig } from '../src/config.js';

const settle = () => new Promise((r) => setTimeout(r, 60));
const form = (o) => new URLSearchParams(o).toString();
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

test('new M-PESA order is tagged pending; other orders are left alone', async () => {
  const h = await harness();
  const mine = h.shopify.add();
  const other = h.shopify.add({ gateways: ['Cash on Delivery (COD)'] });
  const paid = h.shopify.add({ status: 'PAID' });
  for (const [o, fs] of [[mine, 'pending'], [other, 'pending'], [paid, 'paid']]) {
    const r = await h.shopifyEvent('orders/create', { id: Number(o.id.split('/').pop()), name: o.name, admin_graphql_api_id: o.id, payment_gateway_names: o.gateways, financial_status: fs });
    assert.equal(r.status, 200);
  }
  await settle();
  assert.deepEqual([...mine.tags], ['paychain-pending']);
  assert.equal(other.tags.size, 0);
  assert.equal(paid.tags.size, 0);
  h.close();
});

test('Shopify webhook: bad signature 401, other shop ignored', async () => {
  const h = await harness();
  const o = h.shopify.add();
  const payload = { id: 1, name: o.name, admin_graphql_api_id: o.id, payment_gateway_names: o.gateways, financial_status: 'pending' };
  assert.equal((await h.shopifyEvent('orders/create', payload, { 'x-shopify-hmac-sha256': 'AAAA' })).status, 401);
  assert.equal((await h.shopifyEvent('orders/create', payload, { 'x-shopify-shop-domain': 'evil.myshopify.com' })).status, 200);
  await settle();
  assert.equal(o.tags.size, 0);
  h.close();
});

test('pay page: wrong details reveal nothing and create nothing', async () => {
  const h = await harness();
  const o = h.shopify.add();
  for (const contact of ['someone@else.com', '0799000000', '', 'abc']) {
    const r = await h.post('/pay', form({ order: o.name, contact }), FORM);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('location'), null);
  }
  const missing = await h.post('/pay', form({ order: '#9999', contact: 'wanjiku@example.com' }), FORM);
  assert.match(await missing.text(), /could not find an order/);
  assert.equal(h.paychain.creates.length, 0);
  h.close();
});

test('pay page: right details create one checkout and redirect; asking again reuses it', async () => {
  const h = await harness();
  const o = h.shopify.add({ total: 1499.4 });
  const r = await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=WANJIKU@example.com`);
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^https:\/\/checkout\.paychain\.test\/pay\/cs1$/);
  const sent = h.paychain.creates[0];
  assert.equal(sent.amount, 1500); // rounded up to whole shillings
  assert.equal(sent.reference, `SH-test-store-${o.id.split('/').pop()}`);
  assert.equal(sent.callbackUrl, o.statusPageUrl);
  assert.equal(sent.customer.phone, '0712345678');
  assert.equal(o.meta.session_id, 'cs1');
  assert.ok(o.tags.has('paychain-pending'));

  const again = await h.post('/pay', form({ order: o.name.replace('#', ''), contact: '+254712345678' }), FORM);
  assert.equal(again.status, 302);
  assert.equal(h.paychain.creates.length, 1, 'no second session');

  o.total = 2000; // total changed: old session no longer matches
  const changed = await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`);
  assert.equal(changed.status, 302);
  assert.equal(h.paychain.creates.length, 2);
  assert.equal(h.paychain.creates[1].amount, 2000);
  h.close();
});

test('pay page refuses cancelled, non-KES, non-M-PESA and reports paid orders', async () => {
  const h = await harness();
  const cases = [
    [h.shopify.add({ cancelledAt: '2026-01-01' }), /cancelled/],
    [h.shopify.add({ currency: 'USD' }), /cannot be paid with M-PESA/],
    [h.shopify.add({ gateways: ['Cash on Delivery (COD)'] }), /not placed with M-PESA/],
    [h.shopify.add({ status: 'PAID' }), /Already paid/],
  ];
  for (const [o, re] of cases) {
    const r = await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), re);
  }
  assert.equal(h.paychain.creates.length, 0);
  h.close();
});

test('pay page: PayChain down gives a friendly message, not a crash', async () => {
  const h = await harness();
  const o = h.shopify.add();
  h.paychain.state.failCreate = true;
  const r = await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /could not start the M-PESA payment/);
  h.close();
});

test('pay page is rate limited per address', async () => {
  const h = await harness();
  let last;
  for (let i = 0; i < 21; i++) last = await h.post('/pay', form({ order: '#1', contact: 'a@b.co' }), FORM);
  assert.equal(last.status, 429);
  h.close();
});

const successEvent = (o, over = {}) => ({ id: 'pay1', mode: 'live', status: 'success', amount: 1500, currency: 'KES', reference: `SH-test-store-${o.id.split('/').pop()}`, ...over });

test('PayChain webhook: signature is required', async () => {
  const h = await harness();
  const o = h.shopify.add();
  assert.equal((await h.pcEvent('payment.collect.succeeded', successEvent(o), 'deadbeef')).status, 401);
  assert.equal(o.status, 'PENDING');
  h.close();
});

test('PayChain webhook marks the order paid once and swaps the tags', async () => {
  const h = await harness();
  const o = h.shopify.add({ tags: new Set(['paychain-pending']) });
  assert.equal((await h.pcEvent('payment.collect.succeeded', successEvent(o))).status, 200);
  assert.equal(o.status, 'PAID');
  assert.ok(o.tags.has('paychain-paid'));
  assert.ok(!o.tags.has('paychain-pending'));
  assert.equal(o.meta.payment_id, 'pay1');
  const marks = () => h.shopify.calls.filter((c) => c.includes('orderMarkAsPaid')).length;
  assert.equal(marks(), 1);
  await h.pcEvent('payment.collect.succeeded', successEvent(o)); // duplicate delivery
  assert.equal(marks(), 1);
  h.close();
});

test('PayChain webhook: concurrent duplicates mark paid only once', async () => {
  const h = await harness();
  const o = h.shopify.add();
  await Promise.all([1, 2, 3].map(() => h.pcEvent('payment.collect.succeeded', successEvent(o))));
  assert.equal(h.shopify.calls.filter((c) => c.includes('orderMarkAsPaid')).length, 1);
  h.close();
});

test('PayChain webhook: underpayment, other store, admin test, failed and unrelated events do not mark paid', async () => {
  const h = await harness();
  const o = h.shopify.add();
  await h.pcEvent('payment.collect.succeeded', successEvent(o, { amount: 1000 }));
  assert.equal(o.status, 'PENDING');
  assert.ok(o.tags.has('paychain-underpaid'));
  await h.pcEvent('payment.collect.succeeded', successEvent(o, { reference: `SH-other-store-${o.id.split('/').pop()}` }));
  await h.pcEvent('payment.collect.succeeded', successEvent(o, { origin: 'admin_test' }));
  await h.pcEvent('payment.collect.succeeded', successEvent(o, { reference: 'WC-1001' }));
  await h.pcEvent('payment.collect.failed', { ...successEvent(o), status: 'failed', failureReason: 'cancelled' });
  await h.pcEvent('payment.payout.succeeded', successEvent(o));
  assert.equal(o.status, 'PENDING');
  assert.equal((await h.pcEvent('webhook.test', {})).status, 200);
  h.close();
});

test('PayChain webhook: a payment for a cancelled order is flagged, not marked paid', async () => {
  const h = await harness();
  const o = h.shopify.add({ cancelledAt: '2026-01-01' });
  await h.pcEvent('payment.collect.succeeded', successEvent(o));
  assert.equal(o.status, 'PENDING');
  assert.ok(o.tags.has('paychain-review'));
  h.close();
});

test('test-key payments are tagged but not marked paid, unless allowed', async () => {
  const h = await harness();
  const o = h.shopify.add({ tags: new Set(['paychain-pending']) });
  await h.pcEvent('payment.collect.succeeded', successEvent(o, { mode: 'test' }));
  assert.equal(o.status, 'PENDING');
  assert.ok(o.tags.has('paychain-test-payment'));
  h.close();

  const h2 = await harness({ TEST_PAYMENTS_MARK_PAID: '1' });
  const o2 = h2.shopify.add();
  await h2.pcEvent('payment.collect.succeeded', successEvent(o2, { mode: 'test' }));
  assert.equal(o2.status, 'PAID');
  h2.close();
});

test('Shopify trouble on the PayChain webhook returns 5xx so PayChain retries', async () => {
  const h = await harness();
  const o = h.shopify.add();
  h.shopify.state.markPaidFails = true;
  assert.equal((await h.pcEvent('payment.collect.succeeded', successEvent(o))).status, 500);
  h.shopify.state.markPaidFails = false;
  assert.equal((await h.pcEvent('payment.collect.succeeded', successEvent(o))).status, 200);
  assert.equal(o.status, 'PAID');
  h.close();
});

test('sweeper marks a paid session even when the webhook never arrived', async () => {
  const h = await harness();
  const o = h.shopify.add();
  await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`); // creates cs1, tags pending
  h.paychain.sessions.get('cs1').status = 'success';
  h.paychain.sessions.get('cs1').mode = 'live';
  const r = await h.orders.sweep();
  assert.equal(r.completed, 1);
  assert.equal(o.status, 'PAID');
  assert.equal((await h.orders.sweep()).completed, 0);
  h.close();
});

test('an order paid on a previous session is recognised when the customer returns to the pay page', async () => {
  const h = await harness();
  const o = h.shopify.add();
  await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`);
  h.paychain.sessions.get('cs1').status = 'success';
  h.paychain.sessions.get('cs1').mode = 'live';
  const r = await h.get(`/pay?order=${encodeURIComponent(o.name)}&email=wanjiku@example.com`);
  assert.match(await r.text(), /Already paid/);
  assert.equal(o.status, 'PAID');
  h.close();
});

test('client-credentials token is fetched once, reused, and renewed after a 401', async () => {
  const s = await (await import('./helpers.js')).fakeShopify();
  const cfg = loadConfig({ SHOPIFY_SHOP: 'test-store', SHOPIFY_API_BASE: s.url, SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'secret' });
  assert.equal(cfg.shop, 'test-store.myshopify.com');
  assert.equal(cfg.shopifyWebhookSecret, 'secret');
  const sh = new Shopify(cfg);
  await sh.graphql('{ shop { name } }');
  await sh.graphql('{ shop { name } }');
  assert.equal(s.state.tokenRequests, 1);
  s.state.rejectTokenOnce = true;
  await sh.graphql('{ shop { name } }');
  assert.equal(s.state.tokenRequests, 2);
  s.close();
});

test('startup problems are listed in plain words', async () => {
  const { configProblems } = await import('../src/config.js');
  assert.ok(configProblems(loadConfig({})).length >= 4);
  const ok = loadConfig({ SHOPIFY_SHOP: 'a', SHOPIFY_ADMIN_TOKEN: 't', SHOPIFY_WEBHOOK_SECRET: 's', PAYCHAIN_API_KEY: 'pc_live_x', PAYCHAIN_WEBHOOK_SECRET: 'w' });
  assert.deepEqual(configProblems(ok), []);
  assert.equal(ok.mode, 'live');
});
