import * as Sentry from '@sentry/react';

// No-ops until VITE_SENTRY_DSN is set — safe to import unconditionally.
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export default Sentry;
