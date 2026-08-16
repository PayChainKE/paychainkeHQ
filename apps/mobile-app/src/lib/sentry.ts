import * as Sentry from '@sentry/react-native';

// No-ops until EXPO_PUBLIC_SENTRY_DSN is set — safe to import unconditionally.
// This wires up JS-level error/crash capture only. Full native crash
// symbolication additionally needs the "@sentry/react-native/expo" config
// plugin in app.json plus an EAS rebuild — deliberately not added here since
// it can't be verified without a real build; add it when ready to rebuild.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
  });
}

export default Sentry;
