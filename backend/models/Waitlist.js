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
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  businessType: {
    type: String,
    required: [true, 'Business type is required']
  },
  challenge: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const Waitlist = mongoose.model('Waitlist', WaitlistSchema);

export default Waitlist;
