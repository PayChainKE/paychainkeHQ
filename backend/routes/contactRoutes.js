import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createMessage,
  getMessages,
  markAsRead,
  markAsUnread,
  togglePriority,
  updateStatus,
  replyToMessage,
  deleteMessage,
  bulkDeleteMessages,
  getDeliveryStatus,
  uploadAttachment
} from '../controllers/contactController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

// 'analyst' is meant to be read-only (see adminRoutes.js's requireMutator/
// excludeOfficer split) — these mutating routes previously only checked
// `protect`, letting an analyst token delete messages or send outbound
// replies on PayChain's behalf.
const requireMutator = requireRole('owner', 'admin');

// Throttle outbound replies — protects against accidental loops and abuse.
const replyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many replies. Slow down and try again later.' },
});

// Public, unauthenticated form — same throttle as the sibling public forms
// (waitlist, newsletter), which had this and contact didn't; without it
// this was only covered by the 600/15min global IP backstop.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});

// Public form submission
router.post('/', submitLimiter, createMessage);

// Admin
router.get('/', protect, getMessages);
router.patch('/:id/read', protect, markAsRead);
router.patch('/:id/unread', protect, markAsUnread);
router.patch('/:id/priority', protect, requireMutator, togglePriority);
router.patch('/:id/status', protect, requireMutator, updateStatus);
router.post('/:id/reply', protect, requireMutator, replyLimiter, replyToMessage);
router.delete('/:id', protect, requireMutator, deleteMessage);
router.post('/bulk-delete', protect, requireMutator, bulkDeleteMessages);
router.get('/delivery-status/:resendId', protect, getDeliveryStatus);
router.post('/upload-attachment', protect, requireMutator, upload.single('file'), uploadAttachment);

export default router;
