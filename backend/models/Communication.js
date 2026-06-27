import mongoose from 'mongoose';

// Logs every inbound communication on the PayChain hotline / messaging
// numbers (calls, SMS, WhatsApp, voicemail). Records are typically created
// by webhook handlers from Twilio / Africa's Talking / Safaricom; the admin
// call-center page reads from this collection.

const NoteSchema = new mongoose.Schema({
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  authorEmail: { type: String, trim: true, lowercase: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const CommunicationSchema = new mongoose.Schema({
  channel: {
    type: String,
    required: true,
    enum: ['call', 'sms', 'whatsapp', 'voicemail'],
    index: true,
  },
  direction: {
    type: String,
    required: true,
    enum: ['inbound', 'outbound'],
    default: 'inbound',
    index: true,
  },
  fromNumber: { type: String, required: true, trim: true, index: true },
  toNumber:   { type: String, required: true, trim: true },

  // Best-effort identification of the contact. callerName / callerLabel set by
  // the provider; merchant linked via phone lookup at insert time.
  callerName: { type: String, default: null, trim: true },
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    default: null,
    index: true,
  },

  // Provider envelope. providerSid is the upstream record ID for replay.
  provider: { type: String, default: null, trim: true },
  providerSid: { type: String, default: null, trim: true, index: true },

  // Channel-specific payload. Calls store duration + recording; SMS/WhatsApp
  // store the message body and any attachments.
  durationSec: { type: Number, default: 0, min: 0 },
  recordingUrl: { type: String, default: null },
  body: { type: String, default: null, trim: true, maxlength: 4000 },
  attachments: { type: [String], default: [] },

  // Disposition for triage in the call-center pipeline.
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'missed', 'spam'],
    default: 'new',
    index: true,
  },
  priority: { type: Boolean, default: false, index: true },
  tags: { type: [String], default: [] },

  // Assignment + notes for collaborative handling.
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  notes: { type: [NoteSchema], default: [] },

  occurredAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

CommunicationSchema.index({ occurredAt: -1 });
CommunicationSchema.index({ channel: 1, status: 1 });

const Communication = mongoose.model('Communication', CommunicationSchema, 'communications');

export default Communication;
