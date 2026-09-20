import http from 'node:http';
import crypto from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { Shopify } from '../src/shopify.js';
import { PayChain } from '../src/paychain.js';
import { Orders } from '../src/orders.js';
import { createApp } from '../src/app.js';

const listen = (handler) => new Promise((resolve) => {
  const s = http.createServer(handler);
  s.listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` }));
});
const body = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString())); });
const json = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

/** A stand-in Shopify Admin GraphQL API holding orders in memory. */
export async function fakeShopify() {
  const state = { orders: new Map(), tokenRequests: 0, calls: [], rejectTokenOnce: false, markPaidFails: false };
  const view = (o) => ({
    id: o.id, name: o.name, email: o.email, phone: o.phone, displayFinancialStatus: o.status,
    cancelledAt: o.cancelledAt || null, statusPageUrl: o.statusPageUrl, createdAt: o.createdAt,
    paymentGatewayNames: o.gateways, tags: [...o.tags],
    totalPriceSet: { shopMoney: { amount: String(o.total), currencyCode: o.currency } },
    billingAddress: { phone: o.billingPhone || null, firstName: 'Wanjiku', lastName: 'K' }, shippingAddress: null, customer: null,
    sessionMeta: o.meta.session_id ? { value: o.meta.session_id } : null,
  });
  const { server, url } = await listen(async (req, res) => {
    const raw = await body(req);
    if (req.url.endsWith('/oauth/access_token')) {
      state.tokenRequests++;
      return json(res, 200, { access_token: `tok${state.tokenRequests}`, expires_in: 86399 });
    }
    if (state.rejectTokenOnce && req.headers['x-shopify-access-token'] === 'tok1') { state.rejectTokenOnce = false; return json(res, 401, {}); }
    const { query, variables } = JSON.parse(raw);
    state.calls.push(query.replace(/\s+/g, ' ').trim().slice(0, 40));
    const byId = (id) => state.orders.get(id);
    let data;
    if (query.includes('orderMarkAsPaid')) {
      const o = byId(variables.id);
      if (state.markPaidFails) data = { orderMarkAsPaid: { order: null, userErrors: [{ message: 'boom' }] } };
      else { o.status = 'PAID'; data = { orderMarkAsPaid: { order: { id: o.id, displayFinancialStatus: 'PAID' }, userErrors: [] } }; }
    } else if (query.includes('tagsAdd')) { const o = byId(variables.id); variables.tags.forEach((t) => o.tags.add(t)); data = { tagsAdd: { userErrors: [] } }; }
    else if (query.includes('tagsRemove')) { const o = byId(variables.id); variables.tags.forEach((t) => o.tags.delete(t)); data = { tagsRemove: { userErrors: [] } }; }
    else if (query.includes('metafieldsSet')) { for (const m of variables.m) byId(m.ownerId).meta[m.key] = m.value; data = { metafieldsSet: { userErrors: [] } }; }
    else if (query.includes('orders(first')) {
      const q = variables.q;
      let nodes = [...state.orders.values()];
      const nm = /^name:(\S+)/.exec(q);
      if (nm) nodes = nodes.filter((o) => o.name.replace('#', '').toLowerCase() === nm[1].toLowerCase());
      if (q.includes('tag:paychain-pending')) nodes = nodes.filter((o) => o.tags.has('paychain-pending') && o.status === 'PENDING');
      data = { orders: { nodes: nodes.map(view) } };
    } else if (query.includes('order(id')) { const o = byId(variables.id); data = { order: o ? view(o) : null }; }
    else data = {};
    json(res, 200, { data });
  });
  let n = 1000;
  state.add = (over = {}) => {
    n++;
    const o = { id: `gid://shopify/Order/${n}`, name: `#${n}`, email: 'wanjiku@example.com', phone: null, billingPhone: '0712345678', status: 'PENDING', gateways: ['M-PESA (PayChain)'], tags: new Set(), meta: {}, total: 1500, currency: 'KES', statusPageUrl: `https://shop.example/orders/abc${n}/status`, createdAt: new Date().toISOString(), ...over };
    state.orders.set(o.id, o);
    return o;
  };
  return { ...state, state, url, close: () => server.close() };
}

/** A stand-in PayChain Developer API (checkout sessions only). */
export async function fakePayChain() {
  const state = { sessions: new Map(), creates: [], failCreate: false, seq: 0 };
  const { server, url } = await listen(async (req, res) => {
    const raw = await body(req);
    if (req.headers.authorization !== 'Bearer pc_test_key') return json(res, 401, { error: 'bad key' });
    if (req.method === 'GET' && req.url.endsWith('/ping')) return json(res, 200, { success: true });
    if (req.method === 'POST' && req.url.endsWith('/checkout')) {
      if (state.failCreate) return json(res, 500, { error: 'down' });
      const b = JSON.parse(raw);
      state.creates.push(b);
      const id = `cs${++state.seq}`;
      const s = { id, mode: 'test', amount: b.amount, currency: 'KES', reference: b.reference, status: 'pending', checkoutUrl: `https://checkout.paychain.test/pay/${id}`, expiresAt: new Date(Date.now() + b.expiresInMinutes * 60000).toISOString() };
      state.sessions.set(id, s);
      return json(res, 201, { success: true, session: s });
    }
    const m = /\/checkout\/(\w+)$/.exec(req.url);
    if (req.method === 'GET' && m) { const s = state.sessions.get(m[1]); return s ? json(res, 200, { success: true, session: s }) : json(res, 404, { error: 'nope' }); }
    json(res, 404, {});
  });
  return { ...state, state, url, close: () => server.close() };
}

export async function harness(envOver = {}) {
  const shopify = await fakeShopify();
  const paychain = await fakePayChain();
  const cfg = loadConfig({
    SHOPIFY_SHOP: 'test-store.myshopify.com', SHOPIFY_API_BASE: shopify.url, SHOPIFY_ADMIN_TOKEN: 'shpat_x', SHOPIFY_WEBHOOK_SECRET: 'shopify-secret',
    PAYCHAIN_API_KEY: 'pc_test_key', PAYCHAIN_API_BASE: paychain.url, PAYCHAIN_WEBHOOK_SECRET: 'pc-secret', ...envOver,
  });
  const logs = [];
  const orders = new Orders({ cfg, shopify: new Shopify(cfg), paychain: new PayChain(cfg), log: (l, m) => logs.push(`${l}: ${m}`) });
  const app = createApp({ cfg, orders, log: (l, m) => logs.push(`${l}: ${m}`) });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const pcSign = (raw) => crypto.createHmac('sha256', 'pc-secret').update(raw).digest('hex');
  const shSign = (raw) => crypto.createHmac('sha256', 'shopify-secret').update(raw).digest('base64');
  return {
    cfg, orders, shopify, paychain, logs, base,
    post: (path, raw, headers) => fetch(base + path, { method: 'POST', body: raw, headers, redirect: 'manual' }),
    get: (path) => fetch(base + path, { redirect: 'manual' }),
    pcEvent: (event, payment, sig) => fetch(`${base}/webhooks/paychain`, { method: 'POST', headers: { 'x-paychain-signature': sig ?? pcSign(JSON.stringify({ event, data: { payment } })) }, body: JSON.stringify({ event, data: { payment } }) }),
    shopifyEvent: (topic, payload, over = {}) => { const raw = JSON.stringify(payload); return fetch(`${base}/webhooks/shopify`, { method: 'POST', headers: { 'x-shopify-topic': topic, 'x-shopify-shop-domain': 'test-store.myshopify.com', 'x-shopify-hmac-sha256': shSign(raw), ...over }, body: raw }); },
    close: () => { app.close(); shopify.close(); paychain.close(); },
  };
}
