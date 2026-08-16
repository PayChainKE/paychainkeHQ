import mongoose from 'mongoose';

// A hosted-checkout link — the Paystack/bank-style flow: a developer's
// backend creates one of these and redirects a customer to it, PayChain
// hosts the whole payment page, and the customer never sees an API key.
// Deliberately its own collection rather than reusing DeveloperPayment
// directly: a session can exist (and expire) with zero payment attempts
// ever made against it, and one session can, in principle, be retried
// across more than one DeveloperPayment (a failed attempt, then a second
// try with a different phone) — linkedDeveloperPaymentId always points at
// the current/latest one.
const checkoutSessionSchema = new mongoose.Schema({
  developerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Developer', required: true, index: true },
  apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  mode: { type: String, enum: ['test', 'live'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'KES' },
  reference: { type: String, default: null },
  description: { type: String, default: null },
  // Optional prefill — shown as a starting value on the hosted page, never
  // trusted as-is (the customer can still change the phone they pay from).
  customer: {
    phone: { type: String, default: null },
    email: { type: String, default: null },
    name: { type: String, default: null },
  },
  callbackUrl: { type: String, default: null },
  // pending: no attempt in flight yet (or the last one failed and this is
  //   waiting on a retry). processing: an STK push is currently in flight —
  //   the state that blocks a second concurrent attempt. success: paid.
  // expired: the session's TTL passed with no successful payment.
  status: { type: String, enum: ['pending', 'processing', 'success', 'expired'], default: 'pending', index: true },
  linkedDeveloperPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeveloperPayment', default: null },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

const CheckoutSession = mongoose.model('CheckoutSession', checkoutSessionSchema);

export default CheckoutSession;
