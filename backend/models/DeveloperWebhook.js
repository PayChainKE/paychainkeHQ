import mongoose from 'mongoose';

// A developer-registered HTTPS endpoint that PayChain pushes payment events
// to — what lets an integration (a CRM, an ISP's provisioning system, etc.)
// react to a collection or payout without polling GET /payments/:id.
// Unlike ApiKey.hashedKey, `secret` is intentionally NOT hashed: it isn't a
// credential presented back to PayChain to authenticate, it's used by
// PayChain itself to HMAC-sign every outbound delivery, so the server must
// be able to read it back on every attempt. It's still only ever shown to
// the developer once, at creation.
const developerWebhookSchema = new mongoose.Schema({
  developerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  secret: {
    type: String,
    required: true,
  },
  // Event types this endpoint wants delivered, or ['*'] for everything.
  // See webhookDeliveryService.js's WEBHOOK_EVENT_TYPES for the valid set.
  events: {
    type: [String],
    default: ['*'],
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true,
  },
  lastDeliveryAt: {
    type: Date,
    default: null,
  },
  lastDeliveryStatus: {
    type: String,
    enum: ['success', 'failed', null],
    default: null,
  },
}, {
  timestamps: true,
});

const DeveloperWebhook = mongoose.model('DeveloperWebhook', developerWebhookSchema);

export default DeveloperWebhook;
