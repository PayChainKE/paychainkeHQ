import mongoose from 'mongoose';

// The exactly-once ledger for automations that message or flag a specific
// subject (a merchant, an application, a phone number): "we already sent the
// day-3 tip to merchant X" is a row here. The unique (key, subjectId, stage)
// index is what makes the claim atomic — see services/automationEvents.js.
// Rows are kept (they double as an audit trail of what was sent to whom) and
// expire after a year so the collection can't grow without bound.
const AutomationEventSchema = new mongoose.Schema({
  key: { type: String, required: true },
  subjectId: { type: String, required: true },
  stage: { type: String, required: true },
  outcome: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  detail: { type: String, default: '', maxlength: 300 },
  at: { type: Date, default: Date.now },
}, { timestamps: false });

AutomationEventSchema.index({ key: 1, subjectId: 1, stage: 1 }, { unique: true });
AutomationEventSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AutomationEvent = mongoose.model('AutomationEvent', AutomationEventSchema);

export default AutomationEvent;
