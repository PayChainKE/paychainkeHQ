import { sendOTP } from './resend.js';
import { toE164Kenyan } from './notificationService.js';
import { safeSendSMS } from './smsSanitizer.js';

// Mask a phone number for safe display in the UI, e.g. +254712345678 →
// +254•••••••78. Falls back to the raw digits if the number can't be
// normalized to E.164 (still masks — never shows the full number either way).
export const maskPhone = (raw) => {
  const e164 = toE164Kenyan(raw);
  const digits = (e164 || String(raw || '')).replace(/\D/g, '');
  if (digits.length < 6) return null;
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  const maskedLen = Math.max(3, digits.length - start.length - end.length);
  return `+${start}${'•'.repeat(maskedLen)}${end}`;
};

// Sends a one-time code through whichever channel matches how the merchant
// is being reached: SMS when explicitly requested (viaPhone) or as the
// email fallback when the phone can't be normalized, email otherwise. Never
// throws (safeSendSMS/sendOTP both swallow their own errors) and always
// returns enough info for the caller's response to tell the frontend which
// channel was used and how to render "sent to ...". Shared by login
// (merchantAuthController.js) and the payout step-up challenge
// (payoutStepUpGuard.js) so both send codes identically.
export async function dispatchOtp(merchant, { viaPhone, otp, label = 'PayChain verification' }) {
  if (viaPhone) {
    const e164Phone = toE164Kenyan(merchant.phone);
    if (e164Phone) {
      const result = await safeSendSMS({
        to: e164Phone,
        message: `Your ${label} code is ${otp}. It expires in 10 minutes. Do not share this code.`,
      });
      if (!result.success) {
        console.error(`📱 SMS Error: Failed to send OTP to ${e164Phone}:`, result.error);
      }
      return { channel: 'sms', maskedPhone: maskPhone(merchant.phone) };
    }
    console.warn(`📱 Merchant ${merchant._id} phone "${merchant.phone}" would not normalize — falling back to email OTP.`);
  }

  console.log(`📧 Dispatching OTP via Resend to: ${merchant.email}`);
  await sendOTP(merchant.email, otp).catch((err) => {
    console.error(`📧 Resend Error: Failed to send OTP to ${merchant.email}:`, err);
  });
  return { channel: 'email', maskedPhone: null };
}
