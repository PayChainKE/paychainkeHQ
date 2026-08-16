import crypto from 'crypto';
import DeveloperWebhook from '../models/DeveloperWebhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { WEBHOOK_EVENT_TYPES, sendTestWebhook } from '../services/webhookDeliveryService.js';
import { logAudit } from '../utils/auditLog.js';

const publicWebhook = (w) => ({
  _id: w._id,
  url: w.url,
  events: w.events,
  status: w.status,
  lastDeliveryAt: w.lastDeliveryAt,
  lastDeliveryStatus: w.lastDeliveryStatus,
  createdAt: w.createdAt,
});

function parseEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const filtered = events.filter((e) => e === '*' || WEBHOOK_EVENT_TYPES.includes(e));
  return filtered.length > 0 ? filtered : null;
}

// @desc    List this developer's registered webhook endpoints
// @route   GET /api/developer/webhooks
// @access  Private (Developer)
export const listWebhooks = async (req, res) => {
  try {
    const webhooks = await DeveloperWebhook.find({ developerId: req.developer._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: webhooks.map(publicWebhook), availableEvents: WEBHOOK_EVENT_TYPES });
  } catch (error) {
    console.error('List Webhooks Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Register a new webhook endpoint (secret shown once, in this response only)
// @route   POST /api/developer/webhooks
// @access  Private (Developer)
export const createWebhook = async (req, res) => {
  try {
    const { url, events } = req.body || {};
    if (!url || typeof url !== 'string' || !/^https:\/\//.test(url.trim())) {
      return res.status(400).json({ error: 'A valid https:// url is required.' });
    }

    const selectedEvents = parseEvents(events) || ['*'];
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const webhook = await DeveloperWebhook.create({
      developerId: req.developer._id,
      url: url.trim(),
      events: selectedEvents,
      secret,
    });

    logAudit({
      action: 'developer.webhook.created', category: 'security', severity: 'info',
      message: 'Registered a webhook endpoint',
      req, actor: { type: 'self', id: req.developer._id, email: req.developer.email, name: req.developer.name },
      metadata: { webhookId: String(webhook._id), url: webhook.url, events: selectedEvents },
    });

    // The only point the signing secret is ever returned — kept server-side
    // to sign every future delivery, never displayed again after this.
    res.status(201).json({ success: true, webhook: { ...publicWebhook(webhook), secret } });
  } catch (error) {
    console.error('Create Webhook Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update a webhook's url, subscribed events, or active/disabled status
// @route   PATCH /api/developer/webhooks/:id
// @access  Private (Developer)
export const updateWebhook = async (req, res) => {
  try {
    const webhook = await DeveloperWebhook.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found.' });

    const { url, events, status } = req.body || {};

    if (url !== undefined) {
      if (typeof url !== 'string' || !/^https:\/\//.test(url.trim())) {
        return res.status(400).json({ error: 'A valid https:// url is required.' });
      }
      webhook.url = url.trim();
    }

    if (events !== undefined) {
      const selectedEvents = parseEvents(events);
      if (!selectedEvents) return res.status(400).json({ error: 'events must contain at least one valid event type or "*".' });
      webhook.events = selectedEvents;
    }

    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) return res.status(400).json({ error: 'status must be "active" or "disabled".' });
      webhook.status = status;
    }

    await webhook.save();
    res.json({ success: true, webhook: publicWebhook(webhook) });
  } catch (error) {
    console.error('Update Webhook Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Remove a webhook endpoint
// @route   DELETE /api/developer/webhooks/:id
// @access  Private (Developer)
export const deleteWebhook = async (req, res) => {
  try {
    const webhook = await DeveloperWebhook.findOneAndDelete({ _id: req.params.id, developerId: req.developer._id });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Webhook Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a one-off test event to a webhook so a developer can verify
//          their integration is wired up correctly before it depends on
//          real payment traffic.
// @route   POST /api/developer/webhooks/:id/test
// @access  Private (Developer)
export const testWebhook = async (req, res) => {
  try {
    const webhook = await DeveloperWebhook.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found.' });

    const delivery = await sendTestWebhook(webhook._id);
    res.json({
      success: true,
      delivery: {
        _id: delivery._id,
        status: delivery.status,
        lastResponseCode: delivery.lastResponseCode,
        lastError: delivery.lastError,
      },
    });
  } catch (error) {
    console.error('Test Webhook Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Recent delivery attempts for a webhook — lets a developer debug
//          why an integration isn't seeing events (wrong URL, endpoint
//          rejecting the request, signature mismatch, etc).
// @route   GET /api/developer/webhooks/:id/deliveries
// @access  Private (Developer)
export const listWebhookDeliveries = async (req, res) => {
  try {
    const webhook = await DeveloperWebhook.findOne({ _id: req.params.id, developerId: req.developer._id });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found.' });

    const deliveries = await WebhookDelivery.find({ webhookId: webhook._id }).sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      data: deliveries.map((d) => ({
        _id: d._id,
        event: d.event,
        status: d.status,
        attempts: d.attempts,
        lastResponseCode: d.lastResponseCode,
        lastError: d.lastError,
        nextAttemptAt: d.nextAttemptAt,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    console.error('List Webhook Deliveries Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
