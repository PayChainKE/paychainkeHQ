import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
  subscribe,
  getSubscribers,
  adminAddSubscriber,
  toggleSubscriber,
  deleteSubscriber,
  sendCampaign,
  getCampaigns,
  uploadNewsletterImage,
  listDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
} from '../controllers/newsletterController.js';
import { protect } from '../middleware/authMiddleware.js';

// Memory storage — the buffer is passed directly to Cloudinary's upload_stream.
// Raw bytes are never written to disk or to MongoDB.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max original
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    cb(null, ok.includes(file.mimetype));
  },
});

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

// Admin — keep /campaigns, /admin, and /drafts above /:id so Express
// doesn't treat them as ids.
router.get('/', protect, getSubscribers);
router.get('/campaigns', protect, getCampaigns);
router.get('/drafts', protect, listDrafts);
router.get('/drafts/:id', protect, getDraft);
router.post('/drafts', protect, saveDraft);
router.delete('/drafts/:id', protect, deleteDraft);
router.post('/admin', protect, adminAddSubscriber);
router.post('/upload-image', protect, imageUpload.single('image'), uploadNewsletterImage);
router.post('/send', protect, campaignLimiter, sendCampaign);
router.patch('/:id/toggle', protect, toggleSubscriber);
router.delete('/:id', protect, deleteSubscriber);

export default router;
