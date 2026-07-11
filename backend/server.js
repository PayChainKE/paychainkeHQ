import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import connectDB, { isDbReady, startBackgroundDbRetry } from './config/database.js';
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
import { ensurePrimaryOwner } from './migrations/ensurePrimaryOwner.js';
import { backfillTransactionFees } from './migrations/backfillTransactionFees.js';
import { backfillNcbaMerchantCodes } from './migrations/backfillNcbaMerchantCodes.js';

dotenv.config();

const allowedOrigins = [
  // Public marketing site
  'https://www.paychain.co.ke',
  'https://paychain.co.ke',
  // Admin console
  'https://www.admin.paychain.co.ke',
  'https://admin.paychain.co.ke',
  // Merchant dashboard
  'https://www.app.paychain.co.ke',
  'https://app.paychain.co.ke',
  // Demo dashboard
  'https://www.demo.paychain.co.ke',
  'https://demo.paychain.co.ke',
  // Legacy alias (kept short-term so existing magic links still work)
  'https://merchant.paychain.co.ke',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:8081',
];

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) || (origin && origin.includes('vercel.app'));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked for origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Client-Platform'],
  optionsSuccessStatus: 200,
}));

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 5mb to comfortably fit a base64-encoded multi-page statement PDF attachment
// (statement emailing uploads the already-generated PDF for Resend to send).
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.send('PayChainKE API is running...');
});

app.get('/api/health', (req, res) => {
  const dbReady = isDbReady();
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    db: dbReady ? 'connected' : 'disconnected',
  });
});

// All data routes require an active Mongo connection.
app.use('/api', requireDb);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/bulkpay', bulkPayRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/callbacks', mpesaRoutes);
app.use('/api/trust-score', trustScoreRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/cash-advance', cashAdvanceRoutes);
app.use('/api/v1', ncbaRoutes);

// Also served prefix-free — api.paychain.co.ke is a dedicated API subdomain
// (see root vercel.json), so NCBA's webhook and any other /v1 consumer hit
// this directly without an /api prefix. Same router, same requireDb gate,
// same handlers — just reachable at a second, shorter mount point.
app.use('/v1', requireDb);
app.use('/v1', ncbaRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    if (!isDbReady()) {
      console.warn('⚠️ MongoDB not connected — retrying in background');
    }
  });
}

bootstrap();

// Vercel's Node.js runtime detects a default-exported Express app and wraps
// it as the request handler for this serverless function. Local/traditional
// deploys ignore this export entirely — they already got app.listen() above.
export default app;
