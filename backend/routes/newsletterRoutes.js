import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  subscribe,
  getSubscribers,
  adminAddSubscriber,
  toggleSubscriber,
  deleteSubscriber,
  sendCampaign,
  getCampaigns,
} from '../controllers/newsletterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Hard cap on send-campaign — sending blasts to every subscriber is heavy.
const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many campaign sends in the past hour. Wait before sending again.' },
});

// Public
router.post('/', subscribe);
router.post('/subscribe', subscribe);

// Admin — keep /campaigns and /admin above /:id so Express doesn't treat
// them as ids.
router.get('/', protect, getSubscribers);
router.get('/campaigns', protect, getCampaigns);
router.post('/admin', protect, adminAddSubscriber);
router.post('/send', protect, campaignLimiter, sendCampaign);
router.patch('/:id/toggle', protect, toggleSubscriber);
router.delete('/:id', protect, deleteSubscriber);

export default router;
