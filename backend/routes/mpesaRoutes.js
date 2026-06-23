import express from 'express';
import { generateToken, registerURLs, validationURL, confirmationURL, initiateSTKPush, stkCallback, getSTKStatus, initiateB2C, b2cCallback } from '../controllers/mpesaController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to register your public webhooks with Safaricom (Requires authentication/generateToken)
router.post('/register-urls', generateToken, registerURLs);

// Public webhook routes that Safaricom will ping
router.post('/validation', validationURL);
router.post('/confirmation', confirmationURL);

// STK Push Routes (Inbound)
router.post('/stk-push', protectMerchant, generateToken, initiateSTKPush);
router.post('/stk-callback', stkCallback); // Public webhook for Safaricom
router.get('/stk-status/:checkoutId', protectMerchant, getSTKStatus);

// B2C Routes (Outbound)
router.post('/b2c-request', protectMerchant, generateToken, initiateB2C);
router.post('/b2c-callback', b2cCallback); // Public webhook
router.post('/b2c-timeout', b2cCallback); // Timeout webhook

export default router;
