import express from 'express';
import { generateToken, registerURLs, validationURL, confirmationURL } from '../controllers/mpesaController.js';

const router = express.Router();

// Route to register your public webhooks with Safaricom (Requires authentication/generateToken)
router.post('/register-urls', generateToken, registerURLs);

// Public webhook routes that Safaricom will ping
router.post('/validation', validationURL);
router.post('/confirmation', confirmationURL);

export default router;
