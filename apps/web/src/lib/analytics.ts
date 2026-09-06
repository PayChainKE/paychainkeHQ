// Thin wrapper around the gtag.js loaded in index.html. gtag itself is
// defined by that inline script, not by this app's bundle, so it's declared
// here as an ambient global rather than imported.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Fires a GA4 page_view. index.html's initial gtag('config', ...) call has
// send_page_view disabled, so this is the only path a pageview ever goes
// through — called once on first mount and again on every client-side route
// change (see GoogleAnalyticsTracker.tsx), so both are counted exactly once.
export function trackPageview(path: string) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

// Fires an arbitrary GA4 event. Reserved for conversions GA's automatic
// tracking can't see on its own — a successful backend form submission, or
// a booking confirmed inside a third-party embed — since those never
// navigate or leave a trace of their own. Plain outbound links (Sign Up →
// app.paychain.co.ke, the WhatsApp button, etc.) don't need this: GA4's
// built-in Enhanced Measurement already tracks outbound clicks for every
// link on the site with zero code, as long as it's turned on for this
// property (Admin → Data Streams → your web stream → Enhanced measurement).
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
