import mongoose from 'mongoose';

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
    phone: String,
    paybillNumber: String,
    businessAccount: String,
    tillNumber: String,
    bankName: String,
    accountNumber: String,
    // NCBA bank clearing code (see config/kenyanBankCodes.js) — required to
    // route this payee's payout through NCBA PesaLink/EFT when
    // paymentMethod === 'Bank'.
    bankCode: String,

    // Utility-payee routing (type: 'utility') — which biller NCBA's Bulk
    // H2H payload should target. accountNumber above doubles as the
    // KPLC meter number / water account number for these payees.
    utilityProvider: {
      type: String,
      enum: ['KPLC', 'WATER', null],
      default: null,
    },

    // KRA Employee Details
    kraPin: {
      type: String,
      trim: true,
      uppercase: true,
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

// Optional: Validate required KRA fields based on type before saving
payeeSchema.pre('save', async function () {
  if (this.type === 'employee') {
    // In a strict prod environment, we would require these:
    // if (!this.kraPin || !this.idNumber) {
    //   throw new Error('KRA PIN and ID Number are required for Employees');
    // }
  }
  if (this.type === 'supplier') {
    // if (!this.kraPin || !this.etimsInvoiceNumber || !this.cuNumber) {
    //   throw new Error('KRA PIN, eTIMS Invoice Number, and CU Number are required for Suppliers');
    // }
  }
});

const Payee = mongoose.model('Payee', payeeSchema);
export default Payee;
