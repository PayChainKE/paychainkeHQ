// Canonical origin to embed in anything a customer might see or click
// (payment links, QR codes) — deliberately NOT window.location.origin.
// The merchant dashboard is reachable from more than one real hostname
// (the app.paychain.co.ke custom domain AND the raw Vercel deployment URL,
// both allow-listed in backend/server.js's CORS config), so building links
// from window.location.origin means a merchant browsing via the Vercel URL
// generates links that show that Vercel URL instead of the official domain.
// Mirrors the VITE_APP_URL-less convention already used for the API base
// in src/api/config.js, and the backend's MERCHANT_DASHBOARD_URL env var
// (see backend/.env.example) — same default, so links match on both sides.
export function getAppUrl() {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return window.location.origin; // local dev — link back to the dev server itself
  }

  return 'https://app.paychain.co.ke';
}
