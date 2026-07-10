import mongoose from 'mongoose';

// A merchant's application for a cash advance. Snapshots the trust/eligibility
// numbers at submission time so the admin review queue reflects what the
// merchant actually qualified for on the day they applied, even if their
// trust score has since moved.
const cashAdvanceApplicationSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true,
  },
  requestedAmount: {
    type: Number,
    required: [true, 'Requested amount is required'],
    min: [1000, 'Requested amount must be at least KES 1,000'],
  },
  tenorDays: {
    type: Number,
    required: [true, 'Repayment period is required'],
    enum: [7, 14, 21, 30, 45, 60],
  },
  purpose: {
    type: String,
    required: [true, 'Purpose is required'],
    trim: true,
    maxlength: 500,
  },
  monthlyRevenueEstimate: {
    type: Number,
    default: null,
  },
  yearsInOperation: {
    type: Number,
    default: null,
  },
  businessAddress: {
    type: String,
    trim: true,
    default: null,
    maxlength: 300,
  },
  contactPhone: {
    type: String,
    trim: true,
    default: null,
  },
  // Snapshot of eligibility at submission time.
  trustScoreAtApplication: {
    type: Number,
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'approved', 'declined'],
    default: 'pending',
    index: true,
  },
  approvedLimit: {
    type: Number,
    default: null,
  },
  reviewNotes: {
    type: String,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

cashAdvanceApplicationSchema.index({ merchant: 1, createdAt: -1 });

const CashAdvanceApplication = mongoose.model('CashAdvanceApplication', cashAdvanceApplicationSchema);

export default CashAdvanceApplication;
