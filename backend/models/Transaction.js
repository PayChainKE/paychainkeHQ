import mongoose from 'mongoose';
import { calculateFees } from '../utils/feeCalculator.js';

const transactionSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: false
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number (till) is required'],
  },
  type: {
    type: String,
    enum: ['inbound', 'outbound', 'bulk_pay', 'settlement', 'fx_swap'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  kesAmount: {
    type: Number,
    default: 0
  },
  usdcAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'verified'],
    default: 'completed'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  sender: {
    name: String,
    id: String // e.g. Phone number
  },
  recipient: {
    name: String,
    id: String
  },
  // Per-transaction fee fields, auto-stamped at save time from the canonical
  // rate card. Persisting these (rather than always re-computing at query
  // time) means: (1) historical revenue is locked-in even if rates change,
  // (2) every PayChain account has a row-level audit trail of what was
  // charged, (3) downstream settlement systems can debit/credit directly
  // from these numbers without re-deriving them.
  paychainFee:  { type: Number, default: 0 },
  safaricomFee: { type: Number, default: 0 },
  revenueStream: { type: String, default: null },
}, {
  timestamps: true
});

// Auto-price every transaction on insert. Runs for both `Transaction.create`
// and `new Transaction().save()`. We re-stamp on amount/type change because
// admins may correct a transaction before it's finalised, but never re-stamp
// once the doc is saved (`isNew` guard) so historical fees stay immutable.
transactionSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('amount') || this.isModified('kesAmount') || this.isModified('type')) {
    const basis = this.kesAmount > 0 ? this.kesAmount : this.amount;
    const { paychainFee, safaricomFee, streamId } = calculateFees(this.type, basis);
    this.paychainFee  = paychainFee;
    this.safaricomFee = safaricomFee;
    this.revenueStream = streamId;
  }
  next();
});

// Mirror the hook for bulk insertMany — Mongoose does NOT run document
// middleware on insertMany unless `ordered: false` and we ask for it.
transactionSchema.pre('insertMany', function(next, docs) {
  for (const doc of docs) {
    const basis = (doc.kesAmount && doc.kesAmount > 0) ? doc.kesAmount : doc.amount;
    const { paychainFee, safaricomFee, streamId } = calculateFees(doc.type, basis);
    doc.paychainFee  = paychainFee;
    doc.safaricomFee = safaricomFee;
    doc.revenueStream = streamId;
  }
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
