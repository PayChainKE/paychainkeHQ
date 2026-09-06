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
