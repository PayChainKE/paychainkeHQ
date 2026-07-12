import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendMerchantSmsOtp, verifyMerchantSmsOtp } from '../controllers/merchantSmsAuthController.js';

const router = express.Router();

// 5 requests / 15 min / IP — each request triggers a real, billed Africa's
// Talking SMS, so this is deliberately tighter than the existing email-OTP
// limiters in routes/authRoutes.js (email sends are effectively free).
const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Try again in 15 minutes.' },
});

// Verify isn't billed, but still rate-limited to blunt 6-digit brute-forcing
// — same 10/15min shape as the existing adminOtpLimiter in authRoutes.js.
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Request a new code.' },
});

router.post('/send-otp', sendOtpLimiter, sendMerchantSmsOtp);
router.post('/verify-otp', verifyOtpLimiter, verifyMerchantSmsOtp);

export default router;
