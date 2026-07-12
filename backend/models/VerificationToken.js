import mongoose from 'mongoose';

// Short-lived 6-digit OTP codes for Africa's Talking SMS 2FA — deliberately
// separate from Admin.otp / Merchant.otp (which back the existing email-OTP
// login flows via Resend). One document per phone number: a fresh send
// upserts (replaces) any prior code for that number rather than
// accumulating rows.
const verificationTokenSchema = new mongoose.Schema(
  {
    // Always the E.164-normalized number actually dispatched to (see
    // utils/notificationService.js#toE164Kenyan) — not necessarily the raw
    // string stored on Merchant.phone, which may be in any input format.
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB's background monitor deletes each document once its
// expiresAt passes (expireAfterSeconds: 0 = "delete at expiresAt exactly",
// same convention as models/AuditLog.js). This is storage hygiene only —
// the ~60s TTL sweep interval means a just-expired code can still be read
// by a query for a short window, so verifyMerchantSmsOtp must ALSO check
// expiresAt explicitly rather than relying on this index for correctness.
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VerificationToken', verificationTokenSchema);
