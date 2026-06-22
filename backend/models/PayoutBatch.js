import mongoose from 'mongoose';

const payoutBatchSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    batchReference: {
      type: String,
      required: true,
      unique: true,
    },
    totalGrossAmount: {
      type: Number,
      default: 0,
    },
    totalTaxDeductions: {
      type: Number,
      default: 0,
    },
    totalNetAmount: {
      type: Number,
      default: 0,
    },
    payeeCount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processed', 'Failed'],
      default: 'Pending',
    },
    fundingSource: {
      type: String,
      default: 'Main Business Till',
    },
    transactions: [
      {
        payeeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Payee',
        },
        name: String,
        amount: Number, // Net Amount Paid
        grossAmount: Number,
        taxDeductions: {
          paye: Number,
          nssf: Number,
          shif: Number,
        },
        method: String,
        accountReference: String,
        receiptNumber: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const PayoutBatch = mongoose.model('PayoutBatch', payoutBatchSchema);
export default PayoutBatch;
