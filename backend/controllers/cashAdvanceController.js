import mongoose from 'mongoose';
import CashAdvanceApplication from '../models/CashAdvanceApplication.js';
import Transaction from '../models/Transaction.js';
import { calculateTrustScore } from './trustScoreController.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { getOrCreatePlatformSettings } from '../models/PlatformSettings.js';
import { reversedTransactionExclusionMatch } from '../utils/reversedTransactions.js';

const KES_VOL_REAL = {
  $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }]
};

const ALLOWED_TENORS = [7, 14, 21, 30, 45, 60];
const ACTIVE_STATUSES = ['pending', 'reviewing', 'approved'];

const priorityFor = (trustScore) => {
  if (trustScore >= 85) return 'high';
  if (trustScore >= 70) return 'medium';
  return 'low';
};

// @desc    Submit a cash advance application
// @route   POST /api/cash-advance/apply
// @access  Private (Merchant)
export const submitApplication = async (req, res) => {
  try {
    const merchant = req.merchant;

    // Global kill switch — checked before the per-merchant flag since an
    // admin turning this off platform-wide must win regardless of what any
    // individual merchant's features.cashAdvanceForm is set to.
    const platformSettings = await getOrCreatePlatformSettings();
    if (!platformSettings.cashAdvanceEnabled) {
      return res.status(403).json({ error: 'Cash advance applications are temporarily paused for all merchants. Please check back later.' });
    }

    if (merchant.features && merchant.features.cashAdvanceForm === false) {
      return res.status(403).json({ error: 'Cash advance applications are not available on your account right now.' });
    }

    const existingActive = await CashAdvanceApplication.findOne({
      merchant: merchant._id,
      status: { $in: ACTIVE_STATUSES },
    }).sort('-createdAt');
    if (existingActive) {
      return res.status(409).json({
        error: 'You already have an active cash advance application.',
        application: existingActive,
      });
    }

    const trustResult = await calculateTrustScore(merchant);
    if (!trustResult.eligibleForAdvance) {
      return res.status(403).json({ error: 'You are not yet eligible for a cash advance.' });
    }

    const {
      requestedAmount,
      tenorDays,
      purpose,
      monthlyRevenueEstimate,
      yearsInOperation,
      businessAddress,
      contactPhone,
    } = req.body || {};

    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: 'Enter a requested amount of at least KES 1,000.' });
    }

    const tenor = Number(tenorDays);
    if (!ALLOWED_TENORS.includes(tenor)) {
      return res.status(400).json({ error: 'Choose a valid repayment period.' });
    }

    const purposeText = String(purpose || '').trim();
    if (purposeText.length < 10) {
      return res.status(400).json({ error: 'Tell us a little more about what the funds are for (at least 10 characters).' });
    }

    const application = await CashAdvanceApplication.create({
      merchant: merchant._id,
      requestedAmount: amount,
      tenorDays: tenor,
      purpose: purposeText,
      monthlyRevenueEstimate: monthlyRevenueEstimate != null && monthlyRevenueEstimate !== '' ? Number(monthlyRevenueEstimate) : null,
      yearsInOperation: yearsInOperation != null && yearsInOperation !== '' ? Number(yearsInOperation) : null,
      businessAddress: businessAddress ? String(businessAddress).trim().slice(0, 300) : null,
      contactPhone: contactPhone ? String(contactPhone).trim() : merchant.phone || null,
      trustScoreAtApplication: trustResult.current,
      priority: priorityFor(trustResult.current),
    });

    logAudit({
      action: 'merchant.cash_advance.applied',
      category: 'wallet',
      severity: 'info',
      message: `Applied for a cash advance of KES ${amount.toLocaleString()}`,
      merchant,
      req,
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    console.error('Submit Cash Advance Application Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get the signed-in merchant's own cash advance applications
// @route   GET /api/cash-advance/my-applications
// @access  Private (Merchant)
export const getMyApplications = async (req, res) => {
  try {
    const applications = await CashAdvanceApplication.find({ merchant: req.merchant._id })
      .sort('-createdAt')
      .lean();
    res.json({ success: true, applications });
  } catch (error) {
    console.error('Get My Cash Advance Applications Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Shape a raw application doc (with populated merchant) into the flat
// structure the admin "Cash advance requests" queue renders.
const toAdminShape = (app, statsByMerchant) => {
  const merchant = app.merchant || {};
  const merchantId = String(merchant._id || app.merchant);
  const stats = statsByMerchant.get(merchantId) || { collections30d: 0, settlementRate: 100 };

  return {
    _id: app._id,
    merchantId,
    merchantName: merchant.businessName || merchant.name || 'Unknown merchant',
    merchantEmail: merchant.email || null,
    requestedAmount: app.requestedAmount,
    approvedLimit: app.approvedLimit,
    tenorDays: app.tenorDays,
    trustScore: app.trustScoreAtApplication,
    collections30d: stats.collections30d,
    settlementRate: stats.settlementRate,
    purpose: app.purpose,
    monthlyRevenueEstimate: app.monthlyRevenueEstimate,
    yearsInOperation: app.yearsInOperation,
    businessAddress: app.businessAddress,
    contactPhone: app.contactPhone,
    requestedAt: app.createdAt,
    updatedAt: app.updatedAt,
    status: app.status,
    priority: app.priority,
    manager: app.reviewedBy?.email || null,
    notes: app.reviewNotes,
  };
};

// Every transaction type that represents real money collected from a
// customer into the merchant's own wallet (as opposed to money going out,
// e.g. mpesa_b2c/ncba_mobile_b2w withdrawals, or bill/utility payouts) —
// mirrors REVENUE_STREAMS' 'transaction_fee' (inbound) and
// 'ncba_collection_fee' (ncba_inbound) streams in config/revenueRateCard.js,
// PayChain's two live collection rails.
const COLLECTION_TX_TYPES = ['inbound', 'ncba_inbound'];

// Batch-compute 30d inbound collections + settlement rate for a set of
// merchant ids — this feeds a real underwriting decision (adminUpdateCashAdvanceRequest
// approves a limit against it), so it needs the same rigor as the revenue
// dashboards: reversedTransactionExclusionMatch (see that function's doc
// comment) excludes duplicate-credit/correction pairs from ever counting as
// real collected revenue, same as every other revenue aggregation in the
// codebase. Previously only counted type: 'inbound' — silently excluding
// every NCBA Virtual Account collection (type: 'ncba_inbound', PayChain's
// other live collection rail) from a merchant's apparent 30-day revenue,
// which could make a genuinely strong applicant look like they collect
// nothing.
async function computeMerchantStats(merchantIds) {
  if (!merchantIds.length) return new Map();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const excludeReversed = await reversedTransactionExclusionMatch();

  const rows = await Transaction.aggregate([
    { $match: { merchantId: { $in: merchantIds }, createdAt: { $gte: thirtyDaysAgo }, ...excludeReversed } },
    {
      $group: {
        _id: '$merchantId',
        count: { $sum: 1 },
        completed: { $sum: { $cond: [{ $in: ['$status', ['completed', 'verified']] }, 1, 0] } },
        collections30d: { $sum: { $cond: [{ $in: ['$type', COLLECTION_TX_TYPES] }, KES_VOL_REAL, 0] } },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), {
      collections30d: row.collections30d || 0,
      settlementRate: row.count > 0 ? Number(((row.completed / row.count) * 100).toFixed(1)) : 100,
    });
  }
  return map;
}

// @desc    List every merchant's cash advance requests for admin review
// @route   GET /api/admin/cash-advance/requests
// @access  Private (Admin)
export const adminListCashAdvanceRequests = async (req, res) => {
  try {
    const applications = await CashAdvanceApplication.find({})
      .populate('merchant', 'businessName name email')
      .populate('reviewedBy', 'email')
      .sort('-createdAt')
      .lean();

    const merchantIds = [...new Set(applications.map((a) => String(a.merchant?._id || a.merchant)))]
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));
    const statsByMerchant = await computeMerchantStats(merchantIds);

    const data = applications.map((app) => toAdminShape(app, statsByMerchant));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Admin List Cash Advance Requests Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve, decline, or move a cash advance request between review states
// @route   PATCH /api/admin/cash-advance/requests/:id
// @access  Private (Admin)
export const adminUpdateCashAdvanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid request id.' });
    }

    const { status, approvedLimit, reviewNotes } = req.body || {};
    const allowedStatuses = ['pending', 'reviewing', 'approved', 'declined'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const application = await CashAdvanceApplication.findById(id).populate('merchant');
    if (!application) return res.status(404).json({ error: 'Cash advance request not found.' });

    if (status !== undefined) application.status = status;
    if (approvedLimit !== undefined && approvedLimit !== null && approvedLimit !== '') {
      const limit = Number(approvedLimit);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({ error: 'Approved limit must be a valid number.' });
      }
      // An approved limit above what the merchant actually requested has no
      // legitimate use and would let a mistaken/malicious entry hand out
      // more than the application ever asked for.
      if (limit > application.requestedAmount) {
        return res.status(400).json({ error: `Approved limit cannot exceed the requested amount (KES ${application.requestedAmount.toLocaleString()}).` });
      }
      application.approvedLimit = limit;
    }
    if (reviewNotes !== undefined) application.reviewNotes = String(reviewNotes).slice(0, 1000);

    application.reviewedBy = req.admin._id;
    application.reviewedAt = new Date();

    await application.save();

    logAudit({
      action: 'admin.cash_advance.status_updated',
      category: 'admin',
      severity: status === 'approved' ? 'success' : status === 'declined' ? 'warning' : 'info',
      message: `Cash advance request moved to "${application.status}"${application.approvedLimit ? ` (limit KES ${application.approvedLimit.toLocaleString()})` : ''}`,
      merchant: application.merchant,
      actor: adminActor(req.admin),
      req,
    });

    await application.populate('reviewedBy', 'email');

    const merchantIds = application.merchant ? [application.merchant._id] : [];
    const statsByMerchant = await computeMerchantStats(merchantIds);

    res.json({ success: true, data: toAdminShape(application.toObject(), statsByMerchant) });
  } catch (error) {
    console.error('Admin Update Cash Advance Request Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
