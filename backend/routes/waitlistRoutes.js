import express from 'express';
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
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.post('/', joinWaitlist);

// Admin — keep /analytics above /:id so Express doesn't treat "analytics" as :id.
router.get('/', protect, getWaitlist);
router.get('/analytics', protect, getWaitlistAnalytics);
router.put('/:id/status', protect, updateWaitlistStatus);
router.put('/:id/priority', protect, toggleWaitlistPriority);
router.put('/:id/notes', protect, updateWaitlistNotes);
router.post('/:id/convert', protect, convertWaitlistEntry);
router.delete('/:id', protect, deleteWaitlistEntry);

export default router;
