import ApiKey from '../models/ApiKey.js';
import Merchant from '../models/Merchant.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import { initiateCollectPayment, CollectValidationError } from './developerCollectService.js';
import { sendTestWebhook } from './webhookDeliveryService.js';

// Matches developerCollectService.js's own SIMULATED_SETTLE_MS (4000) — a
// simulated test-mode collect flips 'pending' -> 'success' on that timer,
// so this must wait at least that long before re-reading the payment to
// report a real result instead of a premature 'pending'.
const COLLECT_TEST_WAIT_MS = 4500;

// Runs two live checks of a developer's integration — the same two things
// a real integration actually depends on:
//   1. A simulated test-mode collect resolves end-to-end (proves the
//      developer has a linked merchant, an active test API key, and the
//      collect pipeline genuinely works for their account) — zero real
//      money, same simulate path every test-mode API call already uses.
//   2. Every one of the developer's registered webhook endpoints actually
//      receives and acks a delivery (proves THEIR server is correctly
//      implemented, reachable, and returns 2xx).
// A developer with no registered webhook isn't treated as a failure —
// polling GET /payments/:id is a documented, valid alternative — but it's
// called out so whoever reads the result knows to expect that integration
// to poll rather than assume something's broken.
//
// Pure business logic — no req/res, no audit logging, no admin-actor
// assumptions. Called both by an admin manually re-checking (see
// developerAdminController.js#runIntegrationTest) and automatically the
// moment a developer requests live access (see
// developerController.js#requestLiveAccess), so both stay identical by
// construction instead of two hand-maintained copies drifting apart.
export async function runIntegrationTestForDeveloper(developer) {
  const merchantId = developer.linkedMerchant?.merchantId || null;
  const merchant = merchantId ? await Merchant.findById(merchantId).select('businessName status') : null;

  // ── Test 1: simulated collect ──────────────────────────────────────
  let collectTest;
  if (!merchantId || !merchant) {
    collectTest = { passed: false, message: 'No merchant account linked yet — complete /api/developer/link-merchant first.' };
  } else {
    const testKey = await ApiKey.findOne({ developerId: developer._id, mode: 'test', status: 'active' }).sort({ createdAt: -1 });
    if (!testKey) {
      collectTest = { passed: false, message: 'No active test-mode API key found — the developer needs to create one from their dashboard.' };
    } else {
      try {
        const idempotencyKey = `paychain-integration-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const payment = await initiateCollectPayment({
          developerId: developer._id,
          apiKeyId: testKey._id,
          merchantId,
          mode: 'test',
          amount: 10,
          phone: '0712345678',
          reference: 'paychain-integration-test',
          idempotencyKey,
        });
        await new Promise((resolve) => setTimeout(resolve, COLLECT_TEST_WAIT_MS));
        const settled = await DeveloperPayment.findById(payment._id);
        collectTest = settled?.status === 'success'
          ? { passed: true, message: 'Simulated test-mode collect resolved to success.', paymentId: settled._id }
          : { passed: false, message: `Simulated collect did not resolve to success (status: ${settled?.status || 'unknown'}).`, paymentId: settled?._id || null };
      } catch (err) {
        const message = err instanceof CollectValidationError ? err.message : (err.message || 'Unexpected error running the simulated collect.');
        collectTest = { passed: false, message };
      }
    }
  }

  // ── Test 2: webhook delivery ───────────────────────────────────────
  const webhooks = await DeveloperWebhook.find({ developerId: developer._id, status: 'active' });
  let webhookTests = [];
  if (webhooks.length > 0) {
    webhookTests = await Promise.all(webhooks.map(async (webhook) => {
      try {
        const delivery = await sendTestWebhook(webhook._id);
        return {
          webhookId: webhook._id,
          url: webhook.url,
          passed: delivery.status === 'success',
          responseCode: delivery.lastResponseCode,
          error: delivery.lastError,
        };
      } catch (err) {
        return { webhookId: webhook._id, url: webhook.url, passed: false, responseCode: null, error: err.message };
      }
    }));
  }

  return {
    merchant: merchant ? { _id: merchant._id, businessName: merchant.businessName, status: merchant.status } : null,
    collectTest,
    webhookTests,
    noWebhooksRegistered: webhooks.length === 0,
    ranAt: new Date(),
  };
}
