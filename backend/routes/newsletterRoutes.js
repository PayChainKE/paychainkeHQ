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
import { protect, requireRole } from '../middleware/authMiddleware.js';

// Memory storage — the buffer is passed directly to Cloudinary's upload_stream.
// Raw bytes are never written to disk or to MongoDB.
// SVG deliberately excluded: it can carry inline <script>/onload payloads,
// and if a returned Cloudinary URL is ever opened directly rather than
// rendered as an <img>, it executes as a same-origin document — stored XSS
// via file upload. The other formats here are pixel data, not markup.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max original
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, ok.includes(file.mimetype));
  },
});

const router = express.Router();

// 'analyst' is meant to be a read-only reporting tier (see
// middleware/authMiddleware.js's requireRole doc comment and adminRoutes.js's
// own requireMutator/excludeOfficer split) — this file previously gated every
// route with plain `protect`, so an analyst token could delete subscribers,
// blast a campaign, or upload newsletter images. Mirror adminRoutes.js's
// convention: mutations need owner/admin, reads may stay analyst-visible.
const requireMutator = requireRole('owner', 'admin');

// Hard cap on send-campaign — sending blasts to every subscriber is heavy.
const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many campaign sends in the past hour. Wait before sending again.' },
});

// Public, unauthenticated, fires a confirmation email to an attacker-supplied
// address on first signup — without a dedicated throttle this is a spam
// relay against arbitrary third parties, bounded only by the shared
// 600/15min global backstop. Same abuse shape merchantSmsAuthRoutes.js's
// tight limiter already guards against for SMS.
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});

// Public
router.post('/', subscribeLimiter, subscribe);
router.post('/subscribe', subscribeLimiter, subscribe);

// Admin — keep /campaigns, /admin, and /drafts above /:id so Express
// doesn't treat them as ids.
router.get('/', protect, getSubscribers);
router.get('/campaigns', protect, getCampaigns);
router.get('/drafts', protect, listDrafts);
router.get('/drafts/:id', protect, getDraft);
router.post('/drafts', protect, requireMutator, saveDraft);
router.delete('/drafts/:id', protect, requireMutator, deleteDraft);
router.post('/admin', protect, requireMutator, adminAddSubscriber);
router.post('/upload-image', protect, requireMutator, imageUpload.single('image'), uploadNewsletterImage);
router.post('/send', protect, requireMutator, campaignLimiter, sendCampaign);
router.patch('/:id/toggle', protect, requireMutator, toggleSubscriber);
router.delete('/:id', protect, requireMutator, deleteSubscriber);

export default router;
