// The whole flow, kept free of HTTP so it can be tested with fakes.
//
// State lives in Shopify itself, so the service needs no database:
//   tag  paychain-pending      order is waiting for its M-PESA payment
//   tag  paychain-paid         order was marked paid by this service
//   tag  paychain-underpaid / paychain-review / paychain-test-payment
//                              something a person should look at
//   metafield paychain.session_id   the PayChain checkout session for the order

const ORDER_FIELDS = `
  id name email phone displayFinancialStatus cancelledAt statusPageUrl createdAt
  paymentGatewayNames tags
  totalPriceSet { shopMoney { amount currencyCode } }
  billingAddress { phone firstName lastName }
  shippingAddress { phone }
  customer { phone firstName lastName }
  sessionMeta: metafield(namespace: "paychain", key: "session_id") { value }
`;

const Q_ORDER = `query($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`;
const Q_ORDERS = `query($q: String!, $n: Int!) { orders(first: $n, query: $q, sortKey: CREATED_AT) { nodes { ${ORDER_FIELDS} } } }`;
const M_TAGS_ADD = 'mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }';
const M_TAGS_REMOVE = 'mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }';
const M_META = 'mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }';
const M_PAID = 'mutation($id: ID!) { orderMarkAsPaid(input: { id: $id }) { order { id displayFinancialStatus } userErrors { message } } }';

const orderGid = (id) => `gid://shopify/Order/${id}`;
const numericId = (gid) => String(gid).split('/').pop();
const digits = (s) => String(s || '').replace(/\D/g, '');

// A per-key queue so a webhook and the sweeper can never both act on the same order.
class Locks {
  constructor() { this.tails = new Map(); }
  async run(key, fn) {
    const prev = this.tails.get(key) || Promise.resolve();
    let release;
    const mine = new Promise((r) => { release = r; });
    this.tails.set(key, prev.then(() => mine));
    await prev;
    try { return await fn(); } finally { release(); if (this.tails.get(key) === mine) this.tails.delete(key); }
  }
}

export class Orders {
  constructor({ cfg, shopify, paychain, log = () => {} }) {
    this.cfg = cfg;
    this.shopify = shopify;
    this.paychain = paychain;
    this.log = log;
    this.locks = new Locks();
  }

  /* ------------------------------------------------------------ helpers */

  reference(id) { return `SH-${this.cfg.shopSlug}-${id}`; }

  /** The Shopify order id inside one of our references, or null. */
  parseReference(ref) {
    const prefix = `SH-${this.cfg.shopSlug}-`;
    const s = String(ref || '');
    if (!s.startsWith(prefix)) return null;
    const rest = s.slice(prefix.length);
    return /^\d+$/.test(rest) ? rest : null;
  }

  matchesMethod(names) {
    return (names || []).some((n) => String(n).toLowerCase().includes(this.cfg.methodMatch));
  }

  shape(o) {
    if (!o) return null;
    const money = o.totalPriceSet?.shopMoney || {};
    const phones = [o.phone, o.billingAddress?.phone, o.shippingAddress?.phone, o.customer?.phone].filter(Boolean);
    const name = [o.billingAddress?.firstName || o.customer?.firstName, o.billingAddress?.lastName || o.customer?.lastName].filter(Boolean).join(' ');
    return {
      gid: o.id,
      id: numericId(o.id),
      name: o.name,
      email: o.email || null,
      phones,
      customerName: name || null,
      status: o.displayFinancialStatus, // PENDING, PAID, ...
      cancelled: Boolean(o.cancelledAt),
      statusPageUrl: o.statusPageUrl || null,
      gateways: o.paymentGatewayNames || [],
      tags: o.tags || [],
      currency: money.currencyCode,
      total: Number(money.amount),
      sessionId: o.sessionMeta?.value || null,
    };
  }

  async getOrder(gid) {
    const data = await this.shopify.graphql(Q_ORDER, { id: gid });
    return this.shape(data.order);
  }

  /** Finds an order by the number a customer sees, e.g. "1001" or "#1001". */
  async findOrderByName(input) {
    const wanted = String(input || '').replace(/[#\s]/g, '').toLowerCase();
    if (!wanted || wanted.length > 40 || !/^[a-z0-9-]+$/.test(wanted)) return null;
    const data = await this.shopify.graphql(Q_ORDERS, { q: `name:${wanted}`, n: 5 });
    const hit = (data.orders?.nodes || []).find((o) => String(o.name).replace(/[#\s]/g, '').toLowerCase() === wanted);
    return this.shape(hit);
  }

  /** True when what the customer typed matches the order's email or one of its phone numbers. */
  identityMatches(order, given) {
    const g = String(given || '').trim().toLowerCase();
    if (!g) return false;
    if (g.includes('@')) return Boolean(order.email) && order.email.toLowerCase() === g;
    const d = digits(g);
    if (d.length < 9) return false;
    return order.phones.some((p) => digits(p).slice(-9) === d.slice(-9));
  }

  addTags(gid, tags) { return this.shopify.mutate(M_TAGS_ADD, { id: gid, tags }, 'tagsAdd'); }
  removeTags(gid, tags) { return this.shopify.mutate(M_TAGS_REMOVE, { id: gid, tags }, 'tagsRemove'); }
  setMeta(gid, key, value) {
    return this.shopify.mutate(M_META, { m: [{ ownerId: gid, namespace: 'paychain', key, type: 'single_line_text_field', value: String(value).slice(0, 250) }] }, 'metafieldsSet');
  }

  /* ------------------------------------------------- Shopify: new order */

  /** orders/create webhook. Only tags the order; the payment session is made when the customer asks to pay. */
  async onOrderCreated(payload) {
    if (!this.matchesMethod(payload.payment_gateway_names)) return { ignored: 'not an M-PESA order' };
    if (String(payload.financial_status || '').toLowerCase() !== 'pending') return { ignored: 'not awaiting payment' };
    const gid = payload.admin_graphql_api_id || orderGid(payload.id);
    await this.addTags(gid, ['paychain-pending']);
    this.log('info', `Order ${payload.name} is waiting for M-PESA payment`);
    return { tagged: true };
  }

  /* --------------------------------------------------- customer pays */

  /**
   * Returns { paid: true } or { url } for the customer to open, or { error }
   * with a reason code the page turns into a friendly message.
   */
  async checkoutFor(order) {
    return this.locks.run(`co-${order.id}`, async () => {
      if (order.status === 'PAID') return { paid: true };
      if (order.cancelled) return { error: 'cancelled' };
      if (order.currency !== 'KES') return { error: 'currency' };
      if (!this.matchesMethod(order.gateways)) return { error: 'not_mpesa' };
      const amount = Math.ceil(order.total);
      if (!(amount >= 1)) return { error: 'amount' };
      const reference = this.reference(order.id);

      if (order.sessionId) {
        const r = await this.paychain.getCheckout(order.sessionId).catch(() => null);
        const s = r && r.status === 200 ? r.body?.session : null;
        if (s && s.reference === reference) {
          if (s.status === 'success') {
            const done = await this.complete(order.id, { id: s.id, amount: s.amount, mode: s.mode }, 'status check', true);
            return done.paid ? { paid: true } : { error: 'review' };
          }
          const live = s.status === 'pending' || s.status === 'processing';
          if (live && s.amount === amount && s.checkoutUrl && new Date(s.expiresAt).getTime() > Date.now() + 2 * 60_000) return { url: s.checkoutUrl };
        }
      }

      const payload = {
        amount,
        reference,
        description: `Order ${order.name} at ${this.cfg.shop}`.slice(0, 200),
        expiresInMinutes: this.cfg.sessionTtlMinutes,
      };
      const customer = {};
      if (order.phones[0]) customer.phone = order.phones[0].replace(/[^\d+]/g, '');
      if (order.email) customer.email = order.email;
      if (order.customerName) customer.name = order.customerName;
      if (Object.keys(customer).length) payload.customer = customer;
      if (order.statusPageUrl && order.statusPageUrl.startsWith('https://')) payload.callbackUrl = order.statusPageUrl;

      const res = await this.paychain.createCheckout(payload).catch((e) => { this.log('error', `PayChain request failed for order ${order.name}: ${e.message}`); return null; });
      const session = res && res.status === 201 ? res.body?.session : null;
      if (!session?.checkoutUrl || !session.id) {
        if (res) this.log('error', `PayChain refused the checkout for order ${order.name}: HTTP ${res.status} ${res.body?.error || ''}`);
        return { error: 'unavailable' };
      }
      try {
        await this.setMeta(order.gid, 'session_id', session.id);
        await this.addTags(order.gid, ['paychain-pending']);
      } catch (e) {
        this.log('warning', `Could not record the session on order ${order.name}: ${e.message}`);
      }
      this.log('info', `Order ${order.name} sent to PayChain checkout ${session.id}`);
      return { url: session.checkoutUrl };
    });
  }

  /* ------------------------------------------------------ payment done */

  /**
   * Marks the order paid, once, after checking it. Called from the PayChain
   * webhook, the sweeper and the pay page. `payment` = { id, amount, mode }.
   * Returns { paid } (true once Shopify shows it paid) and a reason if not.
   */
  async complete(orderId, payment, source, alreadyLocked = false) {
    const run = async () => {
      const order = await this.getOrder(orderGid(orderId));
      if (!order) return { paid: false, reason: 'order not found' };
      if (!this.matchesMethod(order.gateways)) return { paid: false, reason: 'not an M-PESA order' };
      if (order.status === 'PAID') {
        if (order.tags.includes('paychain-pending')) await this.removeTags(order.gid, ['paychain-pending']).catch(() => {});
        return { paid: true };
      }
      if (order.cancelled) {
        await this.addTags(order.gid, ['paychain-review']);
        this.log('warning', `Order ${order.name} was cancelled but a payment arrived (${payment.id}). Refund or reinstate it.`);
        return { paid: false, reason: 'order cancelled' };
      }
      if (order.currency !== 'KES') {
        await this.addTags(order.gid, ['paychain-review']);
        return { paid: false, reason: 'store currency is not KES' };
      }
      const expected = Math.ceil(order.total);
      const paidAmount = Math.round(Number(payment.amount) || 0);
      if (paidAmount < expected) {
        await this.addTags(order.gid, ['paychain-underpaid']);
        await this.setMeta(order.gid, 'note', `PayChain reports KES ${paidAmount} but the order needs KES ${expected}. Not marked paid.`).catch(() => {});
        this.log('warning', `Underpayment on order ${order.name}: paid ${paidAmount}, needs ${expected}`);
        return { paid: false, reason: 'underpaid' };
      }
      if (payment.mode === 'test' && !this.cfg.testPaymentsMarkPaid) {
        await this.addTags(order.gid, ['paychain-test-payment']);
        await this.removeTags(order.gid, ['paychain-pending']).catch(() => {});
        this.log('info', `Order ${order.name}: a TEST payment succeeded. Left unpaid (set TEST_PAYMENTS_MARK_PAID=1 to mark test payments paid).`);
        return { paid: false, reason: 'test payment' };
      }
      try {
        await this.shopify.mutate(M_PAID, { id: order.gid }, 'orderMarkAsPaid');
      } catch (e) {
        const again = await this.getOrder(order.gid);
        if (again?.status !== 'PAID') throw e; // someone else marked it paid a moment ago: fine
      }
      await this.setMeta(order.gid, 'payment_id', payment.id || '').catch(() => {});
      await this.addTags(order.gid, ['paychain-paid']).catch(() => {});
      await this.removeTags(order.gid, ['paychain-pending']).catch(() => {});
      this.log('info', `Order ${order.name} marked paid (${source}), PayChain payment ${payment.id}`);
      return { paid: true };
    };
    return alreadyLocked ? run() : this.locks.run(`co-${orderId}`, run);
  }

  /** PayChain webhook body, already signature-checked. */
  async onPayChainEvent(event) {
    const name = String(event?.event || '');
    if (name === 'webhook.test') return { ok: true };
    const payment = event?.data?.payment;
    if (!payment || !name.startsWith('payment.collect.')) return { ignored: true };
    if (payment.origin === 'admin_test') return { ignored: true };
    const orderId = this.parseReference(payment.reference);
    if (!orderId) return { ignored: true }; // another store's, or not from here
    if (name === 'payment.collect.succeeded' && payment.status === 'success') {
      return this.complete(orderId, payment, 'webhook');
    }
    if (name === 'payment.collect.failed') {
      this.log('info', `A payment attempt failed for order ${payment.reference}: ${payment.failureReason || 'cancelled or timed out'}`);
    }
    return { ok: true };
  }

  /** Every few minutes: orders still waiting are checked directly, so a lost webhook never strands one. */
  async sweep() {
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const data = await this.shopify.graphql(Q_ORDERS, { q: `tag:paychain-pending financial_status:pending created_at:>=${since}`, n: 25 });
    let completed = 0;
    for (const node of data.orders?.nodes || []) {
      const order = this.shape(node);
      if (!order.sessionId) continue;
      const r = await this.paychain.getCheckout(order.sessionId).catch(() => null);
      const s = r && r.status === 200 ? r.body?.session : null;
      if (s?.status === 'success' && s.reference === this.reference(order.id)) {
        const out = await this.complete(order.id, { id: s.id, amount: s.amount, mode: s.mode }, 'status check');
        if (out.paid) completed++;
      }
    }
    return { checked: (data.orders?.nodes || []).length, completed };
  }
}
