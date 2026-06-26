import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  active: {
    type: Boolean,
    default: true,
    index: true,
  },
  source: {
    // 'public' — joined via the public site form
    // 'admin'  — added by an admin from the dashboard
    type: String,
    enum: ['public', 'admin'],
    default: 'public',
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
}, {
  timestamps: true
});

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

export default Subscription;
