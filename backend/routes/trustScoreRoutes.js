import express from 'express';
import { getTrustScore } from '../controllers/trustScoreController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getTrustScore);

export default router;
