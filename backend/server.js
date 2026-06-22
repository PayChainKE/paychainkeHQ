import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import bulkPayRoutes from './routes/bulkPayRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import mpesaRoutes from './routes/mpesaRoutes.js';

dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
const allowedOrigins = [
  'https://www.paychain.co.ke',
  'https://paychain.co.ke',
  'https://admin.paychain.co.ke',
  'https://demo.paychain.co.ke',
  'https://merchant.paychain.co.ke',
  'https://app.paychain.co.ke',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5000',
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200 // Some older browsers (IE11, various SmartTVs) choke on 204
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/bulkpay', bulkPayRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/mpesa', mpesaRoutes);

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
