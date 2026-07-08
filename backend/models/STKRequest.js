import mongooseModule from 'mongoose';
const { Schema, model } = mongooseModule;

const stkRequestSchema = new Schema({
  merchantId: {
    type: Schema.Types.ObjectId,
    ref: 'Merchant',
    required: false,
    default: null,
  },
  checkoutRequestId: {
    type: String,
    required: true,
    unique: true
  },
  // Set when this STK push was raised to settle a PaymentLink (and, via the
  // link, possibly an Invoice) rather than a plain wallet top-up. Lets the
  // callback route the confirmation to the right place instead of always
  // crediting kesBalance.
  linkId: {
    type: String,
    default: null,
  },
  amount: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  resultDesc: {
    type: String,
    default: 'Awaiting user PIN'
  }
}, {
  timestamps: true
});

const STKRequest = model('STKRequest', stkRequestSchema);

export default STKRequest;
