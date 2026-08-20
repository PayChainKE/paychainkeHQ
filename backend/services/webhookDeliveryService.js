import crypto from 'crypto';
import axios from 'axios';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';

// The full set of events a developer can subscribe a webhook to. Enterprise
// integrations (a CRM syncing payment records, an ISP auto-reconnecting a
// subscriber) key off these to decide what to do next — 'succeeded' events
// are the ones that trigger real-world side effects like a reconnection.
export const WEBHOOK_EVENT_TYPES = [
  'payment.collect.succeeded',
  'payment.collect.failed',
  'payment.payout.succeeded',
  'payment.payout.failed',
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
