import express from 'express';
import { subscribe, getSubscribers } from '../controllers/newsletterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', subscribe);
router.post('/subscribe', subscribe);
router.get('/', protect, getSubscribers);

export default router;
