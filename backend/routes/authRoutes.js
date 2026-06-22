import express from 'express';
import { login, verifyOTP } from '../controllers/authController.js';
import {
  registerMerchant,
  verifyMerchantOTP,
  loginMerchant,
  forgotPassword,
  resetPassword,
  changeMerchantPassword,
  getMerchantMe
} from '../controllers/merchantAuthController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

// Admin Auth Routes
router.post('/login', login);
router.post('/verify-otp', verifyOTP);

// Merchant Auth Routes
router.post('/merchant/register', upload.single('certificate'), registerMerchant);
router.post('/merchant/verify-otp', verifyMerchantOTP);
router.post('/merchant/login', loginMerchant);
router.post('/merchant/forgot-password', forgotPassword);
router.post('/merchant/reset-password', resetPassword);
router.put('/merchant/change-password', protectMerchant, changeMerchantPassword);
router.get('/merchant/me', protectMerchant, getMerchantMe);

export default router;
