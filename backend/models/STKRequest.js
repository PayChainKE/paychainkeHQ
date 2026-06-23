import mongoose from 'express'; // Wait, mongoose from mongoose

import mongooseModule from 'mongoose';
const { Schema, model } = mongooseModule;

const stkRequestSchema = new Schema({
  merchantId: {
    type: Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  checkoutRequestId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  resultDesc: {
    type: String,
    default: 'Awaiting user PIN'
  }
}, {
  timestamps: true
});

const STKRequest = model('STKRequest', stkRequestSchema);

export default STKRequest;
