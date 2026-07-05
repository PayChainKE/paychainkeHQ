import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  kind: {
    type: String,
    enum: ['payment', 'advance', 'security', 'wallet', 'system'],
    default: 'system',
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model('Notification', NotificationSchema);
