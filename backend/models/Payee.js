import mongoose from 'mongoose';
import { normalizeKraPin, isValidKraPin, KRA_PIN_FORMAT_HINT } from '../utils/kraPinValidator.js';

const payeeSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['employee', 'supplier', 'utility', 'contractor'],
      required: true,
      default: 'employee',
    },
    // Common Settlement Details
    paymentMethod: {
      type: String,
      enum: ['Mobile Money', 'Bank'],
      default: 'Mobile Money',
    },
    mobileMoneyType: {
      type: String,
      enum: ['Personal Number', 'Paybill', 'Buy Goods'],
    },
    // Which mobile money network this payee's wallet is on — only
    // meaningful when mobileMoneyType === 'Personal Number' (Paybill/Buy
    // Goods payees always resolve through Lipa na M-Pesa regardless of
    // network). Defaults to 'safaricom' since that's the only network this
    // app supported before Airtel Money B2W was wired up.
    mobileNetwork: {
      type: String,
      enum: ['safaricom', 'airtel'],
      default: 'safaricom',
    },
    phone: String,
    paybillNumber: String,
    businessAccount: String,
    tillNumber: String,
    bankName: String,
    accountNumber: String,
    // NCBA bank clearing code (see config/kenyanBankCodes.js) — required to
    // route this payee's payout through NCBA PesaLink/RTGS when
    // paymentMethod === 'Bank'.
    bankCode: String,

    // Utility-payee routing (type: 'utility') — which biller/rail NCBA
    // should target. accountNumber above doubles as the meter number for
    // all of these. 'KPLC' is postpaid (pays down an existing bill
    // balance); 'KPLC_PREPAID' is a genuinely different NCBA product (buys
    // an electricity token, sent to the meter's registered phone) — kept
    // as its own value rather than a flag on 'KPLC' since NCBA itself
    // treats them as separate validate/pay endpoint pairs.
    utilityProvider: {
      type: String,
      enum: ['KPLC', 'KPLC_PREPAID', 'WATER', null],
      default: null,
    },
    // Which utility category the merchant picked in the Add Payee UI (Water,
    // Electricity, Rent, Internet, or a custom "Other" utility) — purely for
    // display/edit purposes. Doesn't affect routing on its own: Water/Rent/
    // Internet/Other pay out through the generic paymentMethod-driven rail
    // (Mobile Money/Bank); Electricity instead sets utilityProvider above to
    // 'KPLC'/'KPLC_PREPAID', routing through NCBA's dedicated KPLC rail
    // (re-enabled 2026-08-26 — NCBA confirmed prior validation downtime is
    // resolved). NCWSC's dedicated rail stays unused/unconfirmed for now.
    utilityType: {
      type: String,
      trim: true,
      default: null,
    },

    // KRA Employee / Supplier PIN — shared by both `type` values. Optional
    // for every payee type (no live KRA integration reads this field), kept
    // purely so a merchant can record it for their own bookkeeping. Format
    // IS enforced here, but only when the value is actually being set —
    // see the validator below.
    kraPin: {
      type: String,
      trim: true,
      set: (v) => normalizeKraPin(v),
      validate: {
        validator: function (v) {
          if (!v) return true;
          if (typeof this.isModified === 'function' && !this.isModified('kraPin')) return true;
          return isValidKraPin(v);
        },
        message: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}`,
      },
    },
    idNumber: {
      type: String,
      trim: true,
    },
    nssfNumber: {
      type: String,
      trim: true,
    },
    shifNumber: {
      type: String,
      trim: true,
    },

    // KRA Supplier / eTIMS Details
    etimsInvoiceNumber: {
      type: String,
      trim: true,
    },
    cuNumber: {
      type: String, // Control Unit Number
      trim: true,
    },

    // Default amount or salary for easy batching
    defaultAmount: {
      type: Number,
      default: 0,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Payee = mongoose.model('Payee', payeeSchema);
export default Payee;
