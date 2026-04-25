import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

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
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Routes
app.use(['/api/auth', '/api/admin/auth'], authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('PayChainKE API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
