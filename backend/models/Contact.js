import mongoose from 'mongoose';

const ReplySchema = new mongoose.Schema({
  body: { type: String, required: true, trim: true },
  sentByEmail: { type: String, required: true, trim: true, lowercase: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sentAt: { type: Date, default: Date.now },
  resendId: { type: String, default: null },
}, { _id: true });

const ContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  contactType: {
    type: String,
    required: [true, 'Contact type is required'],
    enum: ['merchant', 'investor', 'partnership', 'press', 'developer', 'careers', 'other']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  referralSource: {
    type: String,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Conversation lifecycle — drives the call-center pipeline view.
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true,
  },
  priority: {
    type: Boolean,
    default: false,
    index: true,
  },
  replies: { type: [ReplySchema], default: [] },
  lastRepliedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, {
  timestamps: true
});

const Contact = mongoose.model('Contact', ContactSchema, 'contacts');

export default Contact;
