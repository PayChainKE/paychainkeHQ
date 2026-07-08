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
  }
}, { timestamps: true });

// Check expiration before returning
paymentLinkSchema.pre('find', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

paymentLinkSchema.pre('findOne', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

export default mongoose.model('PaymentLink', paymentLinkSchema);
