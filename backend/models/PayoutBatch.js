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
    // Sum of Safaricom's B2C tariff + PayChain's flat markup actually kept
    // across this batch's Mobile Money rows (excludes any row that failed
    // and was refunded) — see controllers/bulkPayController.js#authorizeBatch.
    totalB2cFees: {
      type: Number,
      default: 0,
    },
    payeeCount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processed', 'Partial', 'Failed'],
      default: 'Pending',
    },
    fundingSource: {
      type: String,
      default: 'Main Business Account',
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
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed'],
          default: 'pending',
        },
        // Why this specific row failed (NCBA's rejection message, or a
        // client-side reason like a missing bank code) — surfaced to the
        // merchant so "Batch Failed" isn't the only thing they see. Only
        // ever set when status === 'failed'.
        failureReason: {
          type: String,
          default: null,
        },
        b2cFee: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const PayoutBatch = mongoose.model('PayoutBatch', payoutBatchSchema);
export default PayoutBatch;
