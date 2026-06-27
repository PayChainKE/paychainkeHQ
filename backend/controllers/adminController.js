import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import STKRequest from '../models/STKRequest.js';
import Payee from '../models/Payee.js';
import PaymentLink from '../models/PaymentLink.js';
import Waitlist from '../models/Waitlist.js';
import Contact from '../models/Contact.js';
import Communication from '../models/Communication.js';
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

// Compute deterministic, replayable risk signals for a single merchant. Each
// signal is a small object — admins eyeball the chips on the row and drill
// into the KYB drawer for context. Pure function: same input → same output.
const computeRiskSignals = (merchant, agg) => {
  const signals = [];
  const ageDays = (Date.now() - new Date(merchant.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const txn30 = agg?.txnCount30d || 0;
  const txn24 = agg?.txnCount24h || 0;
  const dailyAvg = txn30 / 30;

  // Always set: incomplete onboarding signals.
  if (merchant.passwordResetExpires && new Date(merchant.passwordResetExpires) > new Date()) {
    signals.push({ id: 'pending_setup', label: 'Setup incomplete', severity: 'low' });
  }
  if (!merchant.kraPin || !merchant.isKRAVerified) {
    signals.push({ id: 'no_kra', label: 'KRA not verified', severity: 'medium' });
  }
  if (!merchant.stellarPublicKey) {
    signals.push({ id: 'no_wallet', label: 'No wallet', severity: 'low' });
  }

  // Velocity / pattern signals.
  if (ageDays < 7 && txn30 > 50) {
    signals.push({ id: 'rapid_ramp', label: 'New account, high volume', severity: 'high' });
  }
  if (dailyAvg >= 5 && txn24 > dailyAvg * 3) {
    signals.push({ id: 'volume_spike', label: '24h volume spike', severity: 'high' });
  }
  if (!merchant.isVerified && txn30 > 0) {
    signals.push({ id: 'unverified_active', label: 'Active but unverified', severity: 'medium' });
  }
  return signals;
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
  process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

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
    // Include passwordResetExpires (select:false by default) so we can compute
    // the "setup incomplete" risk signal. We strip it before responding.
    const merchants = await Merchant.find({})
      .sort('-createdAt')
      .select('-password -otp -otpExpires +passwordResetExpires')
      .populate('flaggedBy', 'email')
      .lean();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Single aggregation: per-merchant 30d + 24h counts + most recent txn date.
    const txnAgg = await Transaction.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$merchantId',
          txnCount30d: { $sum: 1 },
          txnCount24h: { $sum: { $cond: [{ $gte: ['$createdAt', oneDayAgo] }, 1, 0] } },
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
      const riskSignals = computeRiskSignals(m, t);
      // Strip the field we only fetched for signal computation.
      delete m.passwordResetExpires;
      return {
        ...m,
        txnCount30d: t?.txnCount30d || 0,
        txnCount24h: t?.txnCount24h || 0,
        lastActivityAt: lastActivityDate,
        activityTier: tierFor(lastActivityDate),
        riskSignals,
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

// @desc    Flag a merchant for suspicious activity. Lightweight + reversible —
//          no OTP required (this is a review label, not access denial). Admin
//          must provide a written reason which is shown in the KYB drawer for
//          accountability and future review.
// @route   POST /api/admin/merchants/:id/flag
// @access  Private (Admin)
export const flagMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    const trimmed = String(reason || '').trim();
    if (trimmed.length < 5) {
      return res.status(400).json({ error: 'Reason must be at least 5 characters.' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Reason must be under 500 characters.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    merchant.flagged = true;
    merchant.flagReason = trimmed;
    merchant.flaggedAt = new Date();
    merchant.flaggedBy = req.admin._id;
    await merchant.save();

    res.json({ success: true, message: 'Merchant flagged for review.' });
  } catch (error) {
    console.error('Flag Merchant Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Clear a suspicious-activity flag.
// @route   POST /api/admin/merchants/:id/unflag
// @access  Private (Admin)
export const unflagMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    merchant.flagged = false;
    merchant.flagReason = null;
    merchant.flaggedAt = null;
    merchant.flaggedBy = null;
    await merchant.save();

    res.json({ success: true, message: 'Flag cleared.' });
  } catch (error) {
    console.error('Unflag Merchant Error:', error);
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
      .select('+password +bulkPayPin +appPin +stellarEncryptedSecretKey +passwordResetExpires')
      .populate('lockedBy', 'email')
      .populate('invitedBy', 'email')
      .populate('flaggedBy', 'email')
      .lean();
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [txnCount30d, txnCount24h, lastTxn] = await Promise.all([
      Transaction.countDocuments({ merchantId: merchant._id, createdAt: { $gte: thirtyDaysAgo } }),
      Transaction.countDocuments({ merchantId: merchant._id, createdAt: { $gte: oneDayAgo } }),
      Transaction.findOne({ merchantId: merchant._id }).sort('-createdAt').select('createdAt amount status').lean(),
    ]);

    const lastActivityAt = [merchant.lastLogin, lastTxn?.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0) || null;

    const riskSignals = computeRiskSignals(merchant, { txnCount30d, txnCount24h });

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
        // Flag / risk
        flagged: !!merchant.flagged,
        flagReason: merchant.flagReason,
        flaggedAt: merchant.flaggedAt,
        flaggedBy: merchant.flaggedBy ? { email: merchant.flaggedBy.email } : null,
        riskSignals,
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
        txnCount24h,
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

// @desc    Wallet Ledger — paginated transaction trail + KPIs + asset
//          breakdown + daily volume series + type mix. Powers the
//          unicorn-grade Ledger page.
// @route   GET /api/admin/ledger?range=24h|7d|30d|all&page=1&limit=25&type=&status=&q=
// @access  Private (Admin)
export const getLedger = async (req, res) => {
  try {
    const range = ['24h', '7d', '30d', 'all'].includes(req.query.range) ? req.query.range : '7d';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
    const type = req.query.type && req.query.type !== 'all' ? req.query.type : null;
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const q = (req.query.q || '').trim();

    const now = new Date();
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365 * 5;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const baseFilter = { createdAt: { $gte: since } };
    if (type) baseFilter.type = type;
    if (status) baseFilter.status = status;
    if (q) {
      baseFilter.$or = [
        { reference: { $regex: q, $options: 'i' } },
        { accountNumber: { $regex: q, $options: 'i' } },
        { 'sender.name': { $regex: q, $options: 'i' } },
        { 'sender.id': { $regex: q, $options: 'i' } },
      ];
    }

    const [total, txns, allInRange, prev, typeAgg, daily] = await Promise.all([
      Transaction.countDocuments(baseFilter),
      Transaction.find(baseFilter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchantId', 'businessName paybillAccount status flagged')
        .lean(),
      // Aggregates over the FULL range (ignore q/type/status filters so KPIs reflect headline performance, not user's view)
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
            kesVolume: { $sum: '$kesAmount' },
            usdcVolume: { $sum: '$usdcAmount' },
            completed: { $sum: { $cond: [{ $in: ['$status', ['completed', 'verified']] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: prevSince, $lt: since } } },
        { $group: { _id: null, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$type', count: { $sum: 1 }, volume: { $sum: '$amount' } } },
        { $sort: { volume: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: range === '24h' ? '%Y-%m-%d %H:00' : '%Y-%m-%d', date: '$createdAt' } },
            volume: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const cur = allInRange[0] || { count: 0, volume: 0, kesVolume: 0, usdcVolume: 0, completed: 0, failed: 0, pending: 0 };
    const prv = prev[0] || { count: 0, volume: 0 };
    const pct = (a, b) => (b ? Number((((a - b) / b) * 100).toFixed(1)) : (a > 0 ? 100 : 0));

    const settlementRatio = cur.count > 0 ? Number(((cur.completed / cur.count) * 100).toFixed(1)) : 100;
    // Fee model placeholder — 1% of completed volume. Replace with real fee
    // ledger once it's available.
    const estimatedFees = cur.volume * 0.01;

    res.json({
      success: true,
      data: {
        range,
        kpis: {
          volume: { value: cur.volume, change: pct(cur.volume, prv.volume) },
          count: { value: cur.count, change: pct(cur.count, prv.count) },
          settlementRatio,
          estimatedFees,
          failed: cur.failed,
          pending: cur.pending,
        },
        assets: {
          kes: cur.kesVolume || cur.volume,
          usdc: cur.usdcVolume || 0,
        },
        typeMix: typeAgg.map((r) => ({ type: r._id || 'other', count: r.count, volume: r.volume })),
        series: daily.map((r) => ({ bucket: r._id, volume: r.volume, count: r.count })),
        // Paginated table
        transactions: txns.map((t) => ({
          _id: t._id,
          reference: t.reference,
          createdAt: t.createdAt,
          type: t.type,
          amount: t.amount,
          kesAmount: t.kesAmount,
          usdcAmount: t.usdcAmount,
          currency: t.currency,
          status: t.status,
          accountNumber: t.accountNumber,
          sender: t.sender,
          recipient: t.recipient,
          merchant: t.merchantId
            ? {
                _id: t.merchantId._id,
                businessName: t.merchantId.businessName,
                paybillAccount: t.merchantId.paybillAccount,
                status: t.merchantId.status,
                flagged: t.merchantId.flagged,
              }
            : null,
        })),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (error) {
    console.error('Get Ledger Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Executive insights — aggregated KPIs (GTV, growth, conversion
//          funnel, top merchants, time series). One round trip; everything
//          the Insights page renders comes from here.
// @route   GET /api/admin/insights?range=7d|30d|90d|all
// @access  Private (Admin)
export const getInsights = async (req, res) => {
  try {
    const range = ['7d', '30d', '90d', 'all'].includes(req.query.range) ? req.query.range : '30d';
    const now = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365 * 5;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // Previous period of equal length for delta computation.
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const pctChange = (curr, prev) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // ── Merchant health snapshot ─────────────────────────────────────
    const [
      totalMerchants, activeMerchants, lockedMerchants, flaggedMerchants,
      newMerchantsCurr, newMerchantsPrev,
      verifiedMerchants, kraVerified, withWallet,
    ] = await Promise.all([
      Merchant.countDocuments(),
      Merchant.countDocuments({ status: { $ne: 'locked' } }),
      Merchant.countDocuments({ status: 'locked' }),
      Merchant.countDocuments({ flagged: true }),
      Merchant.countDocuments({ createdAt: { $gte: since } }),
      Merchant.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
      Merchant.countDocuments({ isVerified: true }),
      Merchant.countDocuments({ isKRAVerified: true }),
      Merchant.countDocuments({ stellarPublicKey: { $ne: null } }),
    ]);

    // Dormant = last activity older than 30 days OR never logged in. We use
    // lastLogin as the cheap proxy; aligns with the activityTier on /merchants.
    const dormantSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dormantMerchants = await Merchant.countDocuments({
      $or: [{ lastLogin: { $lt: dormantSince } }, { lastLogin: null }],
    });

    // ── Transaction / GTV ────────────────────────────────────────────
    const [gtvCurr, gtvPrev, gtvSeries] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: prevSince, $lt: since }, status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      ]),
      // Daily volume series for the sparkline / area chart.
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $in: ['completed', 'verified'] } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const gtvVolume = gtvCurr[0]?.volume || 0;
    const gtvVolumePrev = gtvPrev[0]?.volume || 0;
    const gtvCount = gtvCurr[0]?.count || 0;
    const gtvCountPrev = gtvPrev[0]?.count || 0;

    // ── Signups time series ─────────────────────────────────────────
    const signupsSeries = await Merchant.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Always-on monthly view (last 12 months) for the Overview chart. Independent
    // of the request's `range` so the chart shows the same trailing window no
    // matter which timeframe the user is exploring.
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlySignupsAgg = await Merchant.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    // Densify — fill any gap months with zero so the chart has a clean axis.
    const byMonth = new Map(monthlySignupsAgg.map((r) => [r._id, r.count]));
    const monthlySignups = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySignups.push({
        month: key,
        label: d.toLocaleString('en-US', { month: 'short' }),
        count: byMonth.get(key) || 0,
      });
    }

    // ── Conversion funnel (waitlist → merchant) ──────────────────────
    const [waitlistCounts, convertedFromWaitlist] = await Promise.all([
      Waitlist.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Waitlist.countDocuments({ status: 'converted' }),
    ]);
    const wlByStatus = waitlistCounts.reduce(
      (acc, r) => ({ ...acc, [r._id || 'pending']: r.count }), {}
    );
    const waitlistTotal = Object.values(wlByStatus).reduce((s, n) => s + n, 0);

    // ── Top merchants by 30d volume ──────────────────────────────────
    const topMerchantsRaw = await Transaction.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $in: ['completed', 'verified'] }, merchantId: { $ne: null } } },
      {
        $group: {
          _id: '$merchantId',
          txnCount: { $sum: 1 },
          volume: { $sum: '$amount' },
        },
      },
      { $sort: { volume: -1 } },
      { $limit: 8 },
    ]);
    const topMerchantIds = topMerchantsRaw.map((r) => r._id);
    const topMerchantDocs = await Merchant.find({ _id: { $in: topMerchantIds } })
      .select('businessName name paybillAccount status flagged')
      .lean();
    const docMap = new Map(topMerchantDocs.map((d) => [String(d._id), d]));
    const topMerchants = topMerchantsRaw.map((row) => {
      const doc = docMap.get(String(row._id)) || {};
      return {
        _id: row._id,
        businessName: doc.businessName || '— Unknown —',
        name: doc.name || '',
        paybillAccount: doc.paybillAccount || '',
        status: doc.status || 'active',
        flagged: !!doc.flagged,
        txnCount: row.txnCount,
        volume: row.volume,
      };
    });

    // ── Transaction type mix ─────────────────────────────────────────
    const txnTypeMix = await Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      { $sort: { volume: -1 } },
    ]);

    // ── Business-type distribution (across all merchants via waitlist
    // source, since merchant docs don't carry a businessType field).
    const businessTypes = await Waitlist.aggregate([
      { $group: { _id: '$businessType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    res.json({
      success: true,
      data: {
        range,
        since,
        // KPIs
        kpis: {
          gtv: {
            value: gtvVolume,
            prev: gtvVolumePrev,
            change: pctChange(gtvVolume, gtvVolumePrev),
          },
          txnCount: {
            value: gtvCount,
            prev: gtvCountPrev,
            change: pctChange(gtvCount, gtvCountPrev),
          },
          newMerchants: {
            value: newMerchantsCurr,
            prev: newMerchantsPrev,
            change: pctChange(newMerchantsCurr, newMerchantsPrev),
          },
          totalMerchants,
          activeMerchants,
        },
        // Health
        health: {
          total: totalMerchants,
          active: activeMerchants,
          locked: lockedMerchants,
          flagged: flaggedMerchants,
          dormant: dormantMerchants,
          verified: verifiedMerchants,
          kraVerified,
          withWallet,
        },
        // Conversion funnel
        funnel: {
          waitlistTotal,
          pending: wlByStatus.pending || 0,
          contacted: wlByStatus.contacted || 0,
          approved: wlByStatus.approved || 0,
          converted: convertedFromWaitlist,
          activeMerchants,
        },
        // Series
        gtvSeries: gtvSeries.map((r) => ({ date: r._id, count: r.count, volume: r.volume })),
        signupsSeries: signupsSeries.map((r) => ({ date: r._id, count: r.count })),
        monthlySignups,
        // Leaderboards
        topMerchants,
        txnTypeMix: txnTypeMix.map((r) => ({ type: r._id || 'other', count: r.count, volume: r.volume })),
        businessTypes: businessTypes.map((r) => ({ type: r._id || 'Unknown', count: r.count })),
      },
    });
  } catch (error) {
    console.error('Get Insights Error:', error);
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

// @desc    Compact system-status counts — powers the sidebar widget so it
//          reflects real backend state instead of placeholder numbers.
// @route   GET /api/admin/system-status
// @access  Private (Admin)
export const getSystemStatus = async (req, res) => {
  try {
    const [
      merchants, lockedMerchants, flaggedMerchants,
      waitlistTotal, waitlistPending,
      messagesTotal, messagesUnread,
      commsTotal, commsUnresolved,
    ] = await Promise.all([
      Merchant.countDocuments(),
      Merchant.countDocuments({ status: 'locked' }),
      Merchant.countDocuments({ flagged: true }),
      Waitlist.countDocuments(),
      Waitlist.countDocuments({ status: 'pending' }),
      Contact.countDocuments(),
      Contact.countDocuments({ isRead: false }),
      Communication.countDocuments(),
      Communication.countDocuments({ status: { $in: ['new', 'in_progress'] } }),
    ]);

    res.json({
      success: true,
      data: {
        merchants: { total: merchants, locked: lockedMerchants, flagged: flaggedMerchants },
        waitlist: { total: waitlistTotal, pending: waitlistPending },
        messages: { total: messagesTotal, unread: messagesUnread },
        calls:    { total: commsTotal,    open: commsUnresolved },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Get System Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
