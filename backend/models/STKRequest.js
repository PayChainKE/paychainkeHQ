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
  // Only set on no-linkId requests where a customer surcharge applies
  // (kind !== 'topup') — the pre-surcharge amount, i.e. `amount` minus
  // PayChain's flat customer fee. Left null for plain top-ups and for
  // PaymentLink/Invoice requests (those derive their base from
  // PaymentLink.amount instead).
  baseAmount: {
    type: Number,
    default: null,
  },
  // Only meaningful when linkId is unset — distinguishes a merchant funding
  // their OWN wallet ('topup', no surcharge) from an actual customer/payer
  // being charged via Request Money's instant prompt ('request_money') or
  // the Settlement QR's open-amount pay page ('pay_account'), both of which
  // carry PayChain's customer surcharge. Defaults to 'topup' so older rows
  // and the plain wallet-top-up flow keep their existing zero-fee behavior.
  kind: {
    type: String,
    enum: ['topup', 'request_money', 'pay_account'],
    default: 'topup',
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
