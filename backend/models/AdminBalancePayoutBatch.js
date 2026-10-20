import mongoose from 'mongoose';

// One admin "pay everyone / pay selected merchants their remaining balance"
// run (controllers/merchantBalancePayoutController.js#confirmBulkBalancePayout).
// Items are the OTP-approved quotes, processed one at a time in the
// background; this doc is the progress + results record the admin UI polls
// and the paper trail of who sent what.
//
// A server restart mid-run leaves items 'queued' (never sent) or
// 'processing' (outcome unknown — check the NCBA statement before
// resending). Nothing is auto-resumed, so a restart can never pay twice.
const itemSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  businessName: { type: String, default: null },
  phone: { type: String, required: true },
  network: { type: String, enum: ['safaricom', 'airtel'], default: 'safaricom' },
  amount: { type: Number, required: true },
  fee: { type: Number, required: true },
  status: {
    type: String,
    enum: ['queued', 'processing', 'sent', 'pending', 'failed'],
    default: 'queued',
  },
  reference: { type: String, default: null },
  error: { type: String, default: null },
  processedAt: { type: Date, default: null },
}, { _id: false });

const adminBalancePayoutBatchSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdByEmail: { type: String, default: null },
  scope: { type: String, enum: ['all', 'selected'], required: true },
  status: { type: String, enum: ['running', 'completed'], default: 'running' },
  items: { type: [itemSchema], default: [] },
  totalAmount: { type: Number, default: 0 },
  totalFees: { type: Number, default: 0 },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

adminBalancePayoutBatchSchema.index({ createdAt: -1 });

export default mongoose.model('AdminBalancePayoutBatch', adminBalancePayoutBatchSchema);
