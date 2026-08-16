import mongoose from 'mongoose';

// Fiscal receipt signed (or attempted) with KRA eTIMS OSCU. Deliberately a
// separate model/collection from the existing Invoice (models/Invoice.js,
// a merchant-to-customer M-Pesa billing document — completely different
// concept, same word) so neither one's schema or query patterns ever have
// to compromise for the other.
const etimsLineItemSchema = new mongoose.Schema({
  itemSeq: { type: Number, required: true },
  itemCd: { type: String, default: null }, // merchant's own SKU, optional
  itemClsCd: { type: String, required: true }, // KRA UNSPSC classification code
  itemNm: { type: String, required: true },
  qty: { type: Number, required: true },
  qtyUnitCd: { type: String, default: 'U' },
  pkg: { type: Number, default: 1 },
  pkgUnitCd: { type: String, default: 'NT' },
  prc: { type: Number, required: true }, // unit price, tax-inclusive
  splyAmt: { type: Number, required: true }, // prc * qty, before discount
  dcRt: { type: Number, default: 0 }, // discount rate, %
  dcAmt: { type: Number, default: 0 },
  taxTyCd: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  taxblAmt: { type: Number, required: true },
  taxAmt: { type: Number, required: true },
  totAmt: { type: Number, required: true },
}, { _id: false });

const etimsInvoiceSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  etimsConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'EtimsConfig', required: true },
  bhfId: { type: String, required: true },
  // Our own ascending local sequence, sent to KRA as invcNo.
  invcNo: { type: Number, required: true },
  // Set only on a credit note: the original sale's invcNo, per KRA's
  // orgInvcNo field.
  orgInvcNo: { type: Number, default: null },
  originalInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EtimsInvoice', default: null },

  transactionType: { type: String, enum: ['NORMAL_SALE', 'CREDIT_NOTE', 'PROFORMA'], required: true, index: true },
  salesTyCd: { type: String, default: 'N' },
  rcptTyCd: { type: String, enum: ['S', 'R', 'P'], required: true }, // Sale / cRedit note / Proforma
  pmtTyCd: { type: String, default: '01' },
  custTin: { type: String, default: null },
  custNm: { type: String, default: null },
  salesDt: { type: String, required: true }, // KRA format: YYYYMMDD

  items: { type: [etimsLineItemSchema], default: [] },

  // Taxable-amount / tax-collected breakdown per KRA rate band, kept flat
  // (not nested) — the KRA payload builder, the X/Z report aggregator, and
  // the receipt formatter all need to read these directly.
  taxblAmtA: { type: Number, default: 0 }, taxAmtA: { type: Number, default: 0 },
  taxblAmtB: { type: Number, default: 0 }, taxAmtB: { type: Number, default: 0 },
  taxblAmtC: { type: Number, default: 0 }, taxAmtC: { type: Number, default: 0 },
  taxblAmtD: { type: Number, default: 0 }, taxAmtD: { type: Number, default: 0 },
  taxblAmtE: { type: Number, default: 0 }, taxAmtE: { type: Number, default: 0 },

  totTaxblAmt: { type: Number, required: true },
  totTaxAmt: { type: Number, required: true },
  totAmt: { type: Number, required: true },
  totItemCnt: { type: Number, required: true },
  discountAmt: { type: Number, default: 0 },

  paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_money', 'other'], default: 'cash' },

  status: { type: String, enum: ['pending', 'signed', 'failed'], default: 'pending', index: true },
  errorMessage: { type: String, default: null },

  // ── KRA response (populated once status:'signed') ──────────────────
  sdcId: { type: String, default: null },
  rcptNo: { type: Number, default: null },
  totRcptNo: { type: Number, default: null },
  intrlData: { type: String, default: null },
  rcptSign: { type: String, default: null },
  formattedInternalData: { type: String, default: null },
  formattedSignature: { type: String, default: null },
  qrUrl: { type: String, default: null },
  qrDataUri: { type: String, default: null },
  vsdcRcptPbctDate: { type: String, default: null },
  // Full raw KRA response payload, kept for audit/dispute purposes — never
  // read on any hot path, only for support/debugging.
  kraRawResponse: { type: mongoose.Schema.Types.Mixed, default: null },

  refundReason: { type: String, default: null }, // credit notes only
}, { timestamps: true });

etimsInvoiceSchema.index({ merchantId: 1, bhfId: 1, invcNo: 1 }, { unique: true });
etimsInvoiceSchema.index({ merchantId: 1, createdAt: -1 });
etimsInvoiceSchema.index({ merchantId: 1, bhfId: 1, status: 1, createdAt: 1 });

export default mongoose.model('EtimsInvoice', etimsInvoiceSchema);
