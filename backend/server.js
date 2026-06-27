import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import bulkPayRoutes from './routes/bulkPayRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import mpesaRoutes from './routes/mpesaRoutes.js';
import trustScoreRoutes from './routes/trustScoreRoutes.js';
import { ensurePrimaryOwner } from './migrations/ensurePrimaryOwner.js';

dotenv.config();

// Connect to Database, then run idempotent boot-time migrations. In dev we
// keep the process alive even if Mongo is unreachable (Atlas whitelist drift,
// VPN flap) so nodemon doesn't crash-loop — operator just fixes the IP and
// hits save to retry.
connectDB()
  .then(() => ensurePrimaryOwner())
  .catch(() => { /* error already printed with actionable hint in connectDB */ });

const app = express();

// Middleware
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

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || (origin && origin.includes('vercel.app'));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked for origin: ${origin}`);
      // Returning false instead of an Error prevents the CORS middleware from 
      // skipping the response headers, which helps avoid "No Access-Control-Allow-Origin" errors
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Client-Platform'],
  optionsSuccessStatus: 200 // Some older browsers (IE11, various SmartTVs) choke on 204
}));
// Trust Render's proxy so req.ip reflects the real client (needed for rate limiting).
app.set('trust proxy', 1);

// Security headers: HSTS, frame guard, no-sniff, referrer policy, XSS protections, etc.
app.use(helmet({
  // The admin/merchant dashboards live on different origins; CSP is enforced at
  // the frontend hosting layer (Vercel) so we keep the backend CSP off here to
  // avoid blocking cross-origin API responses.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/bulkpay', bulkPayRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/callbacks', mpesaRoutes);
app.use('/api/trust-score', trustScoreRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('PayChainKE API is running...');
});

// Global Error Handler to always return JSON (e.g. for Multer boundary errors)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
