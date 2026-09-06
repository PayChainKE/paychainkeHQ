import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from '@/lib/analytics';

// This is a client-side-routed SPA — a route change never reloads the page,
// so GA's own automatic pageview tracking only ever sees the first URL a
// visitor lands on. This fires a page_view on that first render too (not
// just subsequent navigations), matching send_page_view: false in
// index.html's gtag config.
const GoogleAnalyticsTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
};

export default GoogleAnalyticsTracker;
