import express from 'express';
import { getTrustScore } from '../controllers/trustScoreController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectMerchant, getTrustScore);

export default router;
