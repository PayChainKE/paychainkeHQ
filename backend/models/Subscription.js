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
    default: true
  }
}, {
  timestamps: true
});

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

export default Subscription;
