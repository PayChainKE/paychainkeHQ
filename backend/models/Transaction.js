import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: false
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number (till) is required'],
  },
  type: {
    type: String,
    enum: ['inbound', 'outbound', 'bulk_pay', 'settlement', 'fx_swap'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  kesAmount: {
    type: Number,
    default: 0
  },
  usdcAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'verified'],
    default: 'completed'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  sender: {
    name: String,
    id: String // e.g. Phone number
  },
  recipient: {
    name: String,
    id: String
  }
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
