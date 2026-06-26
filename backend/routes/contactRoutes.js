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
} from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Throttle outbound replies — protects against accidental loops and abuse.
const replyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many replies. Slow down and try again later.' },
});

// Public form submission
router.post('/', createMessage);

// Admin
router.get('/', protect, getMessages);
router.patch('/:id/read', protect, markAsRead);
router.patch('/:id/unread', protect, markAsUnread);
router.patch('/:id/priority', protect, togglePriority);
router.patch('/:id/status', protect, updateStatus);
router.post('/:id/reply', protect, replyLimiter, replyToMessage);
router.delete('/:id', protect, deleteMessage);

export default router;
