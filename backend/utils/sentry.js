import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// ESM import declarations are hoisted above ordinary statements — server.js
// calling dotenv.config() textually before this import still runs it AFTER
// this module's top-level code, since both imports get hoisted together.
// Calling it again here (dotenv.config() is safe to call more than once)
// guarantees process.env is populated before the DSN is read below,
// regardless of import order in whatever file imports this one. Same
// defensive pattern utils/resend.js already uses for the same reason.
dotenv.config();

// No-ops entirely until SENTRY_DSN is set — safe to import unconditionally.
// Keeps local dev and any environment that hasn't configured a DSN yet
// exactly as before; error monitoring turns on the moment the env var is
// added, with no further code changes.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // 10% trace sampling — enough to see latency/error patterns on a
    // payments API without paying full-volume APM cost on every request.
    tracesSampleRate: 0.1,
  });
  console.log('✅ Sentry error monitoring enabled');
} else {
  console.log('ℹ️ SENTRY_DSN not set — error monitoring disabled');
}

export default Sentry;
