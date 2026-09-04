import mongoose from 'mongoose';

// A merchant-owned, reusable, non-expiring product catalog page — the
// backing data for the no-code "storefront" embed (data-paychain-checkout).
// Unlike PaymentLink (a single fixed amount, single-use, TTL-expiring),
// this never expires and is never itself the thing a customer pays: a
// customer's finalized cart mints an ordinary PaymentLink on the fly (see
// transactionController.js's checkoutPageCheckout), so all real settlement
// continues to flow through the existing, unmodified PaymentLink/STK path.
const checkoutPageSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },
  pageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  items: {
    type: [{
      itemId: { type: String, required: true },
      name: { type: String, required: true, trim: true },
      description: { type: String, default: '', trim: true },
      unitPrice: { type: Number, required: true, min: 1 },
      active: { type: Boolean, default: true },
      // null/unset = unlimited. When set, checkoutPageCheckout enforces it
      // against Transaction (not PaymentLink — see that model's cartItems
      // comment for why) before minting a link.
      stockLimit: { type: Number, default: null, min: 1 },
    }],
    default: [],
  },
  active: {
    type: Boolean,
    default: true,
  },
  // When true, the public cart-checkout page requires a buyer name before
  // paying (stored on the minted PaymentLink) — off by default, since a
  // plain product sale only needs a phone number to pay.
  collectBuyerName: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model('CheckoutPage', checkoutPageSchema);
