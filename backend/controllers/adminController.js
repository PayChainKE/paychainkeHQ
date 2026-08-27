import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import STKRequest from '../models/STKRequest.js';
import Payee from '../models/Payee.js';
import PaymentLink from '../models/PaymentLink.js';
import RetiredMerchantCode from '../models/RetiredMerchantCode.js';
import Waitlist from '../models/Waitlist.js';
import Contact from '../models/Contact.js';
import Communication from '../models/Communication.js';
import SmsLog from '../models/SmsLog.js';
import { sendMerchantInvite, sendAdminActionOTP, sendContactDetailsChangedEmail } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { getNcbaVirtualAccountNumber, generateRandomMerchantCode, validatePhoneNumber, isValidPhoneInputFormat, NcbaValidationError } from '../utils/ncbaValidators.js';
import { generateMerchantStickerPdf, generateBulkStickerPdf, generateMerchantQrFlyerPdf } from '../utils/stickerGenerator.js';
import { LIVE_DATA_CUTOFF } from '../config/liveDataCutoff.js';
import { provisionMerchantWallet } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import { normalizeKraPin, isValidKraPin, KRA_PIN_FORMAT_HINT } from '../utils/kraPinValidator.js';
import { isValidEmail, EMAIL_FORMAT_HINT } from '../utils/emailValidator.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { generateBrandedQrDataUri } from '../utils/qrCode.js';
import { getCountyCentroid } from '../config/kenyaCountyCentroids.js';

// Build an `actor` shape from req.admin so audit rows attribute admin-initiated
// actions to the right operator even when the merchant is the subject.
export const adminActor = (admin) => admin ? ({
  type: 'admin',
  id:    admin._id || null,
  email: admin.email || null,
  name:  admin.name || admin.email || 'admin',
}) : { type: 'admin', id: null, email: null, name: 'admin' };

// Allowed sensitive actions an admin can request against a merchant.
const ACTION_LABELS = {
  lock: 'Lock merchant account',
  unlock: 'Unlock merchant account',
  delete: 'Permanently delete merchant account',
  reset_contact: 'Reset merchant primary email/phone',
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

const MERCHANT_DASHBOARD_URL =
  process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

// Generate every common storage variation of a Kenyan phone number so we can
// detect duplicates regardless of how a previous record was saved (e.g. `0790...`,
// `254790...`, `+254790...`, bare `790...`).
export const phoneVariations = (raw) => {
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
// KES-normalised volume expression reused across all aggregations in this file.
// fx_swap and settlement transactions store `amount` in USDC; `kesAmount` holds
// the correct KES equivalent. Using raw $amount causes tiny USDC values to
// appear instead of real KES figures in every chart and stat.
const KES_VOL_REAL = {
  $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }]
};

const USDC_VOL_REAL = {
  $ifNull: ['$usdcAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, '$amount', 0] }]
};

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
    const oneDayAgo    = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Run recent-activity and all-time aggregations in parallel.
    const [txnAgg, lifetimeAgg] = await Promise.all([
      // 30d window: counts + 30d KES volume + last txn timestamp
      Transaction.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$merchantId',
            txnCount30d: { $sum: 1 },
            txnCount24h: { $sum: { $cond: [{ $gte: ['$createdAt', oneDayAgo] }, 1, 0] } },
            volume30d:   { $sum: KES_VOL_REAL },
            usdcVolume30d: { $sum: USDC_VOL_REAL },
            lastTxnAt:   { $max: '$createdAt' },
          },
        },
      ]),
      // All-time: total KES volume + count + per-type breakdown since account creation
      Transaction.aggregate([
        {
          $group: {
            _id: '$merchantId',
            totalVolume: { $sum: KES_VOL_REAL },
            totalUsdcVolume: { $sum: USDC_VOL_REAL },
            totalCount:  { $sum: 1 },
            inbound:     { $sum: { $cond: [{ $eq: ['$type', 'inbound']    }, KES_VOL_REAL, 0] } },
            outbound:    { $sum: { $cond: [{ $eq: ['$type', 'outbound']   }, KES_VOL_REAL, 0] } },
            bulk_pay:    { $sum: { $cond: [{ $eq: ['$type', 'bulk_pay']   }, KES_VOL_REAL, 0] } },
            fx_swap:     { $sum: { $cond: [{ $eq: ['$type', 'fx_swap']    }, KES_VOL_REAL, 0] } },
            settlement:  { $sum: { $cond: [{ $eq: ['$type', 'settlement'] }, KES_VOL_REAL, 0] } },
          },
        },
      ]),
    ]);

    const txnByMerchant      = new Map(txnAgg.map((r) => [String(r._id), r]));
    const lifetimeByMerchant = new Map(lifetimeAgg.map((r) => [String(r._id), r]));

    const enriched = merchants.map((m) => {
      const t = txnByMerchant.get(String(m._id));
      const l = lifetimeByMerchant.get(String(m._id));
      const lastActivityAt = [m.lastLogin, t?.lastTxnAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0);
      const lastActivityDate = lastActivityAt ? new Date(lastActivityAt) : null;
      const riskSignals = computeRiskSignals(m, t);
      delete m.passwordResetExpires;
      return {
        ...m,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(m.ncbaMerchantCode),
        txnCount30d:  t?.txnCount30d  || 0,
        txnCount24h:  t?.txnCount24h  || 0,
        volume30d:    t?.volume30d     || 0,
        usdcVolume30d: t?.usdcVolume30d || 0,
        totalVolume:  l?.totalVolume   || 0,
        totalUsdcVolume: l?.totalUsdcVolume || 0,
        totalCount:   l?.totalCount    || 0,
        volumeByType: {
          inbound:    l?.inbound    || 0,
          outbound:   l?.outbound   || 0,
          bulk_pay:   l?.bulk_pay   || 0,
          fx_swap:    l?.fx_swap    || 0,
          settlement: l?.settlement || 0,
        },
        lastActivityAt: lastActivityDate,
        activityTier:   tierFor(lastActivityDate),
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

    const merchant = await Merchant.findById(id).select('email phone businessName status');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    // No-op guards — also stops admin from racking up OTPs against a no-op.
    if (action === 'lock' && merchant.status === 'locked') {
      return res.status(409).json({ error: 'Account is already locked.' });
    }
    if (action === 'unlock' && merchant.status !== 'locked') {
      return res.status(409).json({ error: 'Account is not locked.' });
    }

    // reset_contact carries its own payload (the new email/phone) which must
    // be validated up front and bound into the OTP, so confirm-time can
    // apply exactly what was requested here rather than trusting whatever
    // the client resubmits alongside the OTP.
    let payload = null;
    if (action === 'reset_contact') {
      const { email: rawEmail, phone: rawPhone } = req.body || {};
      const newEmail = rawEmail != null && String(rawEmail).trim() !== ''
        ? String(rawEmail).trim().toLowerCase()
        : null;
      let newPhone = null;
      if (rawPhone != null && String(rawPhone).trim() !== '') {
        try {
          newPhone = validatePhoneNumber(rawPhone);
        } catch (e) {
          if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
          throw e;
        }
      }
      if (!newEmail && !newPhone) {
        return res.status(400).json({ error: 'Provide a new email and/or phone number to reset.' });
      }
      if (newEmail && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(newEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      if (newEmail && newEmail === merchant.email) {
        return res.status(400).json({ error: "That's already this merchant's email." });
      }
      if (newPhone && newPhone === merchant.phone) {
        return res.status(400).json({ error: "That's already this merchant's phone number." });
      }
      if (newEmail && await Merchant.exists({ email: newEmail, _id: { $ne: merchant._id } })) {
        return res.status(409).json({ error: 'Another merchant already uses that email.' });
      }
      if (newPhone && await Merchant.exists({ phone: { $in: phoneVariations(newPhone) }, _id: { $ne: merchant._id } })) {
        return res.status(409).json({ error: 'Another merchant already uses that phone number.' });
      }
      payload = { ...(newEmail ? { email: newEmail } : {}), ...(newPhone ? { phone: newPhone } : {}) };
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    admin.pendingAction = {
      action,
      targetId: merchant._id,
      otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      payload,
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

    // Only the otpHash subfield is `select: false` — projecting both
    // `pendingAction` and `pendingAction.otpHash` would trigger a MongoDB
    // path-collision error (code 31249). Loading just the hash brings the
    // rest of the subdoc along via the default projection.
    const admin = await Admin.findById(req.admin._id).select('+pendingAction.otpHash');
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
      // Same "Sign Out All Devices" mechanism merchantAuthController.js uses
      // — forces every already-issued JWT to fail protectMerchant's
      // tokenVersion check immediately, rather than relying solely on the
      // status==='locked' check to catch it on the next request.
      merchant.tokenVersion = (merchant.tokenVersion || 0) + 1;
      await merchant.save();
      logAudit({
        action: 'admin.merchant.locked', category: 'admin', severity: 'critical',
        message: 'Account locked by admin (OTP-verified)',
        merchant, actor: adminActor(admin), req,
      });
    } else if (action === 'unlock') {
      merchant.status = 'active';
      merchant.lockedAt = null;
      merchant.lockedBy = null;
      await merchant.save();
      logAudit({
        action: 'admin.merchant.unlocked', category: 'admin', severity: 'success',
        message: 'Account unlocked by admin (OTP-verified)',
        merchant, actor: adminActor(admin), req,
      });
    } else if (action === 'reset_contact') {
      const payload = pa.payload || {};
      const before = { email: merchant.email, phone: merchant.phone };
      if (payload.email) merchant.email = payload.email;
      if (payload.phone) merchant.phone = payload.phone;
      // Email/phone are both login-critical (password login uses email;
      // phone receives login OTPs for merchants who use that channel) —
      // force every already-issued JWT to fail protectMerchant's
      // tokenVersion check, same as lock, so a session opened under the old
      // identity can't keep riding on it after the reset.
      merchant.tokenVersion = (merchant.tokenVersion || 0) + 1;
      await merchant.save();
      logAudit({
        action: 'admin.merchant.contact_reset', category: 'admin', severity: 'critical',
        message: `Primary contact reset by admin (OTP-verified) — email "${before.email}" -> "${merchant.email}", phone "${before.phone}" -> "${merchant.phone}"`,
        merchant, actor: adminActor(admin), req,
        metadata: { before, after: { email: merchant.email, phone: merchant.phone } },
      });

      // Best-effort notice to whoever controlled the OLD contact details —
      // if this reset wasn't legitimate (compromised admin, fat-fingered
      // merchant), the real merchant is the one who still has access to the
      // old email/phone, not the new ones just set.
      if (before.email) {
        sendContactDetailsChangedEmail(before.email, merchant.name, {
          emailChanged: payload.email ? { from: before.email, to: merchant.email } : null,
          phoneChanged: payload.phone ? { from: before.phone, to: merchant.phone } : null,
        }).catch((err) => console.error('Contact-changed notification email failed:', err));
      }
      if (before.phone) {
        safeSendSMS({
          to: before.phone,
          message: "PayChain Security: Your account contact details were changed by an admin. If this wasn't you, contact support@paychain.co.ke now.",
        }).catch((err) => console.error('Contact-changed notification SMS failed:', err));
      }
    } else if (action === 'delete') {
      // Hard delete: remove the merchant + their non-financial owned
      // records only. Transaction and PayoutBatch are real settled-money
      // history — the platform's revenue page (GMV, GPR, gross platform
      // volume, per-stream fees) and the admin Transactions list are both
      // sourced directly from Transaction, so deleting a merchant's rows
      // used to silently shrink every lifetime revenue figure the moment
      // they were removed. Those two collections are deliberately excluded
      // from this cascade now — real money moved, and that record has to
      // survive the merchant who moved it (see the equivalent carve-out
      // already in place for RevenueSweep, revenueController.js's
      // getRevenueSweeps). Everything else here is pre-transaction
      // merchant *configuration* (saved bulk-pay recipients, created
      // payment link definitions, individual STK prompt attempts) with no
      // standalone financial-reporting significance, so it's still fully
      // removed.
      // Log BEFORE deletion so we keep the merchant denormalised metadata.
      logAudit({
        action: 'admin.merchant.deleted', category: 'admin', severity: 'critical',
        message: `Account permanently deleted — "${merchant.businessName || merchant.email}"`,
        merchant, actor: adminActor(admin), req,
      });
      // Retire this merchant's NCBA account code permanently, before
      // deleting it, so the random generator never hands it out to a
      // future, unrelated merchant (see RetiredMerchantCode.js for why
      // that matters).
      const retirements = [];
      if (merchant.ncbaMerchantCode) {
        retirements.push({ type: 'ncbaMerchantCode', code: merchant.ncbaMerchantCode, formerMerchantId: merchant._id, formerBusinessName: merchant.businessName || null });
      }

      await Promise.all([
        STKRequest.deleteMany({ merchantId: merchant._id }),
        Payee.deleteMany({ merchantId: merchant._id }),
        PaymentLink.deleteMany({ merchantId: merchant._id }),
        retirements.length
          ? RetiredMerchantCode.insertMany(retirements, { ordered: false }).catch((err) => {
              // A duplicate-key here just means this code was already
              // retired (e.g. a prior partial delete) — never let it block
              // the actual deletion.
              console.error('Failed to retire merchant code(s):', err?.message || err);
            })
          : Promise.resolve(),
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
          : action === 'reset_contact'
            ? 'Primary email/phone updated. The merchant has been signed out everywhere.'
            : 'Merchant account unlocked.',
      data: action === 'reset_contact' ? { email: merchant.email, phone: merchant.phone } : undefined,
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

    logAudit({
      action: 'admin.merchant.flagged', category: 'admin', severity: 'warning',
      message: `Flagged for review — "${trimmed}"`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { reason: trimmed },
    });

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

    logAudit({
      action: 'admin.merchant.unflagged', category: 'admin', severity: 'success',
      message: 'Cleared suspicious-activity flag',
      merchant, actor: adminActor(req.admin), req,
    });

    res.json({ success: true, message: 'Flag cleared.' });
  } catch (error) {
    console.error('Unflag Merchant Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

/**
 * Proxies place search to OpenStreetMap's Nominatim geocoder, for the
 * Merchants Map location picker. Server-side because Nominatim's public
 * instance doesn't send CORS headers (a direct browser fetch silently
 * fails with nothing readable), and because their usage policy asks
 * programmatic callers to identify themselves via a real User-Agent,
 * which a browser can't set anyway.
 * @route   GET /api/admin/geocode?q=...
 * @access  Private/Admin (owner, admin, analyst — not officer)
 */
export const geocodeSearch = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.json({ success: true, results: [] });

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ke&limit=8&q=${encodeURIComponent(q)}`;
    const nominatimRes = await fetch(url, {
      headers: {
        // Required by Nominatim's usage policy for non-interactive callers.
        'User-Agent': 'PayChain-AdminDashboard/1.0 (support@paychain.co.ke)',
        Accept: 'application/json',
      },
    });
    if (!nominatimRes.ok) {
      return res.status(502).json({ error: 'Place search is temporarily unavailable.' });
    }
    const data = await nominatimRes.json();
    const results = (Array.isArray(data) ? data : []).map((r) => ({
      place_id: r.place_id,
      display_name: r.display_name,
      type: r.type,
      lat: r.lat,
      lon: r.lon,
    }));
    res.json({ success: true, results });
  } catch (error) {
    console.error('Geocode Search Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Loose Kenya bounding box — just a sanity check against fat-finger/typo
// coordinates (e.g. a swapped lat/lng), not a precise border. Slightly
// generous on every side.
const KENYA_BOUNDS = { minLat: -5, maxLat: 6, minLng: 33, maxLng: 42 };

/**
 * Merchants Map view. Every merchant with a manually pin-dropped exact
 * location (setMerchantLocation below) OR a signup-time county shows up —
 * the county ones fall back to that county's approximate centroid
 * (config/kenyaCountyCentroids.js), so a merchant appears on the map the
 * moment they sign up, with no admin action required. Since every merchant
 * in the same county resolves to the same centroid, Leaflet's marker
 * clustering on the frontend naturally shows a count bubble per county —
 * exactly the "how many merchants in each location" view this is for. An
 * admin's manual pin (more precise, an actual business location) always
 * takes priority over the county fallback when both exist. Returns a
 * lightweight payload meant to be polled periodically by the map, not the
 * full merchant record.
 * @route   GET /api/admin/merchants/map
 * @access  Private/Admin (owner, admin, analyst — not officer)
 */
export const getMerchantsMap = async (req, res) => {
  try {
    const merchants = await Merchant.find({
      $or: [{ 'mapLocation.lat': { $ne: null } }, { county: { $ne: null } }],
    })
      .select('businessName phone businessType status kybStatus mapLocation county businessArea')
      .lean();

    if (merchants.length === 0) return res.json({ success: true, merchants: [] });

    // Scoped to just the merchants actually being plotted — cheap even
    // without a date filter, unlike getMerchants' unscoped 30d/all-time
    // aggregations above.
    const ids = merchants.map((m) => m._id);
    const txnAgg = await Transaction.aggregate([
      { $match: { merchantId: { $in: ids } } },
      { $group: { _id: '$merchantId', lastTxnAt: { $max: '$createdAt' } } },
    ]);
    const lastTxnByMerchant = new Map(txnAgg.map((r) => [String(r._id), r.lastTxnAt]));

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const result = merchants
      .map((m) => {
        let location;
        if (m.mapLocation?.lat != null) {
          location = { lat: m.mapLocation.lat, lng: m.mapLocation.lng, label: m.mapLocation.label || '', isApproximate: false };
        } else {
          const centroid = getCountyCentroid(m.county);
          if (!centroid) return null; // county string didn't match any known county — nothing to plot
          location = {
            lat: centroid.lat,
            lng: centroid.lng,
            label: m.businessArea ? `${m.businessArea}, ${m.county}` : m.county,
            isApproximate: true,
          };
        }
        const lastTxnAt = lastTxnByMerchant.get(String(m._id)) || null;
        return {
          _id: m._id,
          businessName: m.businessName,
          phone: m.phone,
          businessType: m.businessType || null,
          status: m.status,
          kybStatus: m.kybStatus || null,
          location,
          lastTxnAt,
          activeRecently: !!(lastTxnAt && new Date(lastTxnAt).getTime() >= oneDayAgo),
        };
      })
      .filter(Boolean);

    res.json({ success: true, merchants: result });
  } catch (error) {
    console.error('Get Merchants Map Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

/**
 * Manually pin a merchant's EXACT location on the map — overrides the
 * approximate county-centroid fallback getMerchantsMap otherwise uses, for
 * when an admin knows precisely where the business actually is.
 * @route   PATCH /api/admin/merchants/:id/location
 * @access  Private/Admin (owner, admin)
 */
export const setMerchantLocation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const label = String(req.body?.label || '').trim().slice(0, 100);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng must be numbers.' });
    }
    if (
      lat < KENYA_BOUNDS.minLat || lat > KENYA_BOUNDS.maxLat ||
      lng < KENYA_BOUNDS.minLng || lng > KENYA_BOUNDS.maxLng
    ) {
      return res.status(400).json({ error: 'Coordinates look like they fall outside Kenya — double-check the pin.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    merchant.mapLocation = { lat, lng, label, setAt: new Date(), setBy: req.admin._id };
    await merchant.save();

    logAudit({
      action: 'admin.merchant.location_set', category: 'admin', severity: 'info',
      message: `Map pin set for ${merchant.businessName}${label ? ` (${label})` : ''}`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { lat, lng, label },
    });

    res.json({ success: true, location: merchant.mapLocation });
  } catch (error) {
    console.error('Set Merchant Location Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

/**
 * Remove a merchant's exact map pin (e.g. it was placed in the wrong spot).
 * They don't disappear from the map — getMerchantsMap falls back to their
 * county's approximate centroid, same as any merchant who was never pinned.
 * @route   DELETE /api/admin/merchants/:id/location
 * @access  Private/Admin (owner, admin)
 */
export const removeMerchantLocation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    merchant.mapLocation = { lat: null, lng: null, label: '', setAt: null, setBy: null };
    await merchant.save();

    logAudit({
      action: 'admin.merchant.location_removed', category: 'admin', severity: 'info',
      message: `Map pin removed for ${merchant.businessName}`,
      merchant, actor: adminActor(req.admin), req,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove Merchant Location Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

/**
 * Download one merchant's branded paybill sticker (PDF) — same generator
 * as the merchant dashboard's own "Download Sticker" button and the
 * welcome-email attachment, just reachable by an admin for any merchant
 * rather than gated to the merchant's own account.
 * @route   GET /api/admin/merchants/:id/sticker
 * @access  Private/Admin (owner, admin, analyst — not officer)
 */
export const downloadMerchantSticker = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const accountNumber = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode);
    if (!accountNumber) {
      return res.status(400).json({ error: 'This merchant\'s bank account number is still being assigned — the sticker will be available once that\'s complete.' });
    }

    const pdfBytes = await generateMerchantStickerPdf({
      businessName: merchant.businessName,
      accountNumber,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PayChain-Sticker-${accountNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download Merchant Sticker Error:', error);
    res.status(500).json({ error: 'Failed to generate sticker.' });
  }
};

// @desc    Download a merchant's checkout QR code as a labeled, print-ready
//          PDF flyer — the same branded QR shown in the merchant dashboard
//          (mpesaController.js#generateAccountQr, cached on
//          merchant.checkoutQrCodeDataUri once first generated) composited
//          into a one-page PDF with the business name and account number
//          drawn in bold above/below it (generateMerchantQrFlyerPdf), so an
//          admin-downloaded QR reads at a distance the same way the paybill
//          sticker does — unlike the bare, unlabeled QR PNG a merchant can
//          already pull straight from their own dashboard.
// @route   GET /api/admin/merchants/:id/qr-code
// @access  Private/Admin (owner, admin, analyst — not officer)
export const downloadMerchantQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id).select('businessName ncbaMerchantCode checkoutQrCodeDataUri');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });
    const accountNumber = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode);
    if (!accountNumber) {
      return res.status(400).json({ error: 'This merchant\'s bank account number is still being assigned — the QR code will be available once that\'s complete.' });
    }

    let qrCodeDataUri = merchant.checkoutQrCodeDataUri;
    if (!qrCodeDataUri) {
      const checkoutUrl = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/pay/account/${merchant.ncbaMerchantCode}`;
      qrCodeDataUri = await generateBrandedQrDataUri(checkoutUrl);
      if (!qrCodeDataUri) {
        return res.status(502).json({ error: 'Failed to generate QR code — please try again.' });
      }
      await Merchant.updateOne({ _id: merchant._id }, { $set: { checkoutQrCodeDataUri: qrCodeDataUri } });
    }

    const qrPngBytes = Buffer.from(qrCodeDataUri.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pdfBytes = await generateMerchantQrFlyerPdf({
      businessName: merchant.businessName,
      accountNumber,
      qrPngBytes,
    });
    const safeName = (merchant.businessName || 'merchant').replace(/[^\w\-]+/g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PayChain-QR-${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download Merchant QR Code Error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
};

/**
 * Download every eligible merchant's sticker merged into one printable
 * PDF (one page per merchant) — e.g. to print a batch before a round of
 * merchant site visits. Merchants without a real 12-digit account number
 * yet are silently skipped rather than failing the whole batch; the count
 * skipped comes back in a response header so the frontend can surface it.
 * @route   GET /api/admin/merchants/stickers/bulk
 * @access  Private/Admin (owner, admin, analyst — not officer)
 */
export const downloadBulkStickers = async (req, res) => {
  try {
    const merchants = await Merchant.find({}).select('businessName ncbaMerchantCode').lean();

    const eligible = merchants
      .map((m) => ({ businessName: m.businessName, accountNumber: getNcbaVirtualAccountNumber(m.ncbaMerchantCode) }))
      .filter((m) => !!m.accountNumber);

    if (eligible.length === 0) {
      return res.status(400).json({ error: 'No merchants have a bank account number assigned yet.' });
    }

    const pdfBytes = await generateBulkStickerPdf(eligible);
    const skipped = merchants.length - eligible.length;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PayChain-Stickers-Batch-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.setHeader('X-Stickers-Included', String(eligible.length));
    res.setHeader('X-Stickers-Skipped', String(skipped));
    // Content-Disposition/custom headers aren't readable cross-origin by
    // default — explicitly exposed so the frontend can show "N skipped".
    res.setHeader('Access-Control-Expose-Headers', 'X-Stickers-Included, X-Stickers-Skipped');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download Bulk Stickers Error:', error);
    res.status(500).json({ error: 'Failed to generate sticker batch.' });
  }
};

/**
 * Update merchant features (digitalWallet, inflationShield)
 * @route   PATCH /api/admin/merchants/:id/features
 * @access  Private/Admin
 */
export const updateMerchantFeatures = async (req, res) => {
  try {
    const { id } = req.params;
    const { digitalWallet, inflationShield, cashAdvanceForm } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Initialize if it doesn't exist — matches the schema's own defaults
    // (models/Merchant.js). Was { ...: true, ...: true, cashAdvanceForm:
    // true } — contradicted the schema's own cashAdvanceForm default of
    // false (a compliance-driven "off until licensing confirmed" setting),
    // so an admin toggling any one flag on a merchant with no features
    // subdocument yet would silently enable cash advance as a side effect.
    if (!merchant.features) {
      merchant.features = { digitalWallet: false, inflationShield: false, cashAdvanceForm: false };
    }

    if (digitalWallet !== undefined) {
      merchant.features.digitalWallet = digitalWallet;
    }
    if (inflationShield !== undefined) {
      merchant.features.inflationShield = inflationShield;
    }
    if (cashAdvanceForm !== undefined) {
      merchant.features.cashAdvanceForm = cashAdvanceForm;
    }

    await merchant.save();

    logAudit({
      action: 'admin.merchant.features_updated', category: 'admin', severity: 'info',
      message: `Updated feature access (Wallet: ${merchant.features.digitalWallet}, Shield: ${merchant.features.inflationShield}, Cash Advance Form: ${merchant.features.cashAdvanceForm})`,
      merchant, actor: adminActor(req.admin), req,
    });
    
    res.json({ 
      success: true, 
      features: merchant.features, 
      message: 'Merchant features updated successfully' 
    });
  } catch (error) {
    console.error('Update features error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin manually confirms (or revokes) that a merchant's KRA PIN
//          and/or Business/License Number are genuinely real — distinct
//          from isKRAVerified, which only means the KRA PIN's format
//          passed validation and auto-sets the moment a merchant types a
//          well-formed one. Nothing sets kraAdminVerified/
//          businessNumberAdminVerified automatically; this endpoint is the
//          only way either becomes true.
// @route   PATCH /api/admin/merchants/:id/verification
// @access  Private (Admin)
export const updateMerchantVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { kraAdminVerified, businessNumberAdminVerified } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const changes = [];

    if (kraAdminVerified !== undefined) {
      if (kraAdminVerified && !merchant.kraPin) {
        return res.status(400).json({ error: 'This merchant has no KRA PIN on file yet — cannot verify it.' });
      }
      merchant.kraAdminVerified = !!kraAdminVerified;
      merchant.kraAdminVerifiedAt = kraAdminVerified ? new Date() : null;
      merchant.kraAdminVerifiedBy = kraAdminVerified ? req.admin._id : null;
      changes.push(`KRA PIN: ${kraAdminVerified ? 'verified' : 'unverified'}`);
    }

    if (businessNumberAdminVerified !== undefined) {
      if (businessNumberAdminVerified && !merchant.businessNumber) {
        return res.status(400).json({ error: 'This merchant has no Business/License Number on file yet — cannot verify it.' });
      }
      merchant.businessNumberAdminVerified = !!businessNumberAdminVerified;
      merchant.businessNumberAdminVerifiedAt = businessNumberAdminVerified ? new Date() : null;
      merchant.businessNumberAdminVerifiedBy = businessNumberAdminVerified ? req.admin._id : null;
      changes.push(`Business Number: ${businessNumberAdminVerified ? 'verified' : 'unverified'}`);
    }

    if (changes.length === 0) {
      return res.status(400).json({ error: 'Nothing to update — pass kraAdminVerified and/or businessNumberAdminVerified.' });
    }

    await merchant.save();

    logAudit({
      action: 'admin.merchant.verification_updated', category: 'admin', severity: 'info',
      message: `Updated compliance verification (${changes.join(', ')})`,
      merchant, actor: adminActor(req.admin), req,
    });

    res.json({
      success: true,
      kraAdminVerified: merchant.kraAdminVerified,
      businessNumberAdminVerified: merchant.businessNumberAdminVerified,
      message: 'Verification status updated successfully',
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Mirrors models/Merchant.js's kybDocuments.type enum and
// officerController.js's QUEUE_DOC_TYPES — kept as a separate local copy
// (not imported) since officerController.js already imports from this file,
// and importing back would create a circular dependency.
const KYC_DOC_TYPES = ['business_registration', 'kra_pin', 'national_id', 'address_proof'];

// @desc    Admin adds or replaces one KYC/KYB document for a merchant — the
//          same kybDocuments array the officer-onboarding pipeline and the
//          KYC/KYB review page (KycApplicationDetail.jsx) read from. Unlike
//          that pipeline, this endpoint isn't gated behind kybStatus, so it
//          works for every merchant — self-serve signup, admin-created, or
//          officer-onboarded — not just merchants already in the review
//          queue. Replacing an existing document resets its status back to
//          'pending' and clears any prior reviewer note, since a new file is
//          a new thing to (re-)review, not an automatic re-approval.
// @route   PATCH /api/admin/merchants/:id/kyc-documents
// @access  Private (Admin, owner/admin only)
export const updateMerchantKycDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    if (!KYC_DOC_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid document type. Must be one of: ${KYC_DOC_TYPES.join(', ')}.` });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const existing = merchant.kybDocuments.find((d) => d.type === type);
    const isReplace = !!existing;
    if (existing) {
      existing.url = req.file.path;
      existing.uploadedAt = new Date();
      existing.status = 'pending';
      existing.note = null;
    } else {
      merchant.kybDocuments.push({
        type,
        url: req.file.path,
        uploadedAt: new Date(),
        status: 'pending',
      });
    }

    await merchant.save();

    logAudit({
      action: 'admin.merchant.kyc_document_updated', category: 'admin', severity: 'info',
      message: `${isReplace ? 'Replaced' : 'Added'} KYC document (${type})`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { type, replaced: isReplace },
    });

    res.json({
      success: true,
      kybDocuments: merchant.kybDocuments,
      message: `Document ${isReplace ? 'replaced' : 'uploaded'} successfully.`,
    });
  } catch (error) {
    console.error('Update Merchant KYC Document Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin corrects/updates the business name displayed for a
//          merchant's account — the same field shown on their dashboard,
//          paybill sticker, receipts, and outbound SMS (all read
//          merchant.businessName live, nothing caches an old copy — see
//          downloadMerchantSticker below for the sticker's own on-demand
//          regeneration). Deliberately just a plain string update: unlike
//          KRA PIN/Business Number, businessName has no separate "admin
//          verified" flag to reconcile.
// @route   PATCH /api/admin/merchants/:id/business-name
// @access  Private (Admin, owner/admin only)
export const updateMerchantBusinessName = async (req, res) => {
  try {
    const { id } = req.params;
    const { businessName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    const trimmed = String(businessName ?? '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Business name is required.' });
    }
    if (trimmed.length > 80) {
      return res.status(400).json({ error: 'Business name must be 80 characters or fewer.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const previousName = merchant.businessName;
    if (previousName === trimmed) {
      return res.json({ success: true, businessName: merchant.businessName, message: 'No change.' });
    }

    merchant.businessName = trimmed;
    await merchant.save();

    logAudit({
      action: 'admin.merchant.business_name_updated', category: 'admin', severity: 'info',
      message: `Business name changed from "${previousName}" to "${trimmed}"`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { previousName, newName: trimmed },
    });

    res.json({ success: true, businessName: merchant.businessName, message: 'Business name updated successfully.' });
  } catch (error) {
    console.error('Update Merchant Business Name Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin corrects the merchant owner's display name (Merchant.name —
//          the primary contact person, distinct from businessName). Unlike
//          email/phone (see requestMerchantAction's 'reset_contact' action),
//          this carries no login/session implications, so it's a plain
//          direct update — no OTP step needed.
// @route   PATCH /api/admin/merchants/:id/contact-name
// @access  Private (Admin, owner/admin only)
export const updateMerchantContactName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    const trimmed = String(name ?? '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (trimmed.length > 80) {
      return res.status(400).json({ error: 'Name must be 80 characters or fewer.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const previousName = merchant.name;
    if (previousName === trimmed) {
      return res.json({ success: true, name: merchant.name, message: 'No change.' });
    }

    merchant.name = trimmed;
    await merchant.save();

    logAudit({
      action: 'admin.merchant.contact_name_updated', category: 'admin', severity: 'info',
      message: `Primary contact name changed from "${previousName}" to "${trimmed}"`,
      merchant, actor: adminActor(req.admin), req,
      metadata: { previousName, newName: trimmed },
    });

    res.json({ success: true, name: merchant.name, message: 'Name updated successfully.' });
  } catch (error) {
    console.error('Update Merchant Contact Name Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin adds or replaces the merchant's single self-serve signup
//          certificate (Merchant.certificateUrl) — separate from the typed,
//          multi-document kybDocuments array (see updateMerchantKycDocument
//          above), which is the officer-onboarding pipeline's own document
//          set. This is the one document self-serve merchants upload at
//          signup (merchantAuthController.js#registerMerchant), shown
//          read-only until now in both the Merchants page drawer and the
//          KYC/KYB detail page.
// @route   PATCH /api/admin/merchants/:id/certificate
// @access  Private (Admin, owner/admin only)
export const updateMerchantCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid merchant id.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No certificate file uploaded.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const isReplace = !!merchant.certificateUrl;
    merchant.certificateUrl = req.file.path;
    await merchant.save();

    logAudit({
      action: 'admin.merchant.certificate_updated', category: 'admin', severity: 'info',
      message: `${isReplace ? 'Replaced' : 'Added'} business certificate`,
      merchant, actor: adminActor(req.admin), req,
    });

    res.json({ success: true, certificateUrl: merchant.certificateUrl, message: `Certificate ${isReplace ? 'replaced' : 'uploaded'} successfully.` });
  } catch (error) {
    console.error('Update Merchant Certificate Error:', error);
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
      .select('+password +appPin +stellarEncryptedSecretKey +passwordResetExpires')
      .populate('lockedBy', 'email')
      .populate('invitedBy', 'email')
      .populate('flaggedBy', 'email')
      .populate('onboardingOfficerId', 'name email')
      .lean();
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo    = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [txnCount30d, txnCount24h, lastTxn, thirtyDayAgg, lifetimeAgg] = await Promise.all([
      Transaction.countDocuments({ merchantId: merchant._id, createdAt: { $gte: thirtyDaysAgo } }),
      Transaction.countDocuments({ merchantId: merchant._id, createdAt: { $gte: oneDayAgo } }),
      Transaction.findOne({ merchantId: merchant._id }).sort('-createdAt').select('createdAt amount status type').lean(),
      // 30d KES + USDC volume (NCBA-normalised, mirrors getMerchants)
      Transaction.aggregate([
        { $match: { merchantId: merchant._id, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            volume30d:     { $sum: KES_VOL_REAL },
            usdcVolume30d: { $sum: USDC_VOL_REAL },
          },
        },
      ]),
      // All-time KES-normalised volume by transaction type
      Transaction.aggregate([
        { $match: { merchantId: merchant._id } },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: KES_VOL_REAL },
            totalUsdcVolume: { $sum: USDC_VOL_REAL },
            totalCount:  { $sum: 1 },
            inbound:     { $sum: { $cond: [{ $eq: ['$type', 'inbound']    }, KES_VOL_REAL, 0] } },
            outbound:    { $sum: { $cond: [{ $eq: ['$type', 'outbound']   }, KES_VOL_REAL, 0] } },
            bulk_pay:    { $sum: { $cond: [{ $eq: ['$type', 'bulk_pay']   }, KES_VOL_REAL, 0] } },
            fx_swap:     { $sum: { $cond: [{ $eq: ['$type', 'fx_swap']    }, KES_VOL_REAL, 0] } },
            settlement:  { $sum: { $cond: [{ $eq: ['$type', 'settlement'] }, KES_VOL_REAL, 0] } },
          },
        },
      ]),
    ]);
    const t30 = thirtyDayAgg[0] || { volume30d: 0, usdcVolume30d: 0 };
    const lt = lifetimeAgg[0] || { totalVolume: 0, totalUsdcVolume: 0, totalCount: 0, inbound: 0, outbound: 0, bulk_pay: 0, fx_swap: 0, settlement: 0 };

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
        kraAdminVerified: merchant.kraAdminVerified,
        kraAdminVerifiedAt: merchant.kraAdminVerifiedAt,
        businessNumber: merchant.businessNumber,
        businessNumberAdminVerified: merchant.businessNumberAdminVerified,
        businessNumberAdminVerifiedAt: merchant.businessNumberAdminVerifiedAt,
        certificateUrl: merchant.certificateUrl,
        // Typed, per-document KYC/KYB trail — populated via the officer
        // onboarding pipeline, the applicant's public resubmit link, or an
        // admin directly (updateMerchantKycDocument above). kybStatus stays
        // undefined for merchants never routed through officer review, same
        // as the schema default.
        kybStatus: merchant.kybStatus || null,
        kybDocuments: merchant.kybDocuments || [],
        // Account
        // The raw 8-digit code NCBA's Account-Level Notification webhook
        // matches against (extractMerchantCode in
        // utils/ncbaAccountNotificationValidators.js) — needed for NCBA to
        // test attribution against a real merchant even before the
        // institution prefix is assigned, since ncbaVirtualAccountNumber
        // below is null until then.
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        // Real bank account number, paid into via NCBA's Paybill (880100) —
        // null until NCBA_INSTITUTION_PREFIX is configured.
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
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
        // Feature access toggles. digitalWallet/inflationShield fall back to
        // enabled (not the current schema default of false) deliberately —
        // this mirrors how the merchant-facing frontend's own `!== false`
        // checks already treat a genuinely missing features subdocument (a
        // pre-existing merchant from before this field existed) as visible,
        // so the admin panel doesn't show a toggle as "off" while that
        // merchant can actually still see the feature. cashAdvanceForm has
        // no such history — its schema default has always been false — so
        // it falls back to false here to match, not true.
        features: merchant.features || { digitalWallet: true, inflationShield: true, cashAdvanceForm: false },
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
        // The single Payment PIN, used for every money-movement flow
        // including bulk-pay authorization — there's no separate bulk-pay
        // PIN anymore.
        hasAppPin: !!merchant.appPin,
        hasStellarKey: !!merchant.stellarEncryptedSecretKey,
        biometricsEnabled: merchant.biometricsEnabled,
        // Activity
        lastLogin: merchant.lastLogin,
        loginCount: merchant.loginCount,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
        activityTier: tierFor(lastActivityAt ? new Date(lastActivityAt) : null),
        txnCount30d,
        txnCount24h,
        volume30d: t30.volume30d || 0,
        usdcVolume30d: t30.usdcVolume30d || 0,
        totalVolume: lt.totalVolume || 0,
        totalUsdcVolume: lt.totalUsdcVolume || 0,
        totalCount: lt.totalCount || 0,
        volumeByType: {
          inbound:    lt.inbound    || 0,
          outbound:   lt.outbound   || 0,
          bulk_pay:   lt.bulk_pay   || 0,
          fx_swap:    lt.fx_swap    || 0,
          settlement: lt.settlement || 0,
        },
        lastTransaction: lastTxn ? {
          createdAt: lastTxn.createdAt,
          amount: lastTxn.amount,
          status: lastTxn.status,
        } : null,
        // Onboarding-officer pipeline due diligence — absent (null/[]) for
        // self-serve/admin-direct merchants, since kybStatus is only ever
        // set by officerController.js's createApplication.
        kybStatus: merchant.kybStatus || null,
        riskTier: merchant.riskTier || null,
        onboardingOfficer: merchant.onboardingOfficerId
          ? { name: merchant.onboardingOfficerId.name, email: merchant.onboardingOfficerId.email }
          : null,
        kybDocuments: merchant.kybDocuments || [],
        businessPhotos: merchant.businessPhotos || [],
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
    let { name, email, phone, businessName, kraPin, businessNumber, isDemoMerchant } = req.body || {};
    isDemoMerchant = isDemoMerchant === true;

    if (!name || !email || !phone || !businessName) {
      return res.status(400).json({ error: 'Name, email, phone and business name are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: EMAIL_FORMAT_HINT });
    }

    if (!isValidPhoneInputFormat(phone)) {
      return res.status(400).json({ error: 'Enter a valid Kenyan mobile number starting with +254, 07, or 01 (e.g. 0712 345 678).' });
    }
    try {
      validatePhoneNumber(phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) {
        return res.status(400).json({ error: 'Enter a valid Kenyan mobile number (e.g. 0712 345 678).' });
      }
      throw e;
    }

    email = String(email).trim().toLowerCase();
    phone = String(phone).replace(/\s+/g, '');
    name = String(name).trim();
    businessName = String(businessName).trim();
    kraPin = kraPin ? normalizeKraPin(kraPin) : null;
    businessNumber = businessNumber ? String(businessNumber).trim() : null;

    if (kraPin && !isValidKraPin(kraPin)) {
      return res.status(400).json({ error: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}` });
    }

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

    // paybillAccount (the old 5-digit shared-Paybill sub-account) is no
    // longer assigned to any merchant, including demo ones — it existed
    // only to let the (now-removed) Safaricom Daraja C2B confirmationURL
    // webhook match an incoming payment's BillRefNumber to a merchant. The
    // live payment rail for everyone is the NCBA virtual account
    // (ncbaMerchantCode), auto-assigned by the Merchant model's pre-save hook.

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
      registrationSource: 'web',
      isVerified: true,
      invitedBy: req.admin?._id || null,
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
      isDemoMerchant,
    });

    // Deliverable 1 of the Stellar grant pipeline: a demo merchant's testnet
    // wallet is provisioned automatically right here, not via the normal
    // opt-in activate-wallet flow real merchants use. Awaited (not
    // fire-and-forget) so a Friendbot/Horizon failure is reported to the
    // admin immediately rather than silently leaving the merchant walletless
    // with no visible error — this only runs for demo merchants, an
    // infrequent admin action, so the extra latency is an acceptable
    // trade-off for that visibility.
    if (isDemoMerchant) {
      try {
        const stellarWallet = await provisionMerchantWallet();
        merchant.stellarPublicKey = stellarWallet.publicKey;
        merchant.stellarEncryptedSecretKey = encryptKey(stellarWallet.secretKey);
        await merchant.save();
      } catch (err) {
        console.error(`❌ Demo merchant Stellar wallet provisioning failed for ${merchant._id}:`, err.message);
        return res.status(201).json({
          success: true,
          message: 'Merchant created, but Stellar wallet provisioning failed — retry via the merchant\'s Wallet page.',
          warning: err.message,
          data: { _id: merchant._id, email: merchant.email },
        });
      }
    }

    const setupLink = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;

    sendMerchantInvite(email, name, businessName, setupLink, getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode), merchant.ncbaMerchantCode).catch((err) => {
      console.error(`📧 Failed to send invite to ${email}:`, err);
    });

    logAudit({
      action: 'admin.merchant.created', category: 'admin', severity: 'success',
      message: `Onboarded by admin — invite sent to ${email}`,
      merchant, actor: adminActor(req.admin), req,
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
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
        isDemoMerchant: merchant.isDemoMerchant,
        stellarPublicKey: merchant.stellarPublicKey,
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
    // Capped at 5000 (not the usual ~100) so the admin CSV export can pull a
    // full filtered range in one request. Admin-only route, no public abuse vector.
    const limit = Math.min(5000, Math.max(5, parseInt(req.query.limit, 10) || 25));
    const type = req.query.type && req.query.type !== 'all' ? req.query.type : null;
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const q = (req.query.q || '').trim();

    const KES_VOL_REAL = {
      $sum: { $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }] }
    };
    const USDC_VOL_REAL = {
      $sum: { $ifNull: ['$usdcAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, '$amount', 0] }] }
    };

    const now = new Date();
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365 * 5;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const baseFilter = { createdAt: { $gte: since } };
    if (type) baseFilter.type = type;
    if (status) baseFilter.status = status;
    if (q) {
      // Escape regex specials — an unescaped user-controlled pattern here
      // (e.g. "(a+)+$") is a ReDoS vector against the event loop.
      const safeQ = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      baseFilter.$or = [
        { reference: { $regex: safeQ, $options: 'i' } },
        { accountNumber: { $regex: safeQ, $options: 'i' } },
        { 'sender.name': { $regex: safeQ, $options: 'i' } },
        { 'sender.id': { $regex: safeQ, $options: 'i' } },
      ];
    }

    const [total, txns, allInRange, prev, typeAgg, daily, lifetimeAgg] = await Promise.all([
      Transaction.countDocuments(baseFilter),
      Transaction.find(baseFilter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchantId', 'businessName status flagged')
        .lean(),
      // Aggregates over the FULL range (ignore q/type/status filters so KPIs reflect headline performance, not user's view)
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            kesVolume: KES_VOL_REAL,
            usdcVolume: USDC_VOL_REAL,
            completed: { $sum: { $cond: [{ $in: ['$status', ['completed', 'verified']] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: prevSince, $lt: since } } },
        { $group: { _id: null, count: { $sum: 1 }, kesVolume: KES_VOL_REAL, usdcVolume: USDC_VOL_REAL } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$type', count: { $sum: 1 }, volume: KES_VOL_REAL } },
        { $sort: { volume: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: range === '24h' ? '%Y-%m-%d %H:00' : '%Y-%m-%d', date: '$createdAt' } },
            volume: KES_VOL_REAL,
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: { status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, kesVolume: KES_VOL_REAL, usdcVolume: USDC_VOL_REAL } },
      ]),
    ]);

    const cur = allInRange[0] || { count: 0, kesVolume: 0, usdcVolume: 0, completed: 0, failed: 0, pending: 0 };
    const prv = prev[0] || { count: 0, kesVolume: 0, usdcVolume: 0 };
    const pct = (a, b) => (b ? Number((((a - b) / b) * 100).toFixed(1)) : (a > 0 ? 100 : 0));

    const settlementRatio = cur.count > 0 ? Number(((cur.completed / cur.count) * 100).toFixed(1)) : 100;
    
    res.json({
      success: true,
      data: {
        range,
        kpis: {
          volume: { value: cur.kesVolume, change: pct(cur.kesVolume, prv.kesVolume) },
          usdcVolume: { value: cur.usdcVolume, change: pct(cur.usdcVolume, prv.usdcVolume) },
          count: { value: cur.count, change: pct(cur.count, prv.count) },
          settlementRatio,
          estimatedFees: 0, // Removed mock fee data, real fee ledger not yet implemented
          failed: cur.failed,
          pending: cur.pending,
          lifetimeVolume: lifetimeAgg[0]?.kesVolume || 0,
          lifetimeUsdcVolume: lifetimeAgg[0]?.usdcVolume || 0,
        },
        assets: {
          kes: cur.kesVolume,
          usdc: cur.usdcVolume,
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

    // Transaction-only clamp: the five weeks before LIVE_DATA_CUTOFF are
    // pre-production sandbox/simulated transactions, never real money —
    // every Transaction aggregation below uses these instead of the raw
    // since/prevSince above. Deliberately NOT applied to the Merchant
    // queries (newMerchantsCurr/Prev etc.) — real merchants genuinely did
    // sign up during that window, that history is real and should count.
    const txnSince = since.getTime() < LIVE_DATA_CUTOFF.getTime() ? LIVE_DATA_CUTOFF : since;
    const txnPrevSince = prevSince.getTime() < LIVE_DATA_CUTOFF.getTime() ? LIVE_DATA_CUTOFF : prevSince;

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

    // Real KES and USDC volume definitions
    const kesVolReal = {
      $sum: { $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }] }
    };
    const usdcVolReal = {
      $sum: { $ifNull: ['$usdcAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, '$amount', 0] }] }
    };

    // ── Transaction / GTV / GMV ────────────────────────────────────────────
    const [gtvCurr, gtvPrev, gtvSeries, lifetimeAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: txnSince }, status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, kesVolume: kesVolReal, usdcVolume: usdcVolReal } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: txnPrevSince, $lt: txnSince }, status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, kesVolume: kesVolReal, usdcVolume: usdcVolReal } },
      ]),
      // Daily volume series for the sparkline / area chart.
      Transaction.aggregate([
        { $match: { createdAt: { $gte: txnSince }, status: { $in: ['completed', 'verified'] } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            kesVolume: kesVolReal,
            usdcVolume: usdcVolReal,
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: LIVE_DATA_CUTOFF }, status: { $in: ['completed', 'verified'] } } },
        { $group: { _id: null, count: { $sum: 1 }, kesVolume: kesVolReal, usdcVolume: usdcVolReal } },
      ]),
    ]);

    const gtvVolume = gtvCurr[0]?.kesVolume || 0;
    const gtvVolumePrev = gtvPrev[0]?.kesVolume || 0;
    const gmvVolume = gtvCurr[0]?.usdcVolume || 0;
    const gmvVolumePrev = gtvPrev[0]?.usdcVolume || 0;
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

    // Always-on signup time series at four granularities for the Overview chart.
    // Independent of the request's `range` so each toggle shows a consistent
    // trailing window. All series are densified — any bucket with no signups
    // becomes a zero so the chart has a clean, evenly spaced axis.

    // ── Daily · last 30 days ───────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const dailySignupsAgg = await Merchant.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const byDay = new Map(dailySignupsAgg.map((r) => [r._id, r.count]));
    const dailySignups = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailySignups.push({
        bucket: key,
        // Show only every ~5th label so the x-axis doesn't get crowded.
        label: i % 5 === 0 ? d.toLocaleString('en-US', { day: '2-digit', month: 'short' }) : '',
        tooltip: d.toLocaleString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }),
        count: byDay.get(key) || 0,
      });
    }

    // ── Weekly · last 12 ISO weeks ─────────────────────────────────────
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 7 * 11);
    twelveWeeksAgo.setHours(0, 0, 0, 0);
    const weeklySignupsAgg = await Merchant.aggregate([
      { $match: { createdAt: { $gte: twelveWeeksAgo } } },
      {
        $group: {
          _id: { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const isoKey = (y, w) => `${y}-W${String(w).padStart(2, '0')}`;
    const isoWeekOf = (date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return { year: d.getUTCFullYear(), week };
    };
    const byWeek = new Map(weeklySignupsAgg.map((r) => [isoKey(r._id.year, r._id.week), r.count]));
    const weeklySignups = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - 7 * i);
      const { year, week } = isoWeekOf(d);
      const key = isoKey(year, week);
      weeklySignups.push({
        bucket: key,
        label: `W${week}`,
        tooltip: `Week ${week} · ${year}`,
        count: byWeek.get(key) || 0,
      });
    }

    // ── Monthly · last 12 months ───────────────────────────────────────
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
    const byMonth = new Map(monthlySignupsAgg.map((r) => [r._id, r.count]));
    const monthlySignups = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySignups.push({
        bucket: key,
        month: key, // legacy alias (existing consumers)
        label: d.toLocaleString('en-US', { month: 'short' }),
        tooltip: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        count: byMonth.get(key) || 0,
      });
    }

    // ── Yearly · last 5 years ──────────────────────────────────────────
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 4);
    fiveYearsAgo.setMonth(0, 1);
    fiveYearsAgo.setHours(0, 0, 0, 0);
    const yearlySignupsAgg = await Merchant.aggregate([
      { $match: { createdAt: { $gte: fiveYearsAgo } } },
      {
        $group: { _id: { $year: '$createdAt' }, count: { $sum: 1 } },
      },
    ]);
    const byYear = new Map(yearlySignupsAgg.map((r) => [String(r._id), r.count]));
    const yearlySignups = [];
    const currentYear = new Date().getFullYear();
    for (let i = 4; i >= 0; i -= 1) {
      const yr = currentYear - i;
      yearlySignups.push({
        bucket: String(yr),
        label: String(yr),
        tooltip: String(yr),
        count: byYear.get(String(yr)) || 0,
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

    // ── Top merchants by volume ──────────────────────────────────────
    // ── Top merchants by volume ──────────────────────────────────────
    const topMerchantsRaw = await Transaction.aggregate([
      { $match: { createdAt: { $gte: txnSince }, status: { $in: ['completed', 'verified'] }, merchantId: { $ne: null } } },
      {
        $group: {
          _id: '$merchantId',
          txnCount: { $sum: 1 },
          volume: kesVolReal,
        },
      },
      { $sort: { volume: -1 } },
      { $limit: 8 },
    ]);
    const topMerchantIds = topMerchantsRaw.map((r) => r._id);
    const topMerchantDocs = await Merchant.find({ _id: { $in: topMerchantIds } })
      .select('businessName name status flagged')
      .lean();
    const docMap = new Map(topMerchantDocs.map((d) => [String(d._id), d]));
    const topMerchants = topMerchantsRaw.map((row) => {
      const doc = docMap.get(String(row._id)) || {};
      return {
        _id: row._id,
        businessName: doc.businessName || 'Deleted Merchant',
        name: doc.name || '',
        status: doc.status || 'active',
        flagged: !!doc.flagged,
        txnCount: row.txnCount,
        volume: row.volume,
      };
    });

    // ── Transaction type mix ─────────────────────────────────────────
    // All statuses included so fx_swap / settlement rows are never filtered out.
    const txnTypeMix = await Transaction.aggregate([
      { $match: { createdAt: { $gte: txnSince } } },
      { $group: { _id: '$type', count: { $sum: 1 }, volume: kesVolReal } },
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
          gmv: {
            value: gmvVolume,
            prev: gmvVolumePrev,
            change: pctChange(gmvVolume, gmvVolumePrev),
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
          lifetimeVolume: lifetimeAgg[0]?.kesVolume || 0,
          lifetimeUsdcVolume: lifetimeAgg[0]?.usdcVolume || 0,
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
        gtvSeries: gtvSeries.map((r) => ({ date: r._id, count: r.count, volume: r.kesVolume })),
        signupsSeries: signupsSeries.map((r) => ({ date: r._id, count: r.count })),
        dailySignups,
        weeklySignups,
        monthlySignups,
        yearlySignups,
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

    // Real usage signal, distinct from recentMerchants (new signups) —
    // merchants who actually moved money in the last 30 days, not just
    // ones who exist. Distinct merchantId count, not transaction count.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeMerchantIds = await Transaction.distinct('merchantId', { createdAt: { $gte: thirtyDaysAgo }, merchantId: { $ne: null } });
    const activeMerchants30d = activeMerchantIds.length;

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
        activeMerchants30d,
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

// @desc    Live view of every STK Push / Dynamic QR collection attempt —
//          lets admin see a customer payment resolve to success/failed in
//          real time (the merchant dashboard polls this same underlying
//          data every 3s; this is the admin-side equivalent, since prior to
//          this there was no admin visibility into STKRequest at all —
//          only the resulting Transaction once/if one gets created).
//          `status` still shows 'pending' for a push mid-flight (customer
//          hasn't entered their PIN yet, or NCBA's poll hasn't caught up —
//          see pollAndResolveNcbaStkPush's 2s poll in mpesaController.js).
// @route   GET /api/admin/stk-requests
// @access  Private (Admin)
export const getStkRequests = async (req, res) => {
  try {
    // Client polls + paginates this at 25/page (same convention as
    // getRevenueSweeps) — 500 recent rows is cheap to fetch up front and
    // covers many hours of real traffic without needing a date-range query.
    const requests = await STKRequest.find({})
      .sort('-createdAt')
      .limit(500)
      .populate('merchantId', 'businessName email')
      .lean();
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get STK Requests Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Transaction Audit ────────────────────────────────────────────────────
// Bank cash-management-team style: given a dispute ("customer says they
// paid but the merchant says nothing arrived"), an admin needs to find the
// exact transaction across ANY merchant and see everything that happened
// around it — not just the settled Transaction row. Search is intentionally
// broad (reference, either counterparty's phone/name, account number,
// merchant business name/email) since a merchant or customer disputing a
// transaction rarely has the exact reference on hand.
// @route   GET /api/admin/transaction-audit
// @access  Private (Admin)
export const searchTransactionAudit = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
    const type = req.query.type && req.query.type !== 'all' ? req.query.type : null;
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const q = (req.query.q || '').trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if ((from && !isNaN(from)) || (to && !isNaN(to))) {
      filter.createdAt = {};
      if (from && !isNaN(from)) filter.createdAt.$gte = from;
      if (to && !isNaN(to)) filter.createdAt.$lte = to;
    }

    if (q) {
      // Escape regex specials — an unescaped user-controlled pattern here is
      // a ReDoS vector against the event loop (same guard as getLedger).
      const safeQ = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: safeQ, $options: 'i' };
      const matchingMerchants = await Merchant.find({
        $or: [{ businessName: rx }, { email: rx }, { ncbaMerchantCode: rx }],
      }).select('_id').lean();
      const merchantIds = matchingMerchants.map((m) => m._id);

      filter.$or = [
        { reference: rx },
        { accountNumber: rx },
        { 'sender.name': rx },
        { 'sender.id': rx },
        { 'recipient.name': rx },
        { 'recipient.id': rx },
        ...(merchantIds.length ? [{ merchantId: { $in: merchantIds } }] : []),
      ];
    }

    const [total, txns] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchantId', 'businessName email phone ncbaMerchantCode status flagged')
        .lean(),
    ]);

    res.json({
      success: true,
      data: txns.map((t) => ({
        _id: t._id,
        reference: t.reference,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        type: t.type,
        status: t.status,
        currency: t.currency,
        amount: t.amount,
        kesAmount: t.kesAmount,
        usdcAmount: t.usdcAmount,
        accountNumber: t.accountNumber,
        sender: t.sender,
        recipient: t.recipient,
        settlementRail: t.settlementRail,
        mobileNetwork: t.mobileNetwork,
        merchant: t.merchantId
          ? {
              _id: t.merchantId._id,
              businessName: t.merchantId.businessName,
              email: t.merchantId.email,
              status: t.merchantId.status,
              flagged: t.merchantId.flagged,
            }
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Search Transaction Audit Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Full forensic detail for one transaction — the drill-down a dispute
// investigation actually needs: every field on the transaction itself, the
// merchant it belongs to, and a best-effort correlated timeline built from
// records that carry no direct foreign key back to this Transaction
// (STKRequest, SmsLog) but can be matched closely enough by merchant +
// amount + a tight time window to be useful for support/ops. Anything
// correlated this way is labeled as such in the response — never presented
// as a guaranteed link, since there is no hard FK to prove it.
// @route   GET /api/admin/transaction-audit/:id
// @access  Private (Admin)
export const getTransactionAuditDetail = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('merchantId', 'businessName email phone ncbaMerchantCode status flagged kesBalance')
      .lean();
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

    const createdAtMs = new Date(txn.createdAt).getTime();
    const windowMs = 20 * 60 * 1000;
    const windowStart = new Date(createdAtMs - windowMs);
    const windowEnd = new Date(createdAtMs + windowMs);
    const candidateAmounts = [txn.amount, txn.kesAmount].filter((n) => typeof n === 'number' && n > 0);

    const [stkCandidates, smsCandidates] = await Promise.all([
      txn.merchantId
        ? STKRequest.find({
            merchantId: txn.merchantId._id,
            ...(candidateAmounts.length ? { amount: { $in: candidateAmounts } } : {}),
            createdAt: { $gte: windowStart, $lte: windowEnd },
          }).sort('-createdAt').limit(5).lean()
        : [],
      SmsLog.find({
        to: { $in: [txn.sender?.id, txn.recipient?.id, txn.merchantId?.phone].filter(Boolean) },
        sentAt: { $gte: windowStart, $lte: windowEnd },
      }).sort('sentAt').limit(10).lean(),
    ]);

    // Synthesized timeline — every timestamped fact gathered above, sorted
    // chronologically, so an admin can read what happened in order without
    // mentally cross-referencing three separate record types.
    const timeline = [];
    timeline.push({ at: txn.createdAt, label: 'Transaction created', detail: `${txn.type} · ${txn.status}` });
    if (txn.updatedAt && new Date(txn.updatedAt).getTime() !== createdAtMs) {
      timeline.push({ at: txn.updatedAt, label: 'Transaction last updated', detail: `status: ${txn.status}` });
    }
    stkCandidates.forEach((s) => {
      timeline.push({ at: s.createdAt, label: 'STK Push initiated', detail: `${s.phone || 'unknown phone'} · KES ${s.amount}` });
      timeline.push({ at: s.updatedAt, label: `STK Push resolved: ${s.status}`, detail: s.resultDesc || '—' });
    });
    smsCandidates.forEach((s) => {
      timeline.push({ at: s.sentAt, label: `SMS sent to ${s.to}`, detail: `${s.deliveryStatus}${s.failureReason ? ' — ' + s.failureReason : ''}` });
      if (s.deliveredAt) timeline.push({ at: s.deliveredAt, label: `SMS delivered to ${s.to}`, detail: s.messageId || '—' });
    });
    timeline.sort((a, b) => new Date(a.at) - new Date(b.at));

    res.json({
      success: true,
      data: {
        transaction: txn,
        merchant: txn.merchantId || null,
        relatedStkRequests: stkCandidates,
        relatedSms: smsCandidates,
        timeline,
      },
    });
  } catch (error) {
    console.error('Get Transaction Audit Detail Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
