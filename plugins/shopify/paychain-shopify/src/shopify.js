// Minimal Shopify Admin GraphQL client. Handles both ways an app can hold a
// token: a fixed Admin API access token, or the client-credentials exchange
// (client id + secret, token valid ~24 hours) used by apps made in the Shopify
// Dev Dashboard.

export class ShopifyError extends Error {}

export class Shopify {
  constructor(cfg, fetchImpl = fetch) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
    this.cached = null; // { token, expiresAt }
  }

  async token(force = false) {
    if (this.cfg.adminToken) return this.cfg.adminToken;
    if (!force && this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.token;
    const res = await this.fetch(`${this.cfg.shopifyApiBase}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) throw new ShopifyError(`Could not get a Shopify access token (HTTP ${res.status}). Check SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET, and that the app is installed on the store.`);
    this.cached = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 86_399) * 1000 };
    return this.cached.token;
  }

  async graphql(query, variables = {}, attempt = 0) {
    const url = `${this.cfg.shopifyApiBase}/admin/api/${this.cfg.shopifyApiVersion}/graphql.json`;
    const res = await this.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-shopify-access-token': await this.token() },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401 && attempt === 0 && !this.cfg.adminToken) { this.cached = null; await this.token(true); return this.graphql(query, variables, 1); }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return this.graphql(query, variables, attempt + 1);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new ShopifyError(`Shopify returned HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (check the token and that the app has the read_orders and write_orders scopes)' : ''}.`);
    if (json.errors?.length) {
      const throttled = json.errors.some((e) => e?.extensions?.code === 'THROTTLED');
      if (throttled && attempt < 2) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); return this.graphql(query, variables, attempt + 1); }
      throw new ShopifyError(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
    }
    return json.data;
  }

  /** Runs a mutation and throws if Shopify reports userErrors. */
  async mutate(query, variables, key) {
    const data = await this.graphql(query, variables);
    const errs = data?.[key]?.userErrors || [];
    if (errs.length) throw new ShopifyError(`Shopify refused ${key}: ${errs.map((e) => e.message).join('; ')}`);
    return data[key];
  }
}
