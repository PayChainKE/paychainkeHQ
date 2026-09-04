import mongoose from 'mongoose';

const WaitlistSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    // Linear-time shape check — see models/Merchant.js's identical field
    // for why the old pattern was a catastrophic-backtracking DoS.
    match: [/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, 'Please add a valid email']
  },
  businessType: {
    type: String,
    required: [true, 'Business type is required']
  },
  challenge: {
    type: String,
    trim: true
  },
  // ─── Pipeline state — set by admins, drives the dashboard tabs/stats ───
  status: {
    type: String,
    enum: ['pending', 'contacted', 'approved', 'rejected', 'converted'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: Boolean,
    default: false,
    index: true,
  },
  notes: {
    type: String,
    default: null,
    maxlength: 2000,
  },
  contactedAt: { type: Date, default: null },
  convertedAt: { type: Date, default: null },
  convertedMerchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
}, {
  timestamps: true
});

const Waitlist = mongoose.model('Waitlist', WaitlistSchema);

export default Waitlist;
