import express from 'express';
import authRoutes from './authRoutes.js';

const router = express.Router();

// Admin Auth Routes
router.use('/auth', authRoutes);

// Add other admin-specific routes here as the project grows
// router.use('/dashboard', dashboardRoutes);

export default router;
