import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  // Not required: a draft is explicitly allowed to have blank/unfilled line
  // items (a merchant saving progress mid-edit) — Mongoose treats '' as
  // "missing" for a required String, which was blocking every draft save
  // that had an empty description. Completeness is enforced later, at
  // send time, in invoiceController.sendInvoice — not at the schema level.
  description: { type: String, default: '' },
  qty: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true, default: 0 },
  // Percentage off this line's gross (qty * price), 0-100. Applies to every
  // invoice regardless of eTIMS status — a general billing feature, not a
  // KRA-only one — but it's also what lets a fiscalized invoice carry KRA's
  // required "discount narration and value" per line (TIS spec's worked
  // receipt example).
  discountRate: { type: Number, default: 0, min: 0, max: 100 },
  // KRA eTIMS OSCU fields — only enforced (in invoiceController.js) when
  // the merchant actually has an initialized eTIMS device; a merchant who
  // hasn't registered for OSCU never has to fill these in. taxTyCd defaults
  // to 'B' (16% standard VAT), KRA's most common rate — 'A'/'C'/'D'/'E' cover
  // exempt/zero-rated/non-VAT/8% goods (see utils/etimsFormat.js TAX_RATES).
  taxTyCd: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], default: 'B' },
  // KRA UNSPSC item classification code — no safe generic default exists
  // (guessing one risks misclassifying a real supply), so this stays null
  // until the merchant sets it; required at send time only if eTIMS applies.
  itemClsCd: { type: String, default: null },
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
    // Buyer's KRA PIN — optional per the OSCU spec ("Buyer's PIN (Optional)"),
    // sent to KRA as custTin when this invoice is fiscalized.
    kraPin:  { type: String, default: null },
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
  // Set only when this invoice was created via the Developer API
  // (developerInvoiceController.js) — how resolveStkOutcome
  // (mpesaController.js) knows which developer's webhooks to fire
  // `invoice.paid` to. Dashboard-created invoices leave this null and
  // never trigger a developer webhook, since no developer created them.
  createdViaDeveloperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    default: null,
  },
  // Set only when this merchant has an initialized eTIMS OSCU device and
  // this invoice was actually signed by KRA at send time — see
  // fiscalizeWithEtims() in invoiceController.js. Left null for every
  // merchant not registered for OSCU (the large majority today), so this
  // is purely additive and never blocks the existing invoice flow.
  etimsInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EtimsInvoice',
    default: null,
  },
  // 'not_applicable': merchant has no initialized eTIMS device (default,
  // unaffected flow). 'signed': KRA accepted and signed this invoice at
  // send time. A send that would otherwise produce 'failed' is instead
  // rejected outright (see sendInvoice) — KRA's own spec requires a receipt
  // be signed before it's ever handed to the customer, so a fiscalization
  // failure must block delivery, not silently mark the invoice sent anyway.
  etimsStatus: {
    type: String,
    enum: ['not_applicable', 'signed'],
    default: 'not_applicable',
  },
}, { timestamps: true });

invoiceSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
