import crypto from 'crypto';
import Developer from '../models/Developer.js';
import Merchant from '../models/Merchant.js';
import { sendOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { assertOtpNotLocked, recordFailedOtpAttempt, resetOtpAttempts, OtpLockedError } from '../utils/otpLockout.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const OTP_TTL_MS = 10 * 60 * 1000;

// @desc    Start linking this developer account to one of their own
//          existing Merchant accounts — verifies the merchant's own
//          email+password, then emails an OTP to that merchant's own
//          inbox as proof of control. Deliberately NOT a fully API-driven
//          link (no OTP) — a leaked developer session token alone must
//          never be enough to attach itself to someone else's wallet.
// @route   POST /api/developer/link-merchant/start
// @access  Private (Developer)
export const startMerchantLink = async (req, res) => {
  try {
    const { merchantEmail, merchantPassword } = req.body || {};
    if (!merchantEmail || !merchantPassword) {
      return res.status(400).json({ error: 'merchantEmail and merchantPassword are required.' });
    }

    const email = String(merchantEmail).trim().toLowerCase();
    const merchant = await Merchant.findOne({ email }).select('+password');
    if (!merchant || !merchant.password || !(await merchant.matchPassword(merchantPassword))) {
      // Generic error either way — same account-existence-hiding principle
      // as loginMerchant/loginDeveloper.
      return res.status(401).json({ error: 'Invalid merchant email or password.' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await Merchant.updateOne(
      { _id: merchant._id },
      { $set: { developerLinkOtp: otp, developerLinkOtpExpires: new Date(Date.now() + OTP_TTL_MS) } }
    );
    await sendOTP(merchant.email, otp).catch((err) => {
      console.error(`Developer link-merchant: failed to send OTP to ${merchant.email}:`, err);
    });

    res.json({ success: true, message: 'A verification code was sent to the merchant account\'s email.' });
  } catch (error) {
    console.error('Start Merchant Link Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Complete linking — verifies the OTP sent to the merchant's
//          email, then attaches this merchant to the calling developer.
// @route   POST /api/developer/link-merchant/verify
// @access  Private (Developer)
export const verifyMerchantLink = async (req, res) => {
  try {
    const { merchantEmail, otp } = req.body || {};
    const email = String(merchantEmail || '').trim().toLowerCase();
    const merchant = await Merchant.findOne({ email }).select('+developerLinkOtp +developerLinkOtpExpires');

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid request' });
    }

    try {
      await assertOtpNotLocked(Merchant, merchant._id);
    } catch (e) {
      if (e instanceof OtpLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    if (!merchant.developerLinkOtp || !timingSafeStringEqual(merchant.developerLinkOtp, String(otp || ''))) {
      await recordFailedOtpAttempt(Merchant, merchant._id);
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    if (new Date() > merchant.developerLinkOtpExpires) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    await Merchant.updateOne({ _id: merchant._id }, { $set: { developerLinkOtp: null, developerLinkOtpExpires: null } });
    await resetOtpAttempts(Merchant, merchant._id);

    const developer = await Developer.findByIdAndUpdate(
      req.developer._id,
      { $set: { linkedMerchant: { merchantId: merchant._id, linkedAt: new Date() } } },
      { new: true }
    );

    logAudit({
      action: 'developer.merchant_link.verified', category: 'security', severity: 'critical',
      message: `Linked developer account to merchant ${merchant.businessName || merchant.email}`,
      req, actor: { type: 'self', id: req.developer._id, email: req.developer.email, name: req.developer.name },
      metadata: { merchantId: String(merchant._id) },
    });

    res.json({
      success: true,
      linkedMerchant: {
        merchantId: merchant._id,
        businessName: merchant.businessName,
        linkedAt: developer.linkedMerchant.linkedAt,
      },
    });
  } catch (error) {
    console.error('Verify Merchant Link Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Current link status for the calling developer.
// @route   GET /api/developer/link-merchant/status
// @access  Private (Developer)
export const getMerchantLinkStatus = async (req, res) => {
  try {
    const developer = await Developer.findById(req.developer._id);
    if (!developer.linkedMerchant?.merchantId) {
      return res.json({ success: true, linked: false });
    }
    const merchant = await Merchant.findById(developer.linkedMerchant.merchantId).select('businessName email');
    res.json({
      success: true,
      linked: true,
      merchant: merchant ? { businessName: merchant.businessName, email: merchant.email } : null,
      linkedAt: developer.linkedMerchant.linkedAt,
    });
  } catch (error) {
    console.error('Get Merchant Link Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
