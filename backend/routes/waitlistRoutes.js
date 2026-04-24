import express from 'express';
import { joinWaitlist, getWaitlist } from '../controllers/waitlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', joinWaitlist);
router.get('/', protect, getWaitlist);

export default router;
