import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true, default: '' },
  qty: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true, default: 0 },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },
  // Globally unique across every merchant on the platform — allocated from a
  // single atomic counter (see Counter.js / getNextInvoiceNumber), not scoped
  // per-merchant, so two accounts can never issue the same invoice number.
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
  },
  // Opaque token used in the public /invoice/:publicToken URL — never expose
  // the Mongo _id there, this is a separate unguessable identifier.
  publicToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  customer: {
    name:    { type: String, required: true },
    email:   { type: String, default: null },
    phone:   { type: String, default: null },
    address: { type: String, default: null },
  },
  items: {
    type: [invoiceItemSchema],
    default: [],
  },
  currency: {
    type: String,
    default: 'KES',
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: '',
  },
  recurring: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'void'],
    default: 'draft',
  },
  // The real M-PESA payment link minted when the invoice is sent — actual
  // collection is delegated entirely to the existing PaymentLink/STK flow.
  paymentLinkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentLink',
    default: null,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

invoiceSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
