import mongoose from 'mongoose';

// Pre-account phone-ownership verification for merchant signup — proves the
// applicant actually controls the phone number they typed before the wizard
// lets them submit, closing the gap where anyone could enter someone else's
// number (or a disposable/unreachable one) and have it accepted straight
// into the KYC queue. Kept in its own collection rather than on Merchant,
// the same reasoning as payoutStepUpOtp/developerLinkOtp being deliberately
// separate from the login otp/otpExpires fields there (see Merchant.js): no
// Merchant document exists yet at this point, and this flow must never
// share state with an unrelated one racing the same phone number (e.g. a
// returning merchant's own login OTP).
const phoneVerificationSchema = new mongoose.Schema({
  // E.164, e.g. +254712345678 — see utils/notificationService.js#toE164Kenyan.
  // Every read/write of this collection normalizes to this shape first, so
  // "0712...", "254712...", "+254712..." all resolve to the same document.
  phone: {
    type: String,
    required: true,
    index: true,
  },
  otp: { type: String, select: false, default: null },
  otpExpires: { type: Date, select: false, default: null },
  // Same generic lockout fields utils/otpLockout.js already expects on
  // Admin/Merchant — reused here as-is rather than reimplemented.
  failedOtpAttempts: { type: Number, select: false, default: 0 },
  otpLockedUntil: { type: Date, select: false, default: null },
  verified: { type: Boolean, default: false },
  // Single-use proof of verification, handed to the client on success and
  // presented back with the final /merchant/register submission — a random
  // bearer token rather than re-checking `verified` alone, so a change to
  // the phone number mid-wizard can't silently ride on an earlier,
  // different number's verified flag.
  verifiedToken: { type: String, select: false, default: null },
  verifiedTokenExpires: { type: Date, select: false, default: null },
  createdAt: { type: Date, default: Date.now },
}, {
  // No updatedAt needed — every write to an existing document is a fresh
  // OTP cycle or a one-way transition to verified, never a field-by-field
  // edit worth tracking historically.
  timestamps: false,
});

// TTL index — same idiom as AuditLog.js's expiresAt. An abandoned signup
// (never verified, or verified but never actually submitted) cleans itself
// up automatically 2 hours after the attempt started; a real registration
// consumes (deletes) its own document long before that.
phoneVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

const PhoneVerification = mongoose.model('PhoneVerification', phoneVerificationSchema);

export default PhoneVerification;
