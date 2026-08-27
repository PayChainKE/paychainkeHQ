import mongoose from 'mongoose';

// Admin-editable KRA filing deadlines that drive the Tax & Compliance
// calendar/countdown and the email reminder sweep
// (services/taxDeadlineReminderService.js). Deliberately NOT hardcoded
// rules baked into application logic — KRA's filing calendar can change,
// and PayChain's own obligations (VAT registration status, financial
// year-end) are facts only an admin/accountant can confirm, not something
// safe to assume in code.
export const TAX_TYPES = ['VAT', 'PAYE', 'Corporate Income Tax', 'Withholding Tax', 'Other'];
export const RECURRENCES = ['monthly', 'annual', 'one_off'];

const taxDeadlineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 150 },
    taxType: { type: String, enum: TAX_TYPES, required: true },
    recurrence: { type: String, enum: RECURRENCES, required: true },
    // monthly: day of month the return is due (e.g. 20 for VAT, 9 for PAYE).
    // Capped at 28 to avoid a "31st" deadline silently skipping short months.
    dayOfMonth: { type: Number, min: 1, max: 28, default: null },
    // annual: month (1-12) + day the return is due.
    annualMonth: { type: Number, min: 1, max: 12, default: null },
    annualDay: { type: Number, min: 1, max: 28, default: null },
    // one_off: an explicit date, for anything ad-hoc.
    oneOffDate: { type: Date, default: null },
    reminderLeadDays: { type: Number, default: 7, min: 1, max: 60 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    // Idempotency for the reminder sweep — the *period key* of the
    // occurrence a reminder was already sent for ("2026-08" for monthly,
    // "2026" for annual, the deadline's own id for one_off). Keyed by
    // calendar period (not a timestamp) so a fresh month/year automatically
    // re-arms the reminder with no manual reset.
    lastReminderSentForPeriod: { type: String, default: null },
  },
  { timestamps: true }
);

taxDeadlineSchema.index({ active: 1 });

export default mongoose.model('TaxDeadline', taxDeadlineSchema);
