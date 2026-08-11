import express from 'express';
import { smsDeliveryReport } from '../controllers/smsController.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const router = express.Router();

// This route had no auth at all — Africa's Talking has no webhook signature
// scheme either, so the mitigation is the same shared-secret-in-the-URL
// pattern already used for Safaricom's callbacks (verifyMpesaWebhookSecret
// in mpesaRoutes.js): a secret query param we control by putting it in the
// URL registered on AT's dashboard. Worst case without this was low (an
// attacker who guesses/enumerates a real messageId could only flip its
// delivery status, not move money or read anything), but it's a free fix.
// Fails closed if unset, matching every other webhook in this app — set
// AT_DELIVERY_REPORT_SECRET and update the callback URL in the Africa's
// Talking dashboard to `.../delivery-report?key=<secret>` before deploying,
// or delivery-report tracking breaks until both are done.
function verifyAtDeliveryReportSecret(req, res, next) {
  const expected = process.env.AT_DELIVERY_REPORT_SECRET;
  if (!expected) {
    console.error(JSON.stringify({ level: 'error', event: 'at_delivery_report_auth_misconfigured' }));
    return res.status(500).json({ error: 'Webhook authentication is not configured' });
  }
  const provided = req.query.key;
  if (!provided || !timingSafeStringEqual(String(provided), expected)) {
    console.warn(JSON.stringify({ level: 'warn', event: 'at_delivery_report_auth_failed' }));
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

// Africa's Talking POSTs delivery reports as application/x-www-form-urlencoded
// — scoped here rather than added to server.js's global middleware, since
// nothing else in the app needs form-body parsing.
router.post('/delivery-report', verifyAtDeliveryReportSecret, express.urlencoded({ extended: true }), smsDeliveryReport);

export default router;
