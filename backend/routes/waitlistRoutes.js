import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  joinWaitlist,
  getWaitlist,
  getWaitlistAnalytics,
  updateWaitlistStatus,
  toggleWaitlistPriority,
  updateWaitlistNotes,
  deleteWaitlistEntry,
  convertWaitlistEntry,
} from '../controllers/waitlistController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// 'analyst' is meant to be read-only (see adminRoutes.js's requireMutator/
// excludeOfficer split) — these mutating routes previously only checked
// `protect`, letting an analyst token edit/delete entries or convert one
// into a real merchant.
const requireMutator = requireRole('owner', 'admin');

// Public, unauthenticated, fires a confirmation email to an attacker-supplied
// address — same spam-relay risk as newsletterRoutes.js's subscribe, no
// dedicated throttle before this beyond the shared 600/15min global backstop.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});

// Public
router.post('/', joinLimiter, joinWaitlist);

// Admin — keep /analytics above /:id so Express doesn't treat "analytics" as :id.
router.get('/', protect, getWaitlist);
router.get('/analytics', protect, getWaitlistAnalytics);
router.put('/:id/status', protect, requireMutator, updateWaitlistStatus);
router.put('/:id/priority', protect, requireMutator, toggleWaitlistPriority);
router.put('/:id/notes', protect, requireMutator, updateWaitlistNotes);
router.post('/:id/convert', protect, requireMutator, convertWaitlistEntry);
router.delete('/:id', protect, requireMutator, deleteWaitlistEntry);

export default router;
