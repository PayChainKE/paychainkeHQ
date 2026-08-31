import mongoose from 'mongoose';

// A real NCBA/KRA-side charge on the pooled account that isn't tied to any
// specific PayChain transfer — confirmed live via NCBA Connect Plus
// 2026-08-31: a recurring "Excise Duty" charge (~KES 10.80, almost every
// real transfer) — KRA's mandated tax on bank transaction fees under the
// Excise Duty Act, not an NCBA fee, and not something
// getNcbaChargeInquiry's lookup catches (that only reports NCBA's own
// service fee, e.g. confirmed KES 0 for IFT — the excise duty is a
// separate government-tax line NCBA posts automatically on top). Recorded
// here so services/revenueSweepService.js#computeUnsweptRevenue can
// subtract it from PayChain's own accrued revenue — same principle
// already applied to RevenueSweep.bankChargeAmount — so a real,
// unmodeled bank/tax cost is never mistaken for a discrepancy against
// merchant money.
const bankAccountChargeSchema = new mongoose.Schema({
  chargedAt: { type: Date, required: true }, // the real date NCBA posted it, per NCBA Connect Plus — not necessarily today
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, required: true, trim: true },
  reference: { type: String, default: null }, // NCBA's own reference/narrative from the statement, if any
  // 'auto_detected' — services/bankChargeReconciliationService.js's hourly
  // sweep found this directly on NCBA's real statement (a fee-type debit
  // line — Excise Duty, a commission, etc. — with no PayChain Transaction
  // behind it) and recorded it itself, same as an admin would via NCBA
  // Connect Plus. recordedBy is null for these — nobody manually entered it.
  source: { type: String, enum: ['manual', 'auto_detected'], default: 'manual' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  // "Clear" from the admin's list — same reversible-archive pattern as
  // RevenueSweep/BankReconciliation. Never touched by
  // computeUnsweptRevenue, which must keep subtracting every real charge
  // regardless of display state.
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, {
  timestamps: true,
});

export default mongoose.model('BankAccountCharge', bankAccountChargeSchema);
