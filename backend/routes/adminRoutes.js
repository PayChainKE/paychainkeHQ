import express from 'express';
import vpnGuard from '../middleware/vpnGuard.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

// Apply VPN Guard to all admin routes
router.use(vpnGuard);

// Admin Auth Routes
router.use('/auth', authRoutes);

// Add other admin-specific routes here as the project grows
// router.use('/dashboard', dashboardRoutes);

export default router;
