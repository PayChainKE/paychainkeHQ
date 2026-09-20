// Small client for the PayChain Developer API. Server to server only.

export class PayChain {
  constructor(cfg, fetchImpl = fetch) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    const res = await this.fetch(this.cfg.paychainBase + path, {
      method,
      headers: {
        authorization: `Bearer ${this.cfg.paychainKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'PayChain-Shopify/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  }

  ping() { return this.request('GET', '/api/v1/developer/ping'); }
  createCheckout(payload) { return this.request('POST', '/api/v1/developer/checkout', payload); }
  getCheckout(id) { return this.request('GET', `/api/v1/developer/checkout/${encodeURIComponent(id)}`); }
}
