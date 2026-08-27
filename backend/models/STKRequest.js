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
  // being charged via Request Money's instant prompt ('request_money'),
  // the Settlement QR's open-amount pay page ('pay_account'), or an NCBA
  // Dynamic QR Code scan ('qr') — all three carry PayChain's customer
  // surcharge. Defaults to 'topup' so older rows and the plain wallet-top-up
  // flow keep their existing zero-fee behavior.
  kind: {
    type: String,
    enum: ['topup', 'request_money', 'pay_account', 'qr'],
    default: 'topup',
  },
  // 'stk' (default): a push prompt was sent, resolved by polling NCBA's STK
  // Query endpoint (pollAndResolveNcbaStkPush). 'qr': a Dynamic QR Code was
  // generated instead — NCBA's QR API returns no transaction ID to poll, so
  // these are resolved directly off the account-notification webhook (see
  // controllers/ncbaAccountNotificationController.js) matching by
  // merchantId + amount instead.
  channel: {
    type: String,
    enum: ['stk', 'qr'],
    default: 'stk',
  },
  // Required for 'stk' (the number the prompt was pushed to); unknown at
  // creation time for 'qr' (the payer scans a code — we only learn who paid
  // from NCBA's account-notification callback, which doesn't feed back onto
  // this record).
  phone: {
    type: String,
    required: false,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  resultDesc: {
    type: String,
    default: 'Awaiting user PIN'
  },
  // Set once services/ncbaLedgerService.js's wasAlreadySettledByStkPush
  // matches this request against NCBA's separate account-notification
  // webhook for the same money — makes that match a one-time atomic claim
  // (via findOneAndUpdate) instead of a time-windowed guess. A real
  // production incident (2026-08-26) proved the previous 10-minute window
  // wasn't wide enough: NCBA's webhook arrived 45–70 minutes after the STK
  // poll's own success, so the guard missed it and the same money got
  // credited twice. This flag removes the time bound entirely — once
  // claimed, this specific STKRequest can never be matched again, so no
  // window width can ever be "too short" again.
  notificationMatched: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true
});

const STKRequest = model('STKRequest', stkRequestSchema);

export default STKRequest;
