import dotenv from 'dotenv';
dotenv.config();

// Fail fast and loud rather than letting every JWT sign/verify call throw
// individually later (or worse — some jwt libraries silently accept an
// undefined secret). Every session token in the app (admin, merchant,
// developer) depends on this being set to a real value.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

// Imported before everything else so Sentry.init() runs (or safely no-ops)
// before any route module that might throw during its own module-load.
import Sentry from './utils/sentry.js';

// Catches crashes/rejections that never reach Express's own error handler
// (a throw inside a setInterval callback, an unhandled promise anywhere) —
// otherwise those currently only ever show up as a console.error nobody's
// watching. Reports to Sentry without changing Node's own default behavior
// for either event.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Registering this handler at all suppresses Node's normal "crash the
  // process" default — leaving it running after a truly uncaught exception
  // is explicitly unsafe (Node's own docs: do not resume normal operation).
  // Flush the report, then exit so Render/PM2 restarts into a clean state,
  // same outcome as before this handler existed, just with the error
  // reported first instead of silently lost in a log nobody's watching.
  Sentry.captureException(err);
  Sentry.close(2000).finally(() => process.exit(1));
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB, { isDbReady, startBackgroundDbRetry, disconnectDB } from './config/database.js';
import { requireDb } from './middleware/requireDb.js';
import authRoutes from './routes/authRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import bulkPayRoutes from './routes/bulkPayRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import mpesaRoutes from './routes/mpesaRoutes.js';
import trustScoreRoutes from './routes/trustScoreRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import cashAdvanceRoutes from './routes/cashAdvanceRoutes.js';
import ncbaRoutes from './routes/ncbaRoutes.js';
import merchantSmsAuthRoutes from './routes/merchantSmsAuthRoutes.js';
import officerRoutes from './routes/officerRoutes.js';
import smsRoutes from './routes/smsRoutes.js';
import developerRoutes from './routes/developerRoutes.js';
import developerPublicRoutes from './routes/developerPublicRoutes.js';
import publicCheckoutRoutes from './routes/publicCheckoutRoutes.js';
import etimsRoutes from './routes/etimsRoutes.js';
import { ensurePrimaryOwner } from './migrations/ensurePrimaryOwner.js';
import { backfillTransactionFees } from './migrations/backfillTransactionFees.js';
import { backfillNcbaMerchantCodes } from './migrations/backfillNcbaMerchantCodes.js';
import { checkAndSendDormancyReminders } from './services/dormancyReminderService.js';
import { runWeeklyRevenueSweepIfDue } from './services/revenueSweepService.js';
import { reconcileStuckOpenBankingPayouts } from './services/ncbaOpenBankingReconciliationService.js';
import { retryInsufficientFundsPayouts } from './services/ncbaPayoutRetryService.js';
import { processPendingWebhookDeliveries } from './services/webhookDeliveryService.js';

const allowedOrigins = [
  // Public marketing site
  'https://www.paychain.co.ke',
  'https://paychain.co.ke',
  // Admin console
  'https://www.admin.paychain.co.ke',
  'https://admin.paychain.co.ke',
  // Onboarding officer console
  'https://www.officer.paychain.co.ke',
  'https://officer.paychain.co.ke',
  // Merchant dashboard
  'https://www.app.paychain.co.ke',
  'https://app.paychain.co.ke',
  // Demo dashboard
  'https://www.demo.paychain.co.ke',
  'https://demo.paychain.co.ke',
  // Developer docs
  'https://developer.paychain.co.ke',
  // Hosted checkout — the actual page a customer's browser lands on
  // (checkout.paychain.co.ke/pay/:id) calls /api/public/checkout/* from
  // this origin.
  'https://checkout.paychain.co.ke',
  // Legacy alias (kept short-term so existing magic links still work)
  'https://merchant.paychain.co.ke',
  // Merchant dashboard's actual live Vercel deployment URL. Removed once
  // (thinking app.paychain.co.ke was the only real origin merchants hit)
  // and that broke real production logins immediately — Render's own logs
  // showed a wall of "CORS blocked for origin: https://apppaychain.vercel.app"
  // right as merchants tried to sign in. Whatever the long-term domain
  // story is, this origin is live production traffic right now. Do not
  // remove again without confirming app.paychain.co.ke is actually where
  // traffic is landing (e.g. check Vercel's domain config / DNS), not just
  // where it's supposed to.
  'https://apppaychain.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
];

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // Previously also allowed any origin containing "vercel.app" — that's a
    // substring match against every free/attacker-controlled Vercel deploy
    // on the planet, not just PayChain's own. Removed: allowedOrigins above
    // already covers every real PayChain frontend + local dev ports; add a
    // specific preview URL explicitly if one is ever needed again.
    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked for origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Client-Platform'],
  optionsSuccessStatus: 200,
}));

app.set('trust proxy', 1);

// This server only ever returns JSON (no HTML/templates are rendered or
// served here — every UI lives in the separate frontend apps), so a
// locked-down CSP costs nothing: default-src 'none' just formalizes that
// nothing on this origin should ever execute as a page.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 5mb to comfortably fit a base64-encoded multi-page statement PDF attachment
// (statement emailing uploads the already-generated PDF for Resend to send).
app.use(express.json({ limit: '5mb' }));

// Defense-in-depth against NoSQL operator injection (e.g. a client sending
// { email: { $ne: null } } instead of a string). No exploitable path was
// found in a full audit — Mongoose's own type-casting already rejects most
// of these against typed schema paths — but there's no systematic
// protection either. Deliberately not express-mongo-sanitize: that package
// tries to reassign req.query, which is getter-only in Express 5 and
// crashes the server; this only touches req.body, which stays mutable.
function stripMongoOperators(value) {
  if (Array.isArray(value)) {
    value.forEach(stripMongoOperators);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
        continue;
      }
      stripMongoOperators(value[key]);
    }
  }
  return value;
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') stripMongoOperators(req.body);
  next();
});

app.get('/', (req, res) => {
  res.send('PayChainKE API is running...');
});

// Unauthenticated liveness probe for external monitors (uptime pingers,
// bank infrastructure sweeps) — always 200 as long as the process can
// respond at all, even mid-Mongo-reconnect, so a transient DB blip doesn't
// read as "server down". `/api/health` below is the stricter readiness
// check for our own tooling and returns 503 when Mongo isn't connected.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: isDbReady() ? 'connected' : 'disconnected',
  });
});

app.get('/api/health', (req, res) => {
  const dbReady = isDbReady();
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    db: dbReady ? 'connected' : 'disconnected',
  });
});

// App-wide backstop rate limit — every sensitive endpoint already has its
// own tighter, purpose-built limiter (login, OTP, PIN, webhooks, etc.);
// this just guarantees a forgotten/new endpoint is never left with
// literally zero throttling. Generous enough not to interfere with normal
// merchant/admin usage or the 5s wallet-balance poll — this is a safety
// net, not the primary defense.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// All data routes require an active Mongo connection.
app.use('/api', requireDb);
app.use('/api/auth', authRoutes);
// New, additive SMS 2FA — independent of the email-OTP flow mounted above
// under /api/auth (routes/authRoutes.js). See routes/merchantSmsAuthRoutes.js.
app.use('/api/auth/merchant/sms', merchantSmsAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/bulkpay', bulkPayRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/callbacks', mpesaRoutes);
app.use('/api/callbacks/sms', smsRoutes);
app.use('/api/trust-score', trustScoreRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/cash-advance', cashAdvanceRoutes);
app.use('/api/developer', developerRoutes);
// KRA eTIMS OSCU fiscal integration — merchant-authenticated (protectMerchant),
// not the developer API key flow above. See routes/etimsRoutes.js.
app.use('/api/v1/etims', etimsRoutes);
// Kept separate from the /api/v1 NCBA mount above (different concern —
// public third-party API traffic vs. our own bank-rail integration).
app.use('/api/v1/developer', developerPublicRoutes);
// Backs the hosted checkout.paychain.co.ke page — unauthenticated by
// design (a browser on that page never has an API key), scoped entirely by
// the unguessable session id in the path. See publicCheckoutRoutes.js.
app.use('/api/public/checkout', publicCheckoutRoutes);
app.use('/api/v1', ncbaRoutes);

// Also served prefix-free — api.paychain.co.ke is a dedicated API subdomain
// (see root vercel.json), so NCBA's webhook and any other /v1 consumer hit
// this directly without an /api prefix. Same router, same requireDb gate,
// same handlers — just reachable at a second, shorter mount point.
app.use('/v1', requireDb);
app.use('/v1', ncbaRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  Sentry.captureException(err);
  // Full detail always goes server-side via console.error above. The
  // client only gets err.message in non-production — in prod a future
  // error whose .message happens to carry an internal detail (a raw DB
  // error string, etc.) shouldn't be handed back verbatim.
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected server error occurred'
    : (err.message || 'An unexpected server error occurred');
  res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 5000;

// Vercel sets VERCEL=1 in every deployment (production and preview). This
// file is invoked two different ways: `node server.js` as a traditional
// long-running process (local dev, Render/Railway/PM2), or imported by
// Vercel's Node runtime as a serverless function that calls the exported
// `app` directly per-request and never calls .listen(). Both paths need to
// come out of this same file — see the `export default app` below.
const isServerless = process.env.VERCEL === '1';

async function bootstrap() {
  try {
    await connectDB();
    await ensurePrimaryOwner();
    await backfillTransactionFees();
    await backfillNcbaMerchantCodes();
  } catch (error) {
    // Hard-exiting on a failed initial connection only makes sense for a
    // traditional long-running deploy — killing the process is meaningless
    // (and disruptive to co-located invocations) inside a shared serverless
    // runtime, so Vercel always falls through to the background-retry path.
    if (process.env.NODE_ENV === 'production' && !isServerless) {
      process.exit(1);
    }
    console.warn('⚠️ Starting API without Mongo — /api routes return 503 until connected');
    startBackgroundDbRetry();
  }

  if (isServerless) {
    return;
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    if (!isDbReady()) {
      console.warn('⚠️ MongoDB not connected — retrying in background');
    }
  });

  // Graceful shutdown — stop accepting new HTTP connections and close the
  // Mongo connection cleanly, so a Render redeploy (SIGTERM) doesn't leave
  // stale pooled connections sitting against the connection-count limit
  // until Atlas gets around to reaping them itself.
  //
  // disconnectDB() used to run inside server.close()'s callback, which only
  // fires once every open HTTP connection has fully closed — with every
  // merchant/admin/officer dashboard tab polling every 5s (see the
  // maxPoolSize comment in config/database.js), there's essentially always
  // a live keep-alive connection, so that callback would almost never fire
  // before the 9s force-exit timer won and process.exit(1) skipped
  // disconnectDB() entirely. Confirmed live: Atlas showed 395/500
  // connections on the free cluster despite this app never legitimately
  // needing more than ~20 at a time — the difference was stale sockets from
  // months of redeploys never actually closing. Running disconnectDB() in
  // parallel with server.close() (not nested inside its callback) means the
  // Mongo connection closes immediately regardless of lingering HTTP
  // traffic, well within the 9s budget.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n🛑 ${signal} received — closing HTTP server and MongoDB connection`);

    // Render kills the process shortly after SIGTERM regardless — don't let
    // a hung close() prevent exiting within that grace period.
    const forceExitTimer = setTimeout(() => {
      console.warn('⚠️ Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 9_000);
    forceExitTimer.unref();

    server.close(); // stop accepting new connections; don't block exit on existing ones draining

    disconnectDB()
      .then(() => console.log('✅ MongoDB connection closed'))
      .catch((err) => console.error('Error closing MongoDB connection:', err.message))
      .finally(() => {
        clearTimeout(forceExitTimer);
        process.exit(0);
      });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Daily dormancy-reminder sweep. Long-running-process only (the
  // `isServerless` early return above guarantees this line never runs
  // inside a per-request serverless invocation) — runs once at boot, then
  // once every 24h for as long as this process stays up.
  checkAndSendDormancyReminders();
  setInterval(checkAndSendDormancyReminders, 24 * 60 * 60 * 1000);

  // Weekly PayChain revenue sweep — checks daily, only actually attempts a
  // transfer on the configured weekday (PAYCHAIN_REVENUE_SWEEP_DAY, default
  // Monday), always to the single hardcoded destination account in
  // revenueSweepService.js's REVENUE_SWEEP_DESTINATION.
  runWeeklyRevenueSweepIfDue().catch((e) => console.error('Revenue sweep check failed:', e));
  setInterval(() => {
    runWeeklyRevenueSweepIfDue().catch((e) => console.error('Revenue sweep check failed:', e));
  }, 24 * 60 * 60 * 1000);

  // NCBA Open Banking async-rail reconciliation — Mobile B2W/Lipa na Mpesa/
  // KPLC/NCWSC payouts whose settlement callback never arrives would
  // otherwise sit 'pending' forever with the merchant's balance already
  // debited (see services/ncbaOpenBankingReconciliationService.js). Checks
  // every 5 minutes; a payout stuck past that service's own timeout gets
  // flagged pendingReason:'stuck_timeout_needs_manual_review', NOT
  // auto-refunded — NCBA's status-check endpoint is broken, so there's no
  // reliable way to confirm it actually failed before crediting it back.
  reconcileStuckOpenBankingPayouts().catch((e) => console.error('Open Banking reconciliation sweep failed:', e));
  setInterval(() => {
    reconcileStuckOpenBankingPayouts().catch((e) => console.error('Open Banking reconciliation sweep failed:', e));
  }, 5 * 60 * 1000);

  // NCBA B2C/B2B payout retry — a genuine "Insufficient Funds" rejection
  // (unlike the ambiguous case above) means nothing moved, so it's safe to
  // actively resubmit the same payout on the chance the pooled account has
  // picked up more real liquidity since. Same 5-minute cadence as the
  // reconciliation sweep above, and deliberately backs off before that
  // sweep's own 20-minute cutoff so a payout that never clears still ends
  // up refunded, just not endlessly retried. See ncbaPayoutRetryService.js.
  retryInsufficientFundsPayouts().catch((e) => console.error('NCBA payout retry sweep failed:', e));
  setInterval(() => {
    retryInsufficientFundsPayouts().catch((e) => console.error('NCBA payout retry sweep failed:', e));
  }, 5 * 60 * 1000);

  // Developer API webhook retry sweep — picks up deliveries whose backoff
  // window has elapsed (see webhookDeliveryService.js). Every minute is
  // frequent enough that the shortest retry delay (60s) isn't meaningfully
  // stretched out by the sweep's own cadence.
  processPendingWebhookDeliveries().catch((e) => console.error('Webhook delivery sweep failed:', e));
  setInterval(() => {
    processPendingWebhookDeliveries().catch((e) => console.error('Webhook delivery sweep failed:', e));
  }, 60 * 1000);
}

bootstrap();

// Vercel's Node.js runtime detects a default-exported Express app and wraps
// it as the request handler for this serverless function. Local/traditional
// deploys ignore this export entirely — they already got app.listen() above.
export default app;
