import express from 'express';
import { smsDeliveryReport } from '../controllers/smsController.js';

const router = express.Router();

// Africa's Talking POSTs delivery reports as application/x-www-form-urlencoded
// — scoped here rather than added to server.js's global middleware, since
// nothing else in the app needs form-body parsing.
router.post('/delivery-report', express.urlencoded({ extended: true }), smsDeliveryReport);

export default router;
