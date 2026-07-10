import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitApplication, getMyApplications } from '../controllers/cashAdvanceController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Applications are infrequent and high-signal — throttle generously to stop
// accidental double-submits/scripted abuse without getting in a merchant's way.
const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many application attempts. Try again in a few minutes.' },
});

router.post('/apply', protectMerchant, applyLimiter, submitApplication);
router.get('/my-applications', protectMerchant, getMyApplications);

export default router;
