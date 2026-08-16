import express from 'express';
import rateLimit from 'express-rate-limit';
import { protectDeveloper } from '../middleware/authMiddleware.js';
import { logoutDeveloper } from '../controllers/developerAuthController.js';
import {
  getMe,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  requestLiveAccess,
} from '../controllers/developerController.js';
import {
  startMerchantLink,
  verifyMerchantLink,
  getMerchantLinkStatus,
} from '../controllers/developerMerchantLinkController.js';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
} from '../controllers/developerWebhookController.js';

const router = express.Router();

// Key creation/revocation are credential-issuing actions — same throttle
// shape as the PIN/password-change limiters elsewhere in this app.
const apiKeyActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API key actions. Try again in 15 minutes.' },
});

router.get('/me', protectDeveloper, getMe);
router.post('/logout', protectDeveloper, logoutDeveloper);

router.get('/api-keys', protectDeveloper, listApiKeys);
router.post('/api-keys', protectDeveloper, apiKeyActionLimiter, createApiKey);
router.patch('/api-keys/:id/revoke', protectDeveloper, apiKeyActionLimiter, revokeApiKey);

router.post('/live-access/request', protectDeveloper, requestLiveAccess);

// Linking proves control of a Merchant account (via that merchant's own
// email+password, then an OTP sent to the merchant's own inbox) before the
// payment endpoints can touch its wallet at all — see
// developerMerchantLinkController.js.
router.post('/link-merchant/start', protectDeveloper, apiKeyActionLimiter, startMerchantLink);
router.post('/link-merchant/verify', protectDeveloper, apiKeyActionLimiter, verifyMerchantLink);
router.get('/link-merchant/status', protectDeveloper, getMerchantLinkStatus);

// Webhooks — how integrations (CRM sync, ISP auto-reconnection systems,
// etc.) find out about a payment event without polling GET /payments/:id.
router.get('/webhooks', protectDeveloper, listWebhooks);
router.post('/webhooks', protectDeveloper, apiKeyActionLimiter, createWebhook);
router.patch('/webhooks/:id', protectDeveloper, apiKeyActionLimiter, updateWebhook);
router.delete('/webhooks/:id', protectDeveloper, apiKeyActionLimiter, deleteWebhook);
router.post('/webhooks/:id/test', protectDeveloper, apiKeyActionLimiter, testWebhook);
router.get('/webhooks/:id/deliveries', protectDeveloper, listWebhookDeliveries);

export default router;
