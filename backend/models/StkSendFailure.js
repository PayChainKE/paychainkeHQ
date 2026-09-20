import mongoose from 'mongoose';

// One row each time an STK Push could not be SENT: NCBA refused it, could not
// be reached, or the merchant's account was not ready. STKRequest only exists
// once NCBA has accepted a push, so without this a failed send left no trace
// anywhere except the server log. Kept in its own collection on purpose:
// STKRequest rows are matched against incoming payments and can be turned
// into credits, and a row for a push that never went out must never take part
// in that.
const StkSendFailureSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
  phone: { type: String, default: null },
  amount: { type: Number, default: null },
  kind: { type: String, default: null },
  // 'setup' (merchant not ready), 'auth' (NCBA login), 'request' (network or
  // NCBA error), 'rejected' (NCBA said no), 'other'.
  stage: { type: String, enum: ['setup', 'auth', 'request', 'rejected', 'other'], default: 'other' },
  // True when we know no prompt reached the customer.
  notSent: { type: Boolean, default: false },
  httpStatus: { type: Number, default: null },
  // For staff: NCBA's wording or the network error. Never shown to merchants.
  detail: { type: String, default: '', maxlength: 600 },
  createdAt: { type: Date, default: Date.now, index: true, expires: 60 * 24 * 60 * 60 },
}, { versionKey: false });

const StkSendFailure = mongoose.model('StkSendFailure', StkSendFailureSchema);

export default StkSendFailure;
