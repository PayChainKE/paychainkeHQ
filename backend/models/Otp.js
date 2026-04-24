const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otpCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: '5m' } }
}, { timestamps: true });

module.exports = mongoose.model('Otp', otpSchema);
