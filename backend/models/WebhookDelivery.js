import mongoose from 'mongoose';

// One row per (webhook endpoint, event) delivery attempt series — the audit
// trail a developer needs to debug "why didn't my CRM/reconnection system
// get notified" without PayChain support having to grep logs. Kept
// separate from DeveloperWebhook itself since one event fans out to
// multiple subscribers, each with its own independent retry schedule.
const webhookDeliverySchema = new mongoose.Schema({
  webhookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeveloperWebhook',
    required: true,
    index: true,
  },
  developerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true,
    index: true,
  },
  event: {
    type: String,
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'exhausted'],
    default: 'pending',
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  // When the retry sweep (processPendingWebhookDeliveries) should next pick
  // this up. Indexed alongside `status` since that's the exact query shape
  // the sweep runs every minute.
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastResponseCode: {
    type: Number,
    default: null,
  },
  lastError: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

const WebhookDelivery = mongoose.model('WebhookDelivery', webhookDeliverySchema);

export default WebhookDelivery;
