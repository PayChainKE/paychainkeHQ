import crypto from 'crypto';
import mongoose from 'mongoose';
import Developer from '../models/Developer.js';
import Merchant from '../models/Merchant.js';
import ApiKey from '../models/ApiKey.js';
import { linkedMerchantIds, liveAccessFor } from '../utils/developerMerchants.js';
import { migrateLegacyLink } from '../services/developerMerchantLinkService.js';
import { sendOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { assertOtpNotLocked, recordFailedOtpAttempt, resetOtpAttempts, OtpLockedError } from '../utils/otpLockout.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const OTP_TTL_MS = 10 * 60 * 1000;
// Generous, but stops an account being used to hoard links.
const MAX_LINKED_MERCHANTS = 50;

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

    // A legacy single link is moved into the list first (carrying its live
    // approval and pinning its keys), so adding a merchant never disturbs it.
    const current = await migrateLegacyLink(req.developer._id);
    const existingIds = linkedMerchantIds(current);
    const alreadyLinked = existingIds.some((id) => String(id) === String(merchant._id));

    if (!alreadyLinked) {
      if (existingIds.length >= MAX_LINKED_MERCHANTS) {
        return res.status(400).json({ error: `A developer account can link at most ${MAX_LINKED_MERCHANTS} merchants.`, code: 'TOO_MANY_LINKED_MERCHANTS' });
      }
      // A new link starts sandbox-only: an admin approves live access for it.
      await Developer.updateOne(
        { _id: current._id, 'linkedMerchants.merchantId': { $ne: merchant._id } },
        { $push: { linkedMerchants: { merchantId: merchant._id, linkedAt: new Date() } } }
      );
    }

    const developer = await Developer.findById(current._id);
    const linkedAt = (developer.linkedMerchants || []).find((l) => String(l.merchantId) === String(merchant._id))?.linkedAt || new Date();

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
        linkedAt,
      },
    });
  } catch (error) {
    console.error('Verify Merchant Link Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Every merchant this developer is linked to.
// @route   GET /api/developer/link-merchant/status
// @access  Private (Developer)
export const getMerchantLinkStatus = async (req, res) => {
  try {
    const developer = await Developer.findById(req.developer._id);
    const ids = linkedMerchantIds(developer);
    if (ids.length === 0) {
      return res.json({ success: true, linked: false, merchants: [] });
    }

    const linkedAtById = new Map((developer.linkedMerchants || []).map((l) => [String(l.merchantId), l.linkedAt]));
    if (developer.linkedMerchant?.merchantId && !linkedAtById.has(String(developer.linkedMerchant.merchantId))) {
      linkedAtById.set(String(developer.linkedMerchant.merchantId), developer.linkedMerchant.linkedAt);
    }
    const docs = await Merchant.find({ _id: { $in: ids } }).select('businessName email');
    const byId = new Map(docs.map((m) => [String(m._id), m]));
    const merchants = ids.map((id) => ({
      merchantId: id,
      businessName: byId.get(String(id))?.businessName || null,
      email: byId.get(String(id))?.email || null,
      linkedAt: linkedAtById.get(String(id)) || null,
      liveAccess: (({ approved, requestedAt, approvedAt }) => ({ approved, requestedAt, approvedAt }))(liveAccessFor(developer, id)),
    }));

    const first = merchants[0];
    res.json({
      success: true,
      linked: true,
      merchants,
      // Kept for older clients that only knew about one merchant.
      merchant: { businessName: first.businessName, email: first.email },
      linkedAt: first.linkedAt,
    });
  } catch (error) {
    console.error('Get Merchant Link Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Unlink one merchant. Every API key tied to it is revoked at the
//          same time, so a key can never keep acting for a merchant that is
//          no longer linked.
// @route   DELETE /api/developer/link-merchant/:merchantId
// @access  Private (Developer)
export const unlinkMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    if (!mongoose.isValidObjectId(merchantId)) {
      return res.status(404).json({ error: 'That merchant is not linked to this account.' });
    }
    const developer = await Developer.findById(req.developer._id);
    const ids = linkedMerchantIds(developer);
    if (!ids.some((id) => String(id) === String(merchantId))) {
      return res.status(404).json({ error: 'That merchant is not linked to this account.' });
    }

    await Developer.updateOne(
      { _id: developer._id },
      { $pull: { linkedMerchants: { merchantId } } }
    );
    if (developer.linkedMerchant?.merchantId && String(developer.linkedMerchant.merchantId) === String(merchantId)) {
      await Developer.updateOne({ _id: developer._id }, { $set: { 'linkedMerchant.merchantId': null, 'linkedMerchant.linkedAt': null } });
    }

    // Keys tied to this merchant, plus any older key with no merchant that
    // only ever meant this one (the developer's sole link at the time).
    const bound = { developerId: developer._id, status: 'active', $or: [{ merchantId }] };
    if (ids.length === 1) bound.$or.push({ merchantId: null });
    const revoked = await ApiKey.updateMany(bound, { $set: { status: 'revoked', revokedAt: new Date() } });

    logAudit({
      action: 'developer.merchant_link.removed', category: 'security', severity: 'warning',
      message: `Unlinked merchant ${merchantId} from developer account (${revoked.modifiedCount} key(s) revoked)`,
      req, actor: { type: 'self', id: developer._id, email: developer.email, name: developer.name },
      metadata: { merchantId: String(merchantId), keysRevoked: revoked.modifiedCount },
    });

    res.json({ success: true, keysRevoked: revoked.modifiedCount });
  } catch (error) {
    console.error('Unlink Merchant Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
