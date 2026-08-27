import TaxDeadline, { TAX_TYPES, RECURRENCES } from '../models/TaxDeadline.js';
import { nextOccurrence } from '../utils/taxDeadlines.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function decorate(deadline) {
  const due = nextOccurrence(deadline);
  const daysRemaining = due ? Math.round((due.getTime() - Date.now()) / MS_PER_DAY) : null;
  return { ...deadline, nextDueDate: due, daysRemaining };
}

function validateFields(body, { partial = false } = {}) {
  const { label, taxType, recurrence, dayOfMonth, annualMonth, annualDay, oneOffDate, reminderLeadDays, notes } = body || {};

  if (!partial || label !== undefined) {
    if (!label || !String(label).trim()) return 'A label is required.';
  }
  if (!partial || taxType !== undefined) {
    if (!TAX_TYPES.includes(taxType)) return 'Choose a valid tax type.';
  }
  if (!partial || recurrence !== undefined) {
    if (!RECURRENCES.includes(recurrence)) return 'Choose a valid recurrence.';
    if (recurrence === 'monthly' && !(Number(dayOfMonth) >= 1 && Number(dayOfMonth) <= 28)) {
      return 'A monthly deadline needs a day of month between 1 and 28.';
    }
    if (recurrence === 'annual' && !(Number(annualMonth) >= 1 && Number(annualMonth) <= 12 && Number(annualDay) >= 1 && Number(annualDay) <= 28)) {
      return 'An annual deadline needs a valid month (1-12) and day (1-28).';
    }
    if (recurrence === 'one_off' && (!oneOffDate || isNaN(new Date(oneOffDate)))) {
      return 'A one-off deadline needs a valid date.';
    }
  }
  if (reminderLeadDays !== undefined && !(Number(reminderLeadDays) >= 1 && Number(reminderLeadDays) <= 60)) {
    return 'Reminder lead time must be between 1 and 60 days.';
  }
  return null;
}

// @desc    List every active tax filing deadline, each decorated with its
//          computed next-due date and days-remaining (via the same
//          utils/taxDeadlines.js helper the reminder sweep uses, so the
//          calendar UI and the email trigger never disagree about timing).
// @route   GET /api/admin/tax-deadlines
// @access  Private (Admin)
export const listTaxDeadlines = async (req, res) => {
  try {
    const deadlines = await TaxDeadline.find({ active: true }).sort({ createdAt: 1 }).lean();
    const decorated = deadlines.map(decorate).sort((a, b) => (a.nextDueDate?.getTime() || 0) - (b.nextDueDate?.getTime() || 0));
    res.json({ success: true, data: decorated });
  } catch (error) {
    console.error('List Tax Deadlines Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create a new filing deadline.
// @route   POST /api/admin/tax-deadlines
// @access  Private (Admin, owner/admin only)
export const createTaxDeadline = async (req, res) => {
  try {
    const err = validateFields(req.body);
    if (err) return res.status(400).json({ error: err });

    const { label, taxType, recurrence, dayOfMonth, annualMonth, annualDay, oneOffDate, reminderLeadDays, notes } = req.body;
    const deadline = await TaxDeadline.create({
      label: String(label).trim(),
      taxType,
      recurrence,
      dayOfMonth: recurrence === 'monthly' ? Number(dayOfMonth) : null,
      annualMonth: recurrence === 'annual' ? Number(annualMonth) : null,
      annualDay: recurrence === 'annual' ? Number(annualDay) : null,
      oneOffDate: recurrence === 'one_off' ? new Date(oneOffDate) : null,
      reminderLeadDays: reminderLeadDays !== undefined ? Number(reminderLeadDays) : 7,
      notes: notes?.trim() || '',
      createdBy: req.admin?._id || null,
    });

    logAudit({
      action: 'admin.tax_deadline.created', category: 'admin', severity: 'info',
      message: `Added tax filing deadline — ${deadline.label} (${deadline.taxType})`,
      actor: adminActor(req.admin), req,
      metadata: { deadlineId: String(deadline._id) },
    });

    res.status(201).json({ success: true, data: decorate(deadline.toObject()) });
  } catch (error) {
    console.error('Create Tax Deadline Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update a filing deadline.
// @route   PUT /api/admin/tax-deadlines/:id
// @access  Private (Admin, owner/admin only)
export const updateTaxDeadline = async (req, res) => {
  try {
    const deadline = await TaxDeadline.findById(req.params.id);
    if (!deadline) return res.status(404).json({ error: 'Deadline not found.' });

    const err = validateFields(req.body, { partial: true });
    if (err) return res.status(400).json({ error: err });

    const { label, taxType, recurrence, dayOfMonth, annualMonth, annualDay, oneOffDate, reminderLeadDays, notes, active } = req.body;
    if (label !== undefined) deadline.label = String(label).trim();
    if (taxType !== undefined) deadline.taxType = taxType;
    if (recurrence !== undefined) {
      deadline.recurrence = recurrence;
      // Recurrence type changed — clear the fields that no longer apply so
      // stale values from a previous type can't leak into nextOccurrence's
      // math for the new one.
      deadline.dayOfMonth = recurrence === 'monthly' ? Number(dayOfMonth ?? deadline.dayOfMonth) : null;
      deadline.annualMonth = recurrence === 'annual' ? Number(annualMonth ?? deadline.annualMonth) : null;
      deadline.annualDay = recurrence === 'annual' ? Number(annualDay ?? deadline.annualDay) : null;
      deadline.oneOffDate = recurrence === 'one_off' ? new Date(oneOffDate ?? deadline.oneOffDate) : null;
      // A changed schedule invalidates any prior "already sent" marker —
      // otherwise editing a deadline's date could silently suppress the
      // very next reminder for the newly-configured occurrence.
      deadline.lastReminderSentForPeriod = null;
    } else {
      if (dayOfMonth !== undefined) deadline.dayOfMonth = Number(dayOfMonth);
      if (annualMonth !== undefined) deadline.annualMonth = Number(annualMonth);
      if (annualDay !== undefined) deadline.annualDay = Number(annualDay);
      if (oneOffDate !== undefined) deadline.oneOffDate = new Date(oneOffDate);
    }
    if (reminderLeadDays !== undefined) deadline.reminderLeadDays = Number(reminderLeadDays);
    if (notes !== undefined) deadline.notes = notes.trim();
    if (active !== undefined) deadline.active = !!active;

    await deadline.save();

    logAudit({
      action: 'admin.tax_deadline.updated', category: 'admin', severity: 'info',
      message: `Updated tax filing deadline — ${deadline.label}`,
      actor: adminActor(req.admin), req,
      metadata: { deadlineId: String(deadline._id) },
    });

    res.json({ success: true, data: decorate(deadline.toObject()) });
  } catch (error) {
    console.error('Update Tax Deadline Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Deactivate a filing deadline. Soft delete (active:false), not a
//          hard delete — preserves lastReminderSentForPeriod/audit history
//          rather than losing it, and the deadline is trivially
//          reactivatable via updateTaxDeadline if removed by mistake.
// @route   DELETE /api/admin/tax-deadlines/:id
// @access  Private (Admin, owner/admin only)
export const deleteTaxDeadline = async (req, res) => {
  try {
    const deadline = await TaxDeadline.findById(req.params.id);
    if (!deadline) return res.status(404).json({ error: 'Deadline not found.' });

    deadline.active = false;
    await deadline.save();

    logAudit({
      action: 'admin.tax_deadline.deactivated', category: 'admin', severity: 'info',
      message: `Deactivated tax filing deadline — ${deadline.label}`,
      actor: adminActor(req.admin), req,
      metadata: { deadlineId: String(deadline._id) },
    });

    res.json({ success: true, message: 'Deadline removed from the calendar.' });
  } catch (error) {
    console.error('Delete Tax Deadline Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
