import crypto from 'crypto';
import axios from 'axios';
import Developer from '../models/Developer.js';
import { liveAccessFor } from '../utils/developerMerchants.js';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { assertPublicHttpsUrl } from '../utils/urlSsrfGuard.js';

// The full set of events a developer can subscribe a webhook to. Enterprise
// integrations (a CRM syncing payment records, an ISP auto-reconnecting a
// subscriber) key off these to decide what to do next — 'succeeded' events
// are the ones that trigger real-world side effects like a reconnection.
export const WEBHOOK_EVENT_TYPES = [
  'payment.collect.succeeded',
  'payment.collect.failed',
  'payment.payout.succeeded',
  'payment.payout.failed',
  // A customer paid the merchant's Paybill directly (not through an API
  // call). Sent to every approved developer linked to that merchant.
  'payment.paybill.received',
  'invoice.sent',
  'invoice.paid',
  'bulk_payment.completed',
];

const DELIVERY_TIMEOUT_MS = 10_000;

// How long to wait before each retry, indexed by attempts-already-made when
// a delivery fails (attempt 1 fails -> wait RETRY_DELAYS_MS[0], etc). Once
// attempts exceeds this list, the delivery is marked 'exhausted' rather than
// retried forever — an endpoint that's been down for 6+ hours needs a human
// to fix it, not an infinite queue.
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];

function signPayload(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function attemptDelivery(delivery, webhook) {
  const rawBody = JSON.stringify(delivery.payload);
  const signature = signPayload(webhook.secret, rawBody);

  let response = null;
  let networkError = null;
  try {
    // Re-checked on every single delivery attempt, not just at
    // registration (createWebhook/updateWebhook already call this too) —
    // a URL that resolved to a public IP when the developer registered it
    // can be repointed at an internal address (169.254.169.254, 127.0.0.1,
    // an RFC1918 range) at any later moment simply by changing that
    // domain's DNS record, since the developer controls it. Without
    // re-validating here, every subsequent real payment event would fire
    // an authenticated outbound POST from PayChain's own backend straight
    // at whatever that hostname now resolves to — a classic DNS-rebinding
    // SSRF, and the automatic retry schedule below would keep re-arming it
    // for hours. This call makes that structurally impossible: the
    // destination is re-resolved and re-checked immediately before every
    // attempt, registration-time validation alone was never enough.
    await assertPublicHttpsUrl(webhook.url);
    response = await axios.post(webhook.url, rawBody, {
      timeout: DELIVERY_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-PayChain-Event': delivery.event,
        'X-PayChain-Delivery-Id': String(delivery._id),
        // HMAC-SHA256 of the raw request body, hex-encoded — the receiver
        // recomputes this with their webhook secret to confirm the request
        // actually came from PayChain before acting on it (e.g. before an
        // ISP triggers a reconnection).
        'X-PayChain-Signature': signature,
      },
      // Classify 2xx/4xx/5xx ourselves below instead of letting axios throw
      // on non-2xx — a 4xx/5xx both mean "schedule a retry", just like a
      // network-level failure does.
      validateStatus: () => true,
      // Never follow redirects. assertPublicHttpsUrl above only vets the
      // registered URL; a public endpoint answering 302 → http://169.254.x.x
      // or an internal host would otherwise be followed unchecked (SSRF by
      // redirect). A 3xx simply counts as a failed attempt below.
      maxRedirects: 0,
    });
  } catch (err) {
    networkError = err;
  }

  delivery.attempts += 1;

  if (response && response.status >= 200 && response.status < 300) {
    delivery.status = 'success';
    delivery.lastResponseCode = response.status;
    delivery.lastError = null;
  } else {
    delivery.lastResponseCode = response ? response.status : null;
    delivery.lastError = response ? `HTTP ${response.status}` : (networkError?.message || 'Delivery failed.');
    const delay = RETRY_DELAYS_MS[delivery.attempts - 1];
    if (delay == null) {
      delivery.status = 'exhausted';
    } else {
      delivery.status = 'pending';
      delivery.nextAttemptAt = new Date(Date.now() + delay);
    }
  }

  await delivery.save();
  await DeveloperWebhook.updateOne(
    { _id: webhook._id },
    { $set: { lastDeliveryAt: new Date(), lastDeliveryStatus: delivery.status === 'success' ? 'success' : 'failed' } }
  );
}

// Fans an event out to every one of a developer's active webhooks subscribed
// to it — either explicitly listed or subscribed via '*'. Each subscriber
// gets its own delivery row and its own independent retry schedule, so one
// endpoint being down never delays or drops delivery to another. Never
// throws — a webhook subscriber's endpoint being broken must not affect the
// API response the triggering payment action already sent back.
export async function dispatchDeveloperEvent(developerId, event, data) {
  try {
    const webhooks = await DeveloperWebhook.find({ developerId, status: 'active' });
    const subscribed = webhooks.filter((w) => w.events.includes('*') || w.events.includes(event));
    if (subscribed.length === 0) return;

    await Promise.all(subscribed.map(async (webhook) => {
      const delivery = await WebhookDelivery.create({
        webhookId: webhook._id,
        developerId,
        event,
        payload: { id: crypto.randomUUID(), event, createdAt: new Date(), data },
      });
      await attemptDelivery(delivery, webhook);
    }));
  } catch (err) {
    console.error(`dispatchDeveloperEvent: failed to fan out '${event}' for developer ${developerId}:`, err?.message || err);
  }
}

// Tells every approved developer linked to `merchantId` that a customer paid
// that merchant's Paybill directly. Called once per credited payment (after a
// duplicate bank reference has already been rejected), fire-and-forget: it
// must never delay or fail the NCBA credit that triggered it. Only live
// developers get these — sandbox accounts have no real Paybill traffic.
export async function dispatchPaybillPaymentReceived(merchantId, payment) {
  try {
    const candidates = await Developer.find({
      $or: [{ 'linkedMerchants.merchantId': merchantId }, { 'linkedMerchant.merchantId': merchantId }],
      status: 'active',
    });
    // Live access is approved per merchant.
    const developers = candidates.filter((d) => liveAccessFor(d, merchantId).approved);
    await Promise.all(developers.map((d) => dispatchDeveloperEvent(d._id, 'payment.paybill.received', { payment })));
  } catch (err) {
    console.error(`dispatchPaybillPaymentReceived: failed for merchant ${merchantId}:`, err?.message || err);
  }
}

// Manual single-endpoint test ping, triggered from the developer dashboard
// ("Send test event") so an integration can be wired up and verified before
// any real payment traffic depends on it.
export async function sendTestWebhook(webhookId) {
  const webhook = await DeveloperWebhook.findById(webhookId);
  if (!webhook) throw new Error('Webhook not found.');

  const delivery = await WebhookDelivery.create({
    webhookId: webhook._id,
    developerId: webhook.developerId,
    event: 'webhook.test',
    payload: {
      id: crypto.randomUUID(),
      event: 'webhook.test',
      createdAt: new Date(),
      data: { message: 'This is a test event from PayChain.' },
    },
  });
  await attemptDelivery(delivery, webhook);
  return delivery;
}

// Re-sends an earlier delivery's exact payload (same event id, so a receiver
// that de-duplicates on it still recognises it) as a brand-new delivery with
// its own retry schedule. Used by the portal's "Resend" button: the usual
// reason is that the receiver was down or had a bug, and is fixed now.
export async function resendWebhookDelivery(originalId, developerId) {
  const original = await WebhookDelivery.findOne({ _id: originalId, developerId });
  if (!original) return { error: 'Delivery not found.', status: 404 };
  const webhook = await DeveloperWebhook.findOne({ _id: original.webhookId, developerId });
  if (!webhook) return { error: 'Webhook not found.', status: 404 };
  if (webhook.status !== 'active') return { error: 'This webhook is disabled. Enable it before resending.', status: 400 };

  const delivery = await WebhookDelivery.create({
    webhookId: webhook._id,
    developerId,
    event: original.event,
    payload: original.payload,
  });
  await attemptDelivery(delivery, webhook);
  return { delivery };
}

// Periodic sweep for deliveries whose retry window has arrived. Long-running
// process only — invoked once at boot then on a setInterval in server.js,
// the exact same shape as the dormancy-reminder/revenue-sweep/Open-Banking
// reconciliation sweeps already there.
export async function processPendingWebhookDeliveries() {
  const due = await WebhookDelivery.find({ status: 'pending', nextAttemptAt: { $lte: new Date() } }).limit(200);
  if (due.length === 0) return;

  const webhookIds = [...new Set(due.map((d) => String(d.webhookId)))];
  const webhooks = await DeveloperWebhook.find({ _id: { $in: webhookIds } });
  const webhookById = new Map(webhooks.map((w) => [String(w._id), w]));

  for (const delivery of due) {
    const webhook = webhookById.get(String(delivery.webhookId));
    if (!webhook || webhook.status !== 'active') {
      delivery.status = 'exhausted';
      delivery.lastError = 'Webhook endpoint is no longer active.';
      await delivery.save();
      continue;
    }
    await attemptDelivery(delivery, webhook);
  }
}
