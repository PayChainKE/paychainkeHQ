import mongoose from 'mongoose';

// Category set mirrors the expense heads KRA's iTax "Statement of Income"
// return groups deductible business expenses under — keeping the enum aligned
// to that list means the CSV export can be handed straight to an accountant
// or dropped into iTax without relabeling anything.
export const EXPENSE_CATEGORIES = [
  'Salaries & Wages',
  'Rent & Utilities',
  'Software & Subscriptions',
  'Professional & Legal Fees',
  'Marketing & Advertising',
  'Travel & Transport',
  'Office Supplies & Equipment',
  'Bank & Transaction Charges',
  'Licenses & Permits',
  'Insurance',
  'Repairs & Maintenance',
  'Telephone & Internet',
  'Training & Development',
  'Depreciation',
  'Other',
];

export const PAYMENT_METHODS = ['M-Pesa', 'Bank Transfer', 'Cash', 'Card', 'Cheque', 'Other'];

const expenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    payee: { type: String, trim: true, maxlength: 150 },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'Bank Transfer' },
    // Receipt/invoice number — the paper trail KRA expects behind every claim.
    reference: { type: String, trim: true, maxlength: 100 },
    // The actual scanned receipt/invoice file (Cloudinary secure URL) —
    // complements `reference` above, which is just the human-readable
    // receipt number. Null until an admin uploads one.
    receiptUrl: { type: String, default: null },
    vatApplicable: { type: Boolean, default: false },
    vatAmount: { type: Number, default: 0, min: 0 },
    // Whether this expense qualifies as an allowable deduction under the
    // Income Tax Act — lets the P&L separate "spent" from "tax-deductible".
    deductible: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });

export default mongoose.model('Expense', expenseSchema);
