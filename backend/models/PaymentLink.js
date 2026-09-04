import mongoose from 'mongoose';

const paymentLinkSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
  },
  linkId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'KES',
  },
  status: {
    type: String,
    enum: ['active', 'paid', 'expired'],
    default: 'active',
  },
  // Set when this link was minted to collect payment on a specific invoice —
  // lets processPaymentLink flip the invoice to 'paid' on success. Null for
  // plain ad-hoc payment links (Wallet's "Request Money" -> Payment Link).
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '1m' }, // Automatically delete document after expiration + 1 minute (MongoDB TTL)
  },
  // Set only when this link was minted on the fly from a CheckoutPage cart
  // (see transactionController.js's checkoutPageCheckout). Null for every
  // other kind of payment link. Never used to decide settlement amounts —
  // resolveStkOutcome still only ever charges/credits based on linkId/amount.
  // It does copy these two fields onto the resulting Transaction verbatim
  // (a pure field copy, no new logic) since this PaymentLink doc itself gets
  // TTL-deleted ~15 minutes after creation regardless of payment outcome —
  // Transaction is where checkout-page order history and stock counts
  // actually live.
  checkoutPageId: {
    type: String,
    default: null,
  },
  cartItems: {
    type: [{
      itemId: String,
      name: String,
      unitPrice: Number,
      quantity: Number,
      _id: false,
    }],
    default: undefined,
  },
  // Set only when the CheckoutPage that minted this link has
  // collectBuyerName: true. Null for every other kind of payment link.
  buyerName: {
    type: String,
    default: null,
  },
}, { timestamps: true });

// Check expiration before returning
paymentLinkSchema.pre('find', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

paymentLinkSchema.pre('findOne', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

export default mongoose.model('PaymentLink', paymentLinkSchema);
