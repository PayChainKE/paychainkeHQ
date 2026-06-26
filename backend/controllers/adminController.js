import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import STKRequest from '../models/STKRequest.js';
import Payee from '../models/Payee.js';
import PaymentLink from '../models/PaymentLink.js';
import { sendMerchantInvite, sendAdminActionOTP } from '../utils/resend.js';

// Allowed sensitive actions an admin can request against a merchant.
const ACTION_LABELS = {
  lock: 'Lock merchant account',
  unlock: 'Unlock merchant account',
  delete: 'Permanently delete merchant account',
};

// Derive an activity tier from a Date — used to colour-code merchant rows.
const tierFor = (lastAt) => {
  if (!lastAt) return 'dormant';
  const days = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 'active';
  if (days <= 30) return 'idle';
  return 'dormant';
};

// Timing-safe 6-digit OTP compare (both strings).
const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

// Generate unique 5-digit paybill account number (PayChain merchant account).
const generateUniquePaybillAccount = async () => {
  for (let i = 0; i < 25; i++) {
    const candidate = (crypto.randomInt(10000, 100000)).toString();
    const exists = await Merchant.exists({ paybillAccount: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a unique merchant account number');
};

const MERCHANT_DASHBOARD_URL =
  process.env.MERCHANT_DASHBOARD_URL || 'https://merchant.paychain.co.ke';

// Generate every common storage variation of a Kenyan phone number so we can
// detect duplicates regardless of how a previous record was saved (e.g. `0790...`,
// `254790...`, `+254790...`, bare `790...`).
const phoneVariations = (raw) => {
  const cleaned = String(raw).replace(/\s+/g, '');
  let base = cleaned;
  if (base.startsWith('+254')) base = base.substring(4);
  else if (base.startsWith('254')) base = base.substring(3);
  else if (base.startsWith('0')) base = base.substring(1);
  // De-dupe in case the input already matched one of the canonical forms.
  return Array.from(new Set([cleaned, base, `0${base}`, `254${base}`, `+254${base}`]));
};

// @desc    Get all merchants (with activity metrics: tier + 30-day txn count
//          + lastActivityAt = max(lastLogin, last completed txn)).
// @route   GET /api/admin/merchants
// @access  Private (Admin)
export const getMerchants = async (req, res) => {
  try {
    const merchants = await Merchant.find({}).sort('-createdAt').select('-password -otp -otpExpires').lean();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Single aggregation: per-merchant 30d transaction count + most recent txn date.
    const txnAgg = await Transaction.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$merchantId',
          txnCount30d: { $sum: 1 },
          lastTxnAt: { $max: '$createdAt' },
        },
      },
    ]);
    const txnByMerchant = new Map(txnAgg.map((row) => [String(row._id), row]));

    const enriched = merchants.map((m) => {
      const t = txnByMerchant.get(String(m._id));
      const lastActivityAt = [m.lastLogin, t?.lastTxnAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0);
      const lastActivityDate = lastActivityAt ? new Date(lastActivityAt) : null;
      return {
        ...m,
        txnCount30d: t?.txnCount30d || 0,
        lastActivityAt: lastActivityDate,
        activityTier: tierFor(lastActivityDate),
      };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error('Get Merchants Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Request a sensitive admin action against a merchant. Mints a
//          6-digit OTP that is bound (action + targetId) and emailed to the
//          admin's own address. The OTP can only confirm THIS action against
//          THIS merchant — replay across different actions/targets is
//          impossible because confirmMerchantAction re-checks the binding.
// @route   POST /api/admin/merchants/:id/request-action
// @access  Private (Admin)
export const requestMerchantAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    if (!ACTION_LABELS[action]) {
      return res.status(400).json({ error: 'Unsupported action.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id).select('email businessName status');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    // No-op guards — also stops admin from racking up OTPs against a no-op.
    if (action === 'lock' && merchant.status === 'locked') {
      return res.status(409).json({ error: 'Account is already locked.' });
    }
    if (action === 'unlock' && merchant.status !== 'locked') {
      return res.status(409).json({ error: 'Account is not locked.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    admin.pendingAction = {
      action,
      targetId: merchant._id,
      otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    };
    await admin.save();

    sendAdminActionOTP(
      admin.email,
      otp,
      ACTION_LABELS[action],
      `${merchant.businessName} (${merchant.email})`
    ).catch((err) => console.error('Action OTP email failed:', err));

    res.json({ success: true, message: 'Verification code sent to your admin email.' });
  } catch (error) {
    console.error('Request Merchant Action Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Confirm a pending sensitive action with the OTP. Executes the
//          action only if (action, targetId, otpHash, !expired) all match
//          the binding stored on the admin record. OTP + binding are cleared
//          on success or hard-failure to enforce single-use.
// @route   POST /api/admin/merchants/:id/confirm-action
// @access  Private (Admin)
export const confirmMerchantAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, otp } = req.body || {};

    if (!ACTION_LABELS[action]) return res.status(400).json({ error: 'Unsupported action.' });
    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ error: 'A 6-digit code is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const admin = await Admin.findById(req.admin._id).select('+pendingAction.otpHash pendingAction');
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const pa = admin.pendingAction || {};
    const bindingOk =
      pa.action === action &&
      String(pa.targetId) === String(id) &&
      pa.otpHash &&
      pa.expiresAt &&
      new Date() < new Date(pa.expiresAt);

    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const otpOk = bindingOk && safeEqual(otpHash, pa.otpHash);

    if (!otpOk) {
      // Clear binding on hard failure to prevent brute force on a single mint.
      admin.pendingAction = { action: null, targetId: null, otpHash: null, expiresAt: null };
      await admin.save();
      return res.status(401).json({ error: 'Verification failed. Re-request a new code.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) {
      admin.pendingAction = { action: null, targetId: null, otpHash: null, expiresAt: null };
      await admin.save();
      return res.status(404).json({ error: 'Merchant not found.' });
    }

    // Execute the action.
    if (action === 'lock') {
      merchant.status = 'locked';
      merchant.lockedAt = new Date();
      merchant.lockedBy = admin._id;
      await merchant.save();
    } else if (action === 'unlock') {
      merchant.status = 'active';
      merchant.lockedAt = null;
      merchant.lockedBy = null;
      await merchant.save();
    } else if (action === 'delete') {
      // Hard delete: remove merchant + all owned records. We don't drop
      // Transactions tied to other merchants — only this one's.
      await Promise.all([
        Transaction.deleteMany({ merchantId: merchant._id }),
        PayoutBatch.deleteMany({ merchantId: merchant._id }),
        STKRequest.deleteMany({ merchantId: merchant._id }),
        Payee.deleteMany({ merchantId: merchant._id }),
        PaymentLink.deleteMany({ merchantId: merchant._id }),
      ]);
      await Merchant.deleteOne({ _id: merchant._id });
    }

    // Single-use: clear the binding now that it has been consumed.
    admin.pendingAction = { action: null, targetId: null, otpHash: null, expiresAt: null };
    await admin.save();

    res.json({
      success: true,
      action,
      message: action === 'delete'
        ? 'Merchant account permanently deleted.'
        : action === 'lock'
          ? 'Merchant account locked.'
          : 'Merchant account unlocked.',
    });
  } catch (error) {
    console.error('Confirm Merchant Action Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get a single merchant's full profile for KYB review. Returns every
//          submitted field plus computed activity metrics. Sensitive material
//          (password hash, stellar secret, PIN hashes) is converted to
//          boolean flags so the admin can see *what's been set* without
//          leaking the underlying secret.
// @route   GET /api/admin/merchants/:id
// @access  Private (Admin)
export const getMerchantDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id)
      .select('+password +bulkPayPin +appPin +stellarEncryptedSecretKey')
      .populate('lockedBy', 'email')
      .populate('invitedBy', 'email')
      .lean();
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [txnCount30d, lastTxn] = await Promise.all([
      Transaction.countDocuments({ merchantId: merchant._id, createdAt: { $gte: thirtyDaysAgo } }),
      Transaction.findOne({ merchantId: merchant._id }).sort('-createdAt').select('createdAt amount status').lean(),
    ]);

    const lastActivityAt = [merchant.lastLogin, lastTxn?.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0) || null;

    res.json({
      success: true,
      data: {
        _id: merchant._id,
        // Identity
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        // KYB
        kraPin: merchant.kraPin,
        isKRAVerified: merchant.isKRAVerified,
        businessNumber: merchant.businessNumber,
        certificateUrl: merchant.certificateUrl,
        // Account
        paybillAccount: merchant.paybillAccount,
        status: merchant.status,
        isVerified: merchant.isVerified,
        registrationSource: merchant.registrationSource,
        createdAt: merchant.createdAt,
        invitedBy: merchant.invitedBy ? { email: merchant.invitedBy.email } : null,
        lockedAt: merchant.lockedAt,
        lockedBy: merchant.lockedBy ? { email: merchant.lockedBy.email } : null,
        // Settlement
        settlementMobile: merchant.settlementMobile,
        settlementBankName: merchant.settlementBankName,
        settlementBankAccount: merchant.settlementBankAccount,
        // Wallet
        stellarPublicKey: merchant.stellarPublicKey,
        usdcBalance: merchant.usdcBalance,
        kesBalance: merchant.kesBalance,
        // Security flags (boolean, never the secret)
        hasPassword: !!merchant.password,
        hasAppPin: !!merchant.appPin,
        hasBulkPayPin: !!merchant.bulkPayPin,
        hasStellarKey: !!merchant.stellarEncryptedSecretKey,
        biometricsEnabled: merchant.biometricsEnabled,
        // Activity
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
        activityTier: tierFor(lastActivityAt ? new Date(lastActivityAt) : null),
        txnCount30d,
        lastTransaction: lastTxn ? {
          createdAt: lastTxn.createdAt,
          amount: lastTxn.amount,
          status: lastTxn.status,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get Merchant Detail Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Onboard a new merchant (admin-initiated). Creates the merchant
//          record with a unique paybill account, mints a single-use
//          password-setup token (24h TTL), and emails the merchant a link
//          to set their dashboard password. No password is stored or sent.
// @route   POST /api/admin/merchants
// @access  Private (Admin)
export const createMerchant = async (req, res) => {
  try {
    let { name, email, phone, businessName, kraPin, businessNumber } = req.body || {};

    if (!name || !email || !phone || !businessName) {
      return res.status(400).json({ error: 'Name, email, phone and business name are required.' });
    }

    email = String(email).trim().toLowerCase();
    phone = String(phone).replace(/\s+/g, '');
    name = String(name).trim();
    businessName = String(businessName).trim();
    kraPin = kraPin ? String(kraPin).trim().toUpperCase() : null;
    businessNumber = businessNumber ? String(businessNumber).trim() : null;

    // Per-field uniqueness pre-check so the admin sees exactly which field
    // collides instead of a generic E11000.
    if (await Merchant.exists({ email })) {
      return res.status(409).json({ error: 'A merchant with that email already exists.' });
    }
    if (await Merchant.exists({ phone: { $in: phoneVariations(phone) } })) {
      return res.status(409).json({ error: 'A merchant with that phone number already exists.' });
    }
    if (kraPin && await Merchant.exists({ kraPin })) {
      return res.status(409).json({ error: 'A merchant with that KRA PIN already exists.' });
    }
    if (businessNumber && await Merchant.exists({ businessNumber })) {
      return res.status(409).json({ error: 'A merchant with that business registration number already exists.' });
    }

    const paybillAccount = await generateUniquePaybillAccount();

    // Generate a 32-byte raw token (URL-safe) and store only its sha256.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const merchant = await Merchant.create({
      name,
      email,
      phone,
      businessName,
      kraPin,
      businessNumber,
      paybillAccount,
      registrationSource: 'web',
      isVerified: true,
      invitedBy: req.admin?._id || null,
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });

    const setupLink = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;

    sendMerchantInvite(email, name, businessName, paybillAccount, setupLink).catch((err) => {
      console.error(`📧 Failed to send invite to ${email}:`, err);
    });

    res.status(201).json({
      success: true,
      message: 'Merchant created. Invitation email sent.',
      data: {
        _id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        businessName: merchant.businessName,
        paybillAccount: merchant.paybillAccount,
        createdAt: merchant.createdAt,
        isVerified: merchant.isVerified,
      },
    });
  } catch (error) {
    console.error('Create Merchant Error:', error);
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      const labels = {
        email: 'email',
        phone: 'phone number',
        kraPin: 'KRA PIN',
        businessNumber: 'business registration number',
        paybillAccount: 'paybill account',
      };
      const label = labels[key] || 'detail';
      return res.status(409).json({ error: `A merchant with that ${label} already exists.` });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get merchant analytics
// @route   GET /api/admin/merchants/analytics
// @access  Private (Admin)
export const getMerchantAnalytics = async (req, res) => {
  try {
    const totalMerchants = await Merchant.countDocuments();
    const verifiedMerchants = await Merchant.countDocuments({ isVerified: true });
    const unverifiedMerchants = totalMerchants - verifiedMerchants;

    // Get recently added merchants (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMerchants = await Merchant.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Digital Wallet Stats
    const activeWallets = await Merchant.countDocuments({ stellarPublicKey: { $ne: null } });
    
    // Total USDC Locked (Sum of all usdcBalance)
    const usdcAggregation = await Merchant.aggregate([
      { $group: { _id: null, totalUsdc: { $sum: "$usdcBalance" } } }
    ]);
    const totalUsdcLocked = usdcAggregation.length > 0 ? usdcAggregation[0].totalUsdc : 0;

    res.json({
      success: true,
      data: {
        totalMerchants,
        verifiedMerchants,
        unverifiedMerchants,
        recentMerchants,
        activeWallets,
        totalUsdcLocked
      }
    });
  } catch (error) {
    console.error('Get Merchant Analytics Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
