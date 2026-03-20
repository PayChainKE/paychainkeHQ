const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  contactType: {
    type: String,
    required: true,
    enum: ['merchant','investor','partnership','press','developer','careers','other']
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  referralSource: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  repliedAt: { type: Date },
}, { timestamps: { createdAt: 'createdAt' } });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
