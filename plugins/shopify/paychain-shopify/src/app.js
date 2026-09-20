import http from 'node:http';
import crypto from 'node:crypto';
import { payForm, alreadyPaid, layout, messageFor } from './pages.js';

const MAX_BODY = 1024 * 1024;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

/** At most `max` tries per `windowMs` for one key (an IP address), in memory. */
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return recent.length <= max;
  };
}

export function createApp({ cfg, orders, log = () => {} }) {
  const allowPay = makeLimiter(20, 10 * 60 * 1000);
  const shopName = cfg.shop;

  const send = (res, status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
    res.writeHead(status, {
      'content-type': type, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      ...(type.startsWith('text/html') ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } : {}),
      ...extra,
    });
    res.end(body);
  };
  const html = (res, status, body) => send(res, status, body, 'text/html; charset=utf-8');

  const clientIp = (req) => (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';

  async function handlePay(req, res, params) {
    const orderInput = (params.get('order') || '').trim();
    const contact = (params.get('contact') || params.get('email') || params.get('phone') || '').trim();
    if (!orderInput || !contact) return html(res, 200, payForm({ shopName, order: orderInput, contact }));
    if (!allowPay(clientIp(req))) return html(res, 429, payForm({ shopName, error: messageFor('limit') }));

    const order = await orders.findOrderByName(orderInput);
    // Same answer whether the order is missing or the details are wrong.
    if (!order || !orders.identityMatches(order, contact)) {
      return html(res, 200, payForm({ shopName, error: messageFor('notfound'), order: orderInput }));
    }
    const out = await orders.checkoutFor(order);
    if (out.paid) return html(res, 200, alreadyPaid({ shopName, orderName: order.name }));
    if (out.url) return send(res, 302, '', 'text/plain; charset=utf-8', { location: out.url });
    return html(res, 200, payForm({ shopName, error: messageFor(out.error), order: orderInput }));
  }

  async function handleShopifyWebhook(req, res) {
    const raw = await readBody(req);
    const expected = crypto.createHmac('sha256', cfg.shopifyWebhookSecret).update(raw).digest('base64');
    if (!safeEqual(expected, req.headers['x-shopify-hmac-sha256'])) { log('warning', 'Shopify webhook rejected: bad signature'); return send(res, 401, 'invalid signature'); }
    const domain = String(req.headers['x-shopify-shop-domain'] || '').toLowerCase();
    if (domain && domain !== cfg.shop) return send(res, 200, 'ignored');
    let payload; try { payload = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'bad payload'); }
    const topic = String(req.headers['x-shopify-topic'] || '');
    // Answer inside Shopify's 5 second limit; the work continues after.
    send(res, 200, 'ok');
    if (topic === 'orders/create') {
      orders.onOrderCreated(payload).catch((e) => log('error', `orders/create failed: ${e.message}`));
    }
  }

  async function handlePayChainWebhook(req, res) {
    const raw = await readBody(req);
    if (!cfg.paychainWebhookSecret) return send(res, 503, 'webhook secret not configured');
    const expected = crypto.createHmac('sha256', cfg.paychainWebhookSecret).update(raw).digest('hex');
    if (!safeEqual(expected, req.headers['x-paychain-signature'])) { log('warning', 'PayChain webhook rejected: bad signature'); return send(res, 401, 'invalid signature'); }
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'bad payload'); }
    try {
      await orders.onPayChainEvent(event);
      return send(res, 200, 'ok');
    } catch (e) {
      // A 5xx makes PayChain retry later, which is what we want for a temporary Shopify problem.
      log('error', `PayChain webhook failed: ${e.message}`);
      return send(res, 500, 'try again');
    }
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (req.method === 'GET' && path === '/health') return send(res, 200, JSON.stringify({ ok: true, shop: cfg.shop, mode: cfg.mode }), 'application/json');
      if (req.method === 'POST' && path === '/webhooks/shopify') return await handleShopifyWebhook(req, res);
      if (req.method === 'POST' && path === '/webhooks/paychain') return await handlePayChainWebhook(req, res);
      if (path === '/pay' && req.method === 'GET') return await handlePay(req, res, url.searchParams);
      if (path === '/pay' && req.method === 'POST') {
        const body = (await readBody(req)).toString('utf8');
        return await handlePay(req, res, new URLSearchParams(body));
      }
      if (req.method === 'GET' && path === '/') return html(res, 200, layout('PayChain for Shopify', '<h1>PayChain for Shopify</h1><p>This service takes M-PESA payments for the store. Customers pay from the link in their order email.</p>', shopName));
      return send(res, 404, 'not found');
    } catch (e) {
      log('error', `${req.method} ${req.url?.split('?')[0]} failed: ${e.message}`);
      if (!res.headersSent) send(res, 500, 'server error');
    }
  });
}
