import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import VerificationToken from '../models/VerificationToken.js';
import { sendSMS } from '../utils/sms.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';
import { logAudit } from '../utils/auditLog.js';

// SMS-based 2FA for merchants, additive to (and independent from) the
// existing email-OTP login flow in controllers/merchantAuthController.js —
// this does not replace or touch that flow. See models/VerificationToken.js
// for why this uses its own collection rather than Merchant.otp/otpExpires.

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes, per spec

// Builds every plausible stored-phone shape for a given input, matching the
// exact convention already used by controllers/merchantAuthController.js's
// login/registration lookups — Merchant.phone is stored verbatim as typed at
// registration (whitespace-stripped only), so it may be in any of these
// forms regardless of how this endpoint's caller formats their input.
function buildPhoneVariants(rawPhone) {
  let bare = String(rawPhone ?? '').replace(/\D/g, '');
  if (bare.startsWith('254')) bare = bare.slice(3);
  if (bare.startsWith('0')) bare = bare.slice(1);
  return Array.from(new Set([rawPhone, bare, `0${bare}`, `254${bare}`, `+254${bare}`]));
}

// @desc    Send a 6-digit SMS OTP to a merchant's registered phone number.
//          Always responds 200 success regardless of whether the phone
//          matched a real merchant (anti-enumeration — same convention as
//          merchantAuthController.js#forgotPassword); the SMS only actually
//          dispatches when a real account matched.
// @route   POST /api/auth/merchant/sms/send-otp
// @access  Public (rate-limited at the route layer — see routes/merchantSmsAuthRoutes.js)
export const sendMerchantSmsOtp = async (req, res) => {
  const { phone } = req.body || {};

  try {
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const e164Phone = toE164Kenyan(phone);
    if (!e164Phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan mobile number.' });
    }

    // Only ever text a number that's actually on file for a real merchant —
    // closes the obvious "send SMS to anyone" abuse vector that IP-based
    // rate limiting alone doesn't fully prevent.
    const merchant = await Merchant.findOne({ phone: { $in: buildPhoneVariants(phone) } });

    if (merchant) {
      // crypto.randomInt is uniformly distributed and safe for credential
      // material (unlike Math.random) — same generator used by the admin
      // email-OTP flow in controllers/authController.js.
      const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      await Promise.all([
        VerificationToken.findOneAndUpdate(
          { phone: e164Phone },
          { code: otp, merchantId: merchant._id, expiresAt },
          { upsert: true, returnDocument: 'after' }
        ),
        // sendSMS never throws (see utils/sms.js) — a delivery failure here
        // must never turn into a 500 for the caller or block the OTP record
        // from being written.
        sendSMS(e164Phone, `Your PayChain verification code is ${otp}. It expires in 5 minutes. Do not share this code.`).then((result) => {
          if (!result.success) {
            console.error(`SMS OTP dispatch failed for merchant ${merchant._id}:`, result.error);
          }
        }),
      ]);

      logAudit({
        action: 'merchant.sms_otp.requested',
        category: 'security',
        severity: 'info',
        message: 'SMS OTP requested',
        merchant,
        req,
      });
    } else {
      // Still log the attempt so we can spot enumeration / SMS-spray abuse.
      logAudit({
        action: 'merchant.sms_otp.requested_unknown',
        category: 'security',
        severity: 'warning',
        message: 'SMS OTP requested for a phone number with no matching merchant',
        req,
        metadata: { phone: e164Phone },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If that phone number is registered, a verification code has been sent.',
    });
  } catch (error) {
    console.error('Send Merchant SMS OTP Error:', error?.message || error);
    return res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Verify a 6-digit SMS OTP previously issued by sendMerchantSmsOtp.
//          Single-use: the token is deleted on a successful match.
// @route   POST /api/auth/merchant/sms/verify-otp
// @access  Public (rate-limited at the route layer)
export const verifyMerchantSmsOtp = async (req, res) => {
  const { phone, otp } = req.body || {};
  const submittedOtp = String(otp ?? '').trim();

  try {
    if (!phone || !submittedOtp) {
      return res.status(400).json({ error: 'Phone number and verification code are required.' });
    }

    const e164Phone = toE164Kenyan(phone);
    if (!e164Phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan mobile number.' });
    }

    const token = await VerificationToken.findOne({ phone: e164Phone });

    // A TTL index eventually purges expired tokens, but Mongo's background
    // sweep runs on its own ~60s cadence — expiry must also be enforced
    // here explicitly, not just left to that index (see the model file).
    // Not-found, expired, and mismatched all return the same generic error
    // — never reveal which case applies (mirrors controllers/authController.js).
    if (!token || new Date() > token.expiresAt || !timingSafeStringEqual(token.code, submittedOtp)) {
      return res.status(401).json({ error: 'Invalid or expired code.' });
    }

    await VerificationToken.deleteOne({ _id: token._id });

    logAudit({
      action: 'merchant.sms_otp.verified',
      category: 'security',
      severity: 'info',
      message: 'SMS OTP verified',
      req,
      metadata: { merchantId: token.merchantId },
    });

    return res.status(200).json({ success: true, verified: true });
  } catch (error) {
    console.error('Verify Merchant SMS OTP Error:', error?.message || error);
    return res.status(500).json({ error: 'Server Error' });
  }
};
