// Canonical origin for links a customer might click (payment links) —
// mirrors the merchant-dashboard's own getAppUrl() convention (same
// env-override-then-prod-default idea, adapted to this app's existing
// __DEV__-based convention in api/config.ts, since there's no
// window.location here). In dev this points at the local merchant-
// dashboard dev server (Vite's default port) instead of unconditionally
// hardcoding the production domain, so a link generated while testing
// against a local/staging backend doesn't silently point at prod.
export function getAppUrl(): string {
  if (__DEV__) return 'http://localhost:5173';
  return 'https://app.paychain.co.ke';
}
