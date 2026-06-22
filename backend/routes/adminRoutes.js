import express from 'express';
import authRoutes from './authRoutes.js';
import { getMerchants, getMerchantAnalytics } from '../controllers/adminController.js';

const router = express.Router();

// Admin Auth Routes
router.use('/auth', authRoutes);

// Merchant Management Routes
router.get('/merchants', getMerchants);
router.get('/merchants/analytics', getMerchantAnalytics);

export default router;
