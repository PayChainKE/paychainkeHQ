import mongoose from 'mongoose';

// Durable record of every real (non-simulated) SMS dispatch attempt via
// Africa's Talking — created at send time in utils/sms.js, later updated by
// the delivery-report webhook (controllers/smsController.js) once AT's
// SMSC confirms final status. Exists specifically so a delivery complaint
// ("M-Pesa's own SMS was instant, ours took 20+ minutes") can be escalated
// to Africa's Talking support with a concrete messageId instead of an
// approximate timestamp, and so we have our own visibility into whether a
// message that AT "accepted" ever actually reached the handset.
const smsLogSchema = new mongoose.Schema({
  to: { type: String, required: true },
  // Africa's Talking's own id for this specific message — the reference to
  // hand their support team. Null only if AT's response didn't include one
  // (shouldn't happen for a real, non-simulated send).
  messageId: { type: String, default: null, index: true },
  // AT's immediate per-recipient status from the send API call itself
  // ('Success' or a rejection reason like 'InvalidSenderId') — this is
  // "accepted for delivery," not a delivery confirmation.
  atStatus: { type: String, default: null },
  cost: { type: String, default: null },
  // 'queued' until the delivery-report webhook updates it (or forever, if
  // the webhook was never configured in AT's dashboard — see
  // controllers/smsController.js). 'rejected' means AT's send API itself
  // already refused the recipient, before any delivery attempt.
  deliveryStatus: {
    type: String,
    enum: ['queued', 'delivered', 'failed', 'rejected'],
    default: 'queued',
  },
  failureReason: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date, default: null },
}, { timestamps: true });

const SmsLog = mongoose.model('SmsLog', smsLogSchema);

export default SmsLog;
